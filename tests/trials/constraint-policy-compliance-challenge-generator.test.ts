import { describe, expect, it } from "vitest";
import { generateConstraintPolicyComplianceChallenge } from "../../lib/trials/constraint-policy-compliance/challenge-generator.js";
import { evaluatePolicy, type PolicySpec } from "../../lib/trials/constraint-policy-compliance/evaluate.js";
import { CAPABILITY_ID, TRIAL_ID, TRIAL_VERSION } from "../../lib/trials/constraint-policy-compliance/constants.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 37 + 17) & 0xff);
}

const CASE_CLASSES = ["COMPLIANT", "SINGLE_VIOLATION", "MULTIPLE_VIOLATIONS", "UNSUPPORTED_RULE", "INVALID_POLICY"] as const;

describe("Trial 6 constraint & policy compliance challenge generator", () => {
  for (const caseClass of CASE_CLASSES) {
    it(`generates a bounded ${caseClass} challenge whose hidden context matches independent recomputation`, () => {
      const identity = generateTestEd25519Identity();
      const generated = generateConstraintPolicyComplianceChallenge(
        { agentDid: identity.did, caseClass },
        { now: () => new Date("2026-08-31T21:00:00.000Z"), randomBytes: deterministicBytes },
      );

      expect(generated.publicPayload.agent_did).toBe(identity.did);
      expect(generated.publicPayload.capability_id).toBe(CAPABILITY_ID);
      expect(generated.publicPayload.trial_id).toBe(TRIAL_ID);
      expect(generated.publicPayload.trial_version).toBe(TRIAL_VERSION);
      expect(generated.hiddenContext.case_class).toBe(caseClass);
      expect(generated.challengeHash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);

      const recomputed = evaluatePolicy(generated.publicPayload.case.document, generated.publicPayload.case.policy as PolicySpec);
      expect(generated.hiddenContext.expected_reason_code).toBe(recomputed.reason_code);
      expect(generated.hiddenContext.expected_result).toEqual(recomputed.result);
    });
  }

  it("classifies COMPLIANT challenges as an actual clean pass, not an incidental failure", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "COMPLIANT" },
      { randomBytes: deterministicBytes },
    );
    expect(generated.hiddenContext.expected_reason_code).toBe("POLICY_COMPLIANT");
    expect(generated.hiddenContext.expected_result?.compliant).toBe(true);
    expect(generated.hiddenContext.expected_result?.violations).toEqual([]);
  });

  it("classifies SINGLE_VIOLATION with exactly one violation", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SINGLE_VIOLATION" },
      { randomBytes: deterministicBytes },
    );
    expect(generated.hiddenContext.expected_reason_code).toBe("POLICY_VIOLATION");
    expect(generated.hiddenContext.expected_result?.violations).toHaveLength(1);
  });

  it("classifies MULTIPLE_VIOLATIONS with more than one violation", () => {
    const generated = generateConstraintPolicyComplianceChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "MULTIPLE_VIOLATIONS" },
      { randomBytes: deterministicBytes },
    );
    expect(generated.hiddenContext.expected_reason_code).toBe("POLICY_VIOLATION");
    expect(generated.hiddenContext.expected_result?.violations.length).toBeGreaterThan(1);
  });

  it("classifies UNSUPPORTED_RULE and INVALID_POLICY as structural failures with a null result", () => {
    for (const caseClass of ["UNSUPPORTED_RULE", "INVALID_POLICY"] as const) {
      const generated = generateConstraintPolicyComplianceChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass },
        { randomBytes: deterministicBytes },
      );
      expect(generated.hiddenContext.expected_reason_code).toBe(caseClass);
      expect(generated.hiddenContext.expected_result).toBeNull();
    }
  });

  it("produces a fresh challenge_id and nonce across repeated calls with real randomness", () => {
    const identity = generateTestEd25519Identity();
    const first = generateConstraintPolicyComplianceChallenge({ agentDid: identity.did, caseClass: "COMPLIANT" });
    const second = generateConstraintPolicyComplianceChallenge({ agentDid: identity.did, caseClass: "COMPLIANT" });
    expect(first.publicPayload.challenge_id).not.toBe(second.publicPayload.challenge_id);
    expect(first.publicPayload.nonce).not.toBe(second.publicPayload.nonce);
    expect(first.challengeHash).not.toBe(second.challengeHash);
  });

  it("rejects a did that is not a supported Ed25519 did:key", () => {
    expect(() =>
      generateConstraintPolicyComplianceChallenge({ agentDid: "did:web:example.com", caseClass: "COMPLIANT" }, { randomBytes: deterministicBytes }),
    ).toThrow();
  });
});
