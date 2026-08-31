import type { PassFinalizationRepository } from "../db/finalization-repository.js";
import type { AttestationSigner } from "../receipts/receipt.js";
import {
  finalizeTrial1Verification,
  type FinalizedTrial1Verification,
} from "./finalization-service.js";

export class FinalizationUnknownError extends Error {
  constructor(
    readonly internalError: unknown,
    readonly recoveryError: unknown = null,
  ) {
    super("accepted submission could not be finalized deterministically");
    this.name = "FinalizationUnknownError";
  }
}

export type Trial1Finalizer = (
  challengeId: string,
  deps: {
    repository: PassFinalizationRepository;
    signer: AttestationSigner;
    now?: () => Date;
    randomUuid?: () => string;
  },
) => Promise<FinalizedTrial1Verification>;

export interface FinalizeWithUnknownRecoveryDependencies {
  repository: PassFinalizationRepository;
  signer: AttestationSigner;
  now?: () => Date;
  randomUuid?: () => string;
  finalizer?: Trial1Finalizer;
}

export async function finalizeTrial1WithUnknownRecovery(
  challengeId: string,
  deps: FinalizeWithUnknownRecoveryDependencies,
): Promise<FinalizedTrial1Verification> {
  const finalizer = deps.finalizer ?? finalizeTrial1Verification;

  try {
    return await finalizer(challengeId, deps);
  } catch (internalError) {
    const occurredAt = (deps.now ?? (() => new Date()))().toISOString();
    let recoveryError: unknown = null;
    try {
      await deps.repository.recordUnknownFinalization(
        challengeId,
        "INTERNAL_VERIFICATION_ERROR",
        occurredAt,
      );
    } catch (error) {
      recoveryError = error;
    }
    throw new FinalizationUnknownError(internalError, recoveryError);
  }
}
