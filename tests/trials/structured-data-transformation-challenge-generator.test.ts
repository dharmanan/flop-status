import { describe, expect, it } from "vitest";
import { generateStructuredDataTransformationChallenge } from "../../lib/trials/structured-data-transformation/challenge-generator.js";
import { applyTransformation } from "../../lib/trials/structured-data-transformation/transform.js";
import { CAPABILITY_ID, TRIAL_ID, TRIAL_VERSION } from "../../lib/trials/structured-data-transformation/constants.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 29 + 5) & 0xff);
}

const CASE_CLASSES = [
  "VALID",
  "SOURCE_PATH_MISSING",
  "INVALID_TYPE_COERCION",
  "UNSUPPORTED_OPERATION",
  "TARGET_PATH_CONFLICT",
] as const;

describe("Trial 5 structured data transformation challenge generator", () => {
  for (const caseClass of CASE_CLASSES) {
    it(`generates a bounded ${caseClass} challenge whose hidden context matches independent recomputation`, () => {
      const identity = generateTestEd25519Identity();
      const generated = generateStructuredDataTransformationChallenge(
        { agentDid: identity.did, caseClass },
        { now: () => new Date("2026-08-31T21:00:00.000Z"), randomBytes: deterministicBytes },
      );

      expect(generated.publicPayload.agent_did).toBe(identity.did);
      expect(generated.publicPayload.capability_id).toBe(CAPABILITY_ID);
      expect(generated.publicPayload.trial_id).toBe(TRIAL_ID);
      expect(generated.publicPayload.trial_version).toBe(TRIAL_VERSION);
      expect(generated.hiddenContext.case_class).toBe(caseClass);
      expect(generated.challengeHash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);

      const recomputed = applyTransformation(generated.publicPayload.case.source, generated.publicPayload.case.spec);
      expect(generated.hiddenContext.expected_reason_code).toBe(recomputed.reason_code);
      expect(generated.hiddenContext.expected_result).toEqual(recomputed.result);
    });
  }

  it("classifies VALID challenges as an actual successful transformation, not an incidental failure", () => {
    const generated = generateStructuredDataTransformationChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "VALID" },
      { randomBytes: deterministicBytes },
    );
    expect(generated.hiddenContext.expected_reason_code).toBe("TRANSFORMATION_MATCH");
    expect(generated.hiddenContext.expected_result).not.toBeNull();
  });

  it("classifies each non-VALID case class with its documented reason code", () => {
    const expectedReasonCodes: Record<Exclude<(typeof CASE_CLASSES)[number], "VALID">, string> = {
      SOURCE_PATH_MISSING: "SOURCE_PATH_MISSING",
      INVALID_TYPE_COERCION: "INVALID_TYPE_COERCION",
      UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION",
      TARGET_PATH_CONFLICT: "TARGET_PATH_CONFLICT",
    };
    for (const [caseClass, reasonCode] of Object.entries(expectedReasonCodes)) {
      const generated = generateStructuredDataTransformationChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass: caseClass as (typeof CASE_CLASSES)[number] },
        { randomBytes: deterministicBytes },
      );
      expect(generated.hiddenContext.expected_reason_code).toBe(reasonCode);
      expect(generated.hiddenContext.expected_result).toBeNull();
    }
  });

  it("produces a fresh challenge_id and nonce across repeated calls with real randomness", () => {
    const identity = generateTestEd25519Identity();
    const first = generateStructuredDataTransformationChallenge({ agentDid: identity.did, caseClass: "VALID" });
    const second = generateStructuredDataTransformationChallenge({ agentDid: identity.did, caseClass: "VALID" });
    expect(first.publicPayload.challenge_id).not.toBe(second.publicPayload.challenge_id);
    expect(first.publicPayload.nonce).not.toBe(second.publicPayload.nonce);
    expect(first.challengeHash).not.toBe(second.challengeHash);
  });

  it("rejects a did that is not a supported Ed25519 did:key", () => {
    expect(() =>
      generateStructuredDataTransformationChallenge({ agentDid: "did:web:example.com", caseClass: "VALID" }, { randomBytes: deterministicBytes }),
    ).toThrow();
  });
});
