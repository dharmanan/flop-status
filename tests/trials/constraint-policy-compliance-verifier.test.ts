import { describe, expect, it } from "vitest";
import { generateConstraintPolicyComplianceChallenge } from "../../lib/trials/constraint-policy-compliance/challenge-generator.js";
import { verifyTrial6Result, Trial6VerifierInputError } from "../../lib/trials/constraint-policy-compliance/verifier.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 41 + 19) & 0xff);
}

const CASE_CLASSES = ["COMPLIANT", "SINGLE_VIOLATION", "MULTIPLE_VIOLATIONS", "UNSUPPORTED_RULE", "INVALID_POLICY"] as const;

describe("Trial 6 constraint & policy compliance verifier", () => {
  for (const caseClass of CASE_CLASSES) {
    it(`passes the exact expected ${caseClass} result`, () => {
      const generated = generateConstraintPolicyComplianceChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass },
        { now: () => new Date("2026-08-31T21:10:00.000Z"), randomBytes: deterministicBytes },
      );
      const result = {
        reason_code: generated.hiddenContext.expected_reason_code,
        result: generated.hiddenContext.expected_result,
      };
      expect(
        verifyTrial6Result({ publicPayload: generated.publicPayload, hiddenContext: generated.hiddenContext, result }),
      ).toMatchObject({ verdict: "PASS", reason_code: "EXPECTED_RESULT_MATCH" });
    });
  }

  it("fails a tampered compliance result without turning verifier infrastructure into UNKNOWN", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "COMPLIANT" },
      { randomBytes: deterministicBytes },
    );
    expect(
      verifyTrial6Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "POLICY_COMPLIANT", result: { compliant: true, violations: [], evaluated_rules: ["tampered"] } },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "COMPLIANCE_RESULT_MISMATCH" });
  });

  it("fails a submission that reports the wrong reason code for the same underlying document", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SINGLE_VIOLATION" },
      { randomBytes: deterministicBytes },
    );
    expect(
      verifyTrial6Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "POLICY_COMPLIANT", result: { compliant: true, violations: [], evaluated_rules: [] } },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "COMPLIANCE_RESULT_MISMATCH" });
  });

  it("independently recomputes the policy evaluation rather than trusting the stored hidden context alone", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "COMPLIANT" },
      { randomBytes: deterministicBytes },
    );
    const forgedResult = { compliant: false, violations: [{ rule_id: "forged", reason: "VALUE_MISMATCH" as const }], evaluated_rules: ["forged"] };
    const tamperedHiddenContext = { ...generated.hiddenContext, expected_reason_code: "POLICY_VIOLATION" as const, expected_result: forgedResult };
    expect(() =>
      verifyTrial6Result({
        publicPayload: generated.publicPayload,
        hiddenContext: tamperedHiddenContext,
        result: { reason_code: "POLICY_VIOLATION", result: forgedResult },
      }),
    ).toThrow(Trial6VerifierInputError);
  });

  it("throws Trial6VerifierInputError for a structurally invalid persisted challenge payload", () => {
    expect(() =>
      verifyTrial6Result({
        publicPayload: { not: "a challenge" },
        hiddenContext: { case_class: "COMPLIANT", expected_reason_code: "POLICY_COMPLIANT", expected_result: null },
        result: { reason_code: "POLICY_COMPLIANT", result: null },
      }),
    ).toThrow(Trial6VerifierInputError);
  });

  it("throws Trial6VerifierInputError for a malformed submitted result shape", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "COMPLIANT" },
      { randomBytes: deterministicBytes },
    );
    expect(() =>
      verifyTrial6Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "NOT_A_REAL_REASON_CODE", result: null },
      }),
    ).toThrow(Trial6VerifierInputError);
  });

  it("reports its verifier id and version on every verdict", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "COMPLIANT" },
      { randomBytes: deterministicBytes },
    );
    const verification = verifyTrial6Result({
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      result: { reason_code: generated.hiddenContext.expected_reason_code, result: generated.hiddenContext.expected_result },
    });
    expect(verification.verifier_id).toBe("constraint-policy-compliance-verifier");
    expect(verification.verifier_version).toBe("1");
  });
});
