import { describe, expect, it } from "vitest";
import { generateFailureRecoveryIdempotencyChallenge } from "../../lib/trials/failure-recovery-idempotency/challenge-generator.js";
import { verifyTrial7Result, Trial7VerifierInputError } from "../../lib/trials/failure-recovery-idempotency/verifier.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 47 + 29) & 0xff);
}

const CASE_CLASSES = [
  "SUCCESS_FIRST_ATTEMPT",
  "RECOVER_THEN_SUCCEED",
  "DUPLICATE_AFTER_SUCCESS",
  "RETRY_LIMIT_EXCEEDED",
  "PERMANENT_FAILURE",
] as const;

describe("Trial 7 failure recovery & idempotency verifier", () => {
  for (const caseClass of CASE_CLASSES) {
    it(`passes the exact expected ${caseClass} result`, () => {
      const generated = generateFailureRecoveryIdempotencyChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass },
        { now: () => new Date("2026-08-31T21:10:00.000Z"), randomBytes: deterministicBytes },
      );
      const result = {
        reason_code: generated.hiddenContext.expected_reason_code,
        result: generated.hiddenContext.expected_result,
      };
      expect(
        verifyTrial7Result({ publicPayload: generated.publicPayload, hiddenContext: generated.hiddenContext, result }),
      ).toMatchObject({ verdict: "PASS", reason_code: "EXPECTED_RESULT_MATCH" });
    });
  }

  it("fails a tampered final state without turning verifier infrastructure into UNKNOWN", () => {
    const generated = generateFailureRecoveryIdempotencyChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SUCCESS_FIRST_ATTEMPT" },
      { randomBytes: deterministicBytes },
    );
    const tampered = {
      ...generated.hiddenContext.expected_result!,
      final_state: { balance: 999999 },
    };
    expect(
      verifyTrial7Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "RECOVERY_SUCCESS", result: tampered },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "FINAL_STATE_MISMATCH" });
  });

  it("fails a tampered applied_count", () => {
    const generated = generateFailureRecoveryIdempotencyChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SUCCESS_FIRST_ATTEMPT" },
      { randomBytes: deterministicBytes },
    );
    const tampered = { ...generated.hiddenContext.expected_result!, applied_count: 2 };
    expect(
      verifyTrial7Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "RECOVERY_SUCCESS", result: tampered },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "FINAL_STATE_MISMATCH" });
  });

  it("fails a tampered attempt status sequence", () => {
    const generated = generateFailureRecoveryIdempotencyChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "RECOVER_THEN_SUCCEED" },
      { randomBytes: deterministicBytes },
    );
    const tampered = {
      ...generated.hiddenContext.expected_result!,
      attempts: [{ attempt: 1, status: "APPLIED" as const }, { attempt: 2, status: "APPLIED" as const }],
    };
    expect(
      verifyTrial7Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "RECOVERY_SUCCESS", result: tampered },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "FINAL_STATE_MISMATCH" });
  });

  it("independently recomputes the simulation rather than trusting the stored hidden context alone", () => {
    const generated = generateFailureRecoveryIdempotencyChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SUCCESS_FIRST_ATTEMPT" },
      { randomBytes: deterministicBytes },
    );
    const forgedResult = { ...generated.hiddenContext.expected_result!, final_state: { balance: 42 } };
    const tamperedHiddenContext = { ...generated.hiddenContext, expected_result: forgedResult };
    expect(() =>
      verifyTrial7Result({
        publicPayload: generated.publicPayload,
        hiddenContext: tamperedHiddenContext,
        result: { reason_code: "RECOVERY_SUCCESS", result: forgedResult },
      }),
    ).toThrow(Trial7VerifierInputError);
  });

  it("throws Trial7VerifierInputError for a structurally invalid persisted challenge payload", () => {
    expect(() =>
      verifyTrial7Result({
        publicPayload: { not: "a challenge" },
        hiddenContext: { case_class: "SUCCESS_FIRST_ATTEMPT", expected_reason_code: "RECOVERY_SUCCESS", expected_result: null },
        result: { reason_code: "RECOVERY_SUCCESS", result: null },
      }),
    ).toThrow(Trial7VerifierInputError);
  });

  it("throws Trial7VerifierInputError for a malformed submitted result shape", () => {
    const generated = generateFailureRecoveryIdempotencyChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SUCCESS_FIRST_ATTEMPT" },
      { randomBytes: deterministicBytes },
    );
    expect(() =>
      verifyTrial7Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "NOT_A_REAL_REASON_CODE", result: null },
      }),
    ).toThrow(Trial7VerifierInputError);
  });

  it("reports its verifier id and version on every verdict", () => {
    const generated = generateFailureRecoveryIdempotencyChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SUCCESS_FIRST_ATTEMPT" },
      { randomBytes: deterministicBytes },
    );
    const verification = verifyTrial7Result({
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      result: { reason_code: generated.hiddenContext.expected_reason_code, result: generated.hiddenContext.expected_result },
    });
    expect(verification.verifier_id).toBe("failure-recovery-idempotency-verifier");
    expect(verification.verifier_version).toBe("1");
  });
});
