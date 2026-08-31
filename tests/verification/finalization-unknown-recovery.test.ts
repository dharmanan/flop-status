import { describe, expect, it } from "vitest";
import type {
  Trial1FinalizationRepository,
} from "../../lib/db/finalization-recovery-repository.js";
import type { PassFinalizationTransaction } from "../../lib/db/finalization-repository.js";
import type { AttestationSigner } from "../../lib/receipts/receipt.js";
import {
  FinalizationUnknownError,
  finalizeTrial1WithUnknownRecovery,
} from "../../lib/verification/finalization-unknown-recovery.js";

class FakeRecoveryRepository implements Trial1FinalizationRepository {
  unknown: { challengeId: string; reasonCode: string; occurredAt: string } | null = null;

  async withFinalizationTransaction<T>(
    _challengeId: string,
    _fn: (tx: PassFinalizationTransaction) => Promise<T>,
  ): Promise<T> {
    throw new Error("normal finalization should be replaced by injected test fault");
  }

  async recordUnknownFinalization(
    challengeId: string,
    reasonCode: string,
    occurredAt: string,
  ): Promise<void> {
    this.unknown = { challengeId, reasonCode, occurredAt };
  }
}

const signer: AttestationSigner = {
  keyId: "test-key",
  algorithm: "Ed25519",
  publicKey: "unused",
  publicKeyEncoding: "base64url",
  sign() {
    throw new Error("signer must not be called for UNKNOWN");
  },
};

describe("finalization UNKNOWN recovery", () => {
  it("records UNKNOWN after a controlled internal finalization failure and never returns FAIL", async () => {
    const repository = new FakeRecoveryRepository();
    const challengeId = "11111111-1111-4111-8111-111111111111";
    const now = () => new Date("2026-08-31T08:00:00.000Z");

    const promise = finalizeTrial1WithUnknownRecovery(challengeId, {
      repository,
      signer,
      now,
      finalizer: async () => {
        throw new Error("controlled verifier fault");
      },
    });

    await expect(promise).rejects.toBeInstanceOf(FinalizationUnknownError);
    expect(repository.unknown).toEqual({
      challengeId,
      reasonCode: "INTERNAL_VERIFICATION_ERROR",
      occurredAt: "2026-08-31T08:00:00.000Z",
    });
  });
});
