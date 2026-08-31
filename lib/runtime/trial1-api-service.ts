import { z } from "zod";
import {
  issueEd25519SignatureChallenge,
  type ChallengeIssuanceRepository,
} from "../challenges/issuance-service.js";
import type { ChallengeStateRepository } from "../db/challenge-state-repository.js";
import type { PassFinalizationRepository } from "../db/finalization-repository.js";
import type { SubmissionAcceptanceRepository } from "../db/submission-repository.js";
import type { AttestationSigner } from "../receipts/receipt.js";
import { acceptTrial1SignedSubmission } from "../submissions/submission-service.js";
import { TRIAL_ID } from "../trials/ed25519-signature-verification/constants.js";
import { finalizeTrial1Verification } from "../verification/finalization-service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createChallengeSchema = z
  .object({
    agent_did: z.string().min(1),
    trial_id: z.literal(TRIAL_ID),
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
  constructor(readonly cause: unknown) {
    super("accepted submission could not be finalized deterministically");
    this.name = "Trial1VerificationUnknownError";
  }
}

export interface Trial1ApiDependencies {
  challengeRepository: ChallengeIssuanceRepository;
  challengeStateRepository: ChallengeStateRepository;
  submissionRepository: SubmissionAcceptanceRepository;
  finalizationRepository: PassFinalizationRepository;
  signer: AttestationSigner;
}

export class Trial1ApiService {
  constructor(private readonly deps: Trial1ApiDependencies) {}

  async createChallenge(body: unknown) {
    const parsed = createChallengeSchema.safeParse(body);
    if (!parsed.success) {
      throw new Trial1ApiRequestError(
        "INVALID_CHALLENGE_SCHEMA",
        parsed.error.issues.map((issue) => issue.message).join("; "),
      );
    }
    const issued = await issueEd25519SignatureChallenge(
      { agentDid: parsed.data.agent_did },
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

    await acceptTrial1SignedSubmission(
      { challengeId, envelope, bodyByteLength },
      { repository: this.deps.submissionRepository },
    );

    try {
      const finalized = await finalizeTrial1Verification(challengeId, {
        repository: this.deps.finalizationRepository,
        signer: this.deps.signer,
      });
      return finalized.verdict === "PASS"
        ? {
            challenge_id: challengeId,
            state: "PASS" as const,
            verdict: "PASS" as const,
            receipt_id: finalized.receipt.receipt_id,
          }
        : {
            challenge_id: challengeId,
            state: "FAIL" as const,
            verdict: "FAIL" as const,
            receipt_id: null,
          };
    } catch (error) {
      throw new Trial1VerificationUnknownError(error);
    }
  }
}
