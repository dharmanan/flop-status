import { describe, expect, it } from "vitest";
import { generateFailureRecoveryIdempotencyChallenge } from "../../lib/trials/failure-recovery-idempotency/challenge-generator.js";
import { simulateFailureRecovery } from "../../lib/trials/failure-recovery-idempotency/simulate.js";
import { CAPABILITY_ID, TRIAL_ID, TRIAL_VERSION } from "../../lib/trials/failure-recovery-idempotency/constants.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 43 + 23) & 0xff);
}

const CASE_CLASSES = [
  "SUCCESS_FIRST_ATTEMPT",
  "RECOVER_THEN_SUCCEED",
  "DUPLICATE_AFTER_SUCCESS",
  "RETRY_LIMIT_EXCEEDED",
  "PERMANENT_FAILURE",
] as const;

describe("Trial 7 failure recovery & idempotency challenge generator", () => {
  for (const caseClass of CASE_CLASSES) {
    it(`generates a bounded ${caseClass} challenge whose hidden context matches independent recomputation`, () => {
      const identity = generateTestEd25519Identity();
      const generated = generateFailureRecoveryIdempotencyChallenge(
        { agentDid: identity.did, caseClass },
        { now: () => new Date("2026-08-31T21:00:00.000Z"), randomBytes: deterministicBytes },
      );

      expect(generated.publicPayload.agent_did).toBe(identity.did);
      expect(generated.publicPayload.capability_id).toBe(CAPABILITY_ID);
      expect(generated.publicPayload.trial_id).toBe(TRIAL_ID);
      expect(generated.publicPayload.trial_version).toBe(TRIAL_VERSION);
      expect(generated.hiddenContext.case_class).toBe(caseClass);
      expect(generated.challengeHash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);

      const recomputed = simulateFailureRecovery(generated.publicPayload.case);
      expect(generated.hiddenContext.expected_reason_code).toBe(recomputed.reason_code);
      expect(generated.hiddenContext.expected_result).toEqual(recomputed.result);
    });
  }

  it("classifies SUCCESS_FIRST_ATTEMPT and RECOVER_THEN_SUCCEED as RECOVERY_SUCCESS, committed with applied_count 1", () => {
    for (const caseClass of ["SUCCESS_FIRST_ATTEMPT", "RECOVER_THEN_SUCCEED"] as const) {
      const generated = generateFailureRecoveryIdempotencyChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass },
        { randomBytes: deterministicBytes },
      );
      expect(generated.hiddenContext.expected_reason_code).toBe("RECOVERY_SUCCESS");
      expect(generated.hiddenContext.expected_result?.status).toBe("COMMITTED");
      expect(generated.hiddenContext.expected_result?.applied_count).toBe(1);
    }
  });

  it("classifies DUPLICATE_AFTER_SUCCESS as IDEMPOTENT_REPLAY, still committed with applied_count 1", () => {
    const generated = generateFailureRecoveryIdempotencyChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "DUPLICATE_AFTER_SUCCESS" },
      { randomBytes: deterministicBytes },
    );
    expect(generated.hiddenContext.expected_reason_code).toBe("IDEMPOTENT_REPLAY");
    expect(generated.hiddenContext.expected_result?.status).toBe("COMMITTED");
    expect(generated.hiddenContext.expected_result?.applied_count).toBe(1);
  });

  it("classifies RETRY_LIMIT_EXCEEDED and PERMANENT_FAILURE as FAILED with applied_count 0", () => {
    for (const caseClass of ["RETRY_LIMIT_EXCEEDED", "PERMANENT_FAILURE"] as const) {
      const generated = generateFailureRecoveryIdempotencyChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass },
        { randomBytes: deterministicBytes },
      );
      expect(generated.hiddenContext.expected_reason_code).toBe(caseClass);
      expect(generated.hiddenContext.expected_result?.status).toBe("FAILED");
      expect(generated.hiddenContext.expected_result?.applied_count).toBe(0);
    }
  });

  it("produces a fresh challenge_id and nonce across repeated calls with real randomness", () => {
    const identity = generateTestEd25519Identity();
    const first = generateFailureRecoveryIdempotencyChallenge({ agentDid: identity.did, caseClass: "SUCCESS_FIRST_ATTEMPT" });
    const second = generateFailureRecoveryIdempotencyChallenge({ agentDid: identity.did, caseClass: "SUCCESS_FIRST_ATTEMPT" });
    expect(first.publicPayload.challenge_id).not.toBe(second.publicPayload.challenge_id);
    expect(first.publicPayload.nonce).not.toBe(second.publicPayload.nonce);
    expect(first.publicPayload.case.operation.idempotency_key).not.toBe(second.publicPayload.case.operation.idempotency_key);
    expect(first.challengeHash).not.toBe(second.challengeHash);
  });

  it("rejects a did that is not a supported Ed25519 did:key", () => {
    expect(() =>
      generateFailureRecoveryIdempotencyChallenge(
        { agentDid: "did:web:example.com", caseClass: "SUCCESS_FIRST_ATTEMPT" },
        { randomBytes: deterministicBytes },
      ),
    ).toThrow();
  });
});
