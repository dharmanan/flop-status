import { randomUUID } from "node:crypto";
import type { PassFinalizationRepository } from "../db/finalization-repository.js";
import {
  RECEIPT_EVIDENCE_TYPE,
  RECEIPT_VERSION,
  signPassReceipt,
  type AttestationSigner,
  type SignedPassReceipt,
  type UnsignedPassReceipt,
} from "../receipts/receipt.js";
import { verifyTrial1Result } from "../trials/ed25519-signature-verification/verifier.js";

export class FinalizationError extends Error {
  constructor(readonly code: "CHALLENGE_NOT_FOUND" | "CHALLENGE_NOT_SUBMITTED", message: string) {
    super(message);
    this.name = "FinalizationError";
  }
}

export interface FinalizeTrial1Dependencies {
  repository: PassFinalizationRepository;
  signer: AttestationSigner;
  now?: () => Date;
  randomUuid?: () => string;
}

export type FinalizedTrial1Verification =
  | {
      verdict: "PASS";
      verificationRunId: string;
      receipt: SignedPassReceipt;
    }
  | {
      verdict: "FAIL";
      verificationRunId: string;
      receipt: null;
      reasonCode: string;
    };

export async function finalizeTrial1Verification(
  challengeId: string,
  deps: FinalizeTrial1Dependencies,
): Promise<FinalizedTrial1Verification> {
  const now = deps.now ?? (() => new Date());
  const uuid = deps.randomUuid ?? randomUUID;

  return deps.repository.withFinalizationTransaction(challengeId, async (tx) => {
    const context = await tx.loadContext();
    if (!context) {
      throw new FinalizationError("CHALLENGE_NOT_FOUND", "challenge or accepted submission not found");
    }
    if (context.state !== "SUBMITTED") {
      throw new FinalizationError(
        "CHALLENGE_NOT_SUBMITTED",
        `challenge state is ${context.state}`,
      );
    }

    const startedAt = now().toISOString();
    const verification = verifyTrial1Result({
      publicPayload: context.publicPayload,
      hiddenContext: context.hiddenContext,
      result: context.resultPayload,
    });
    const completedAt = now().toISOString();

    const verificationRunId = await tx.insertVerificationRun({
      challengeId: context.challengeId,
      submissionId: context.submissionId,
      verifierId: verification.verifier_id,
      verifierVersion: verification.verifier_version,
      verdict: verification.verdict,
      reasonCode: verification.reason_code,
      startedAt,
      completedAt,
    });

    if (verification.verdict === "FAIL") {
      await tx.markChallengeFinal(context.challengeId, "FAIL", completedAt);
      return {
        verdict: "FAIL",
        verificationRunId,
        receipt: null,
        reasonCode: verification.reason_code,
      };
    }

    const receiptId = uuid();
    const unsignedReceipt: UnsignedPassReceipt = {
      receipt_version: RECEIPT_VERSION,
      receipt_id: receiptId,
      agent_did: context.agentDid,
      capability_id: context.capabilityId,
      trial_id: context.trialId,
      trial_version: context.trialVersion,
      challenge_id: context.challengeId,
      challenge_hash: context.challengeHash,
      result_hash: context.resultHash,
      verifier_id: verification.verifier_id,
      verifier_version: verification.verifier_version,
      verdict: "PASS",
      evidence_type: RECEIPT_EVIDENCE_TYPE,
      issued_at: completedAt,
      server_key_id: deps.signer.keyId,
    };
    const receipt = signPassReceipt(unsignedReceipt, deps.signer);

    await tx.ensureServerKey({
      keyId: deps.signer.keyId,
      algorithm: deps.signer.algorithm,
      publicKey: deps.signer.publicKey,
      publicKeyEncoding: deps.signer.publicKeyEncoding,
      validFrom: completedAt,
    });
    await tx.insertReceipt({
      id: receiptId,
      receiptVersion: RECEIPT_VERSION,
      challengeId: context.challengeId,
      submissionId: context.submissionId,
      verificationRunId,
      agentId: context.agentId,
      capabilityId: context.capabilityId,
      trialId: context.trialId,
      trialVersion: context.trialVersion,
      challengeHash: context.challengeHash,
      resultHash: context.resultHash,
      verifierId: verification.verifier_id,
      verifierVersion: verification.verifier_version,
      issuedAt: completedAt,
      serverKeyId: deps.signer.keyId,
      unsignedPayload: unsignedReceipt,
      serverSignature: receipt.server_signature,
    });
    await tx.markChallengeFinal(context.challengeId, "PASS", completedAt);
    await tx.upsertCapabilityRecord(
      context.agentId,
      context.capabilityId,
      receiptId,
      completedAt,
    );

    return { verdict: "PASS", verificationRunId, receipt };
  });
}
