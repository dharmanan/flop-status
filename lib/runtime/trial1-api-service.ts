import { z } from "zod";
import { issueCapabilityChallenge } from "../challenges/issuance-service.js";
import type { ChallengeIssuanceRepository } from "../db/challenge-repository.js";
import type { ChallengeStateRepository } from "../db/challenge-state-repository.js";
import type { Trial1FinalizationRepository } from "../db/finalization-recovery-repository.js";
import type { SubmissionAcceptanceRepository } from "../db/submission-repository.js";
import type { AttestationSigner } from "../receipts/receipt.js";
import { acceptCapabilitySignedSubmission } from "../submissions/submission-service.js";
import { TRIAL_ID as TRIAL2_ID } from "../trials/canonical-json-sha256/constants.js";
import {
  PRODUCTION_TRIAL_ID as TRIAL1_PRODUCTION_ID,
  TRIAL_ID as TRIAL1_ID,
} from "../trials/ed25519-signature-verification/constants.js";
import { TRIAL_ID as TRIAL4_ID } from "../trials/signed-receipt-verification/constants.js";
import { TRIAL_ID as TRIAL3_ID } from "../trials/technocore-canonical-message/constants.js";
import {
  FinalizationUnknownError,
  finalizeTrial1WithUnknownRecovery,
} from "../verification/finalization-unknown-recovery.js";
import type { CapabilityProductService } from "./capability-product-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createChallengeSchema = z
  .object({
    agent_did: z.string().min(1),
    trial_id: z.enum([TRIAL1_ID, TRIAL1_PRODUCTION_ID, TRIAL2_ID, TRIAL3_ID, TRIAL4_ID]),
  })
  .strict();

export class Trial1ApiRequestError extends Error {
  constructor(
    readonly code: "INVALID_CHALLENGE_SCHEMA" | "INVALID_CHALLENGE_ID",
    message: string,
  ) {
    super(message);
    this.name = "Trial1ApiRequestError";
  }
}

export class Trial1VerificationUnknownError extends Error {
  constructor(readonly originalError: unknown) {
    super("accepted submission could not be finalized deterministically");
    this.name = "Trial1VerificationUnknownError";
  }
}

export interface CapabilityApiDependencies {
  challengeRepository: ChallengeIssuanceRepository;
  challengeStateRepository: ChallengeStateRepository;
  submissionRepository: SubmissionAcceptanceRepository;
  finalizationRepository: Trial1FinalizationRepository;
  signer: AttestationSigner;
  capabilityProduct?: CapabilityProductService;
}

export type Trial1ApiDependencies = CapabilityApiDependencies;

export class CapabilityApiService {
  constructor(private readonly deps: CapabilityApiDependencies) {}

  async createChallenge(body: unknown) {
    const parsed = createChallengeSchema.safeParse(body);
    if (!parsed.success) {
      throw new Trial1ApiRequestError(
        "INVALID_CHALLENGE_SCHEMA",
        parsed.error.issues.map((issue) => issue.message).join("; "),
      );
    }
    if (parsed.data.trial_id === TRIAL1_PRODUCTION_ID) {
      if (!this.deps.capabilityProduct) throw new Error("capability product service is required for production certification");
      await this.deps.capabilityProduct.requireCapability1Installed(parsed.data.agent_did);
    }
    const issued = await issueCapabilityChallenge(
      { agentDid: parsed.data.agent_did, trialId: parsed.data.trial_id },
      { repository: this.deps.challengeRepository },
    );
    return { challenge: issued.publicPayload, challenge_hash: issued.challengeHash };
  }

  async getChallenge(challengeId: string) {
    if (!UUID_PATTERN.test(challengeId)) {
      throw new Trial1ApiRequestError("INVALID_CHALLENGE_ID", "challenge id must be a lowercase UUID");
    }
    return this.deps.challengeStateRepository.findChallengeState(challengeId);
  }

  async submitChallenge(challengeId: string, envelope: unknown, bodyByteLength: number) {
    if (!UUID_PATTERN.test(challengeId)) {
      throw new Trial1ApiRequestError("INVALID_CHALLENGE_ID", "challenge id must be a lowercase UUID");
    }

    await acceptCapabilitySignedSubmission(
      { challengeId, envelope, bodyByteLength },
      { repository: this.deps.submissionRepository },
    );

    try {
      const finalized = await finalizeTrial1WithUnknownRecovery(challengeId, {
        repository: this.deps.finalizationRepository,
        signer: this.deps.signer,
      });
      return finalized.verdict === "PASS"
        ? {
            challenge_id: challengeId,
            state: "PASS" as const,
            verdict: "PASS" as const,
            receipt_id: finalized.receipt.receipt_id,
            certificate_id: finalized.certificateId ?? null,
          }
        : {
            challenge_id: challengeId,
            state: "FAIL" as const,
            verdict: "FAIL" as const,
            receipt_id: null,
            certificate_id: null,
          };
    } catch (error) {
      if (error instanceof FinalizationUnknownError) {
        throw new Trial1VerificationUnknownError(error);
      }
      throw error;
    }
  }
}

export class Trial1ApiService extends CapabilityApiService {}
