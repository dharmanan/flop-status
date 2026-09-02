import { describe, expect, it } from "vitest";
import { generateStructuredDataTransformationChallenge } from "../../lib/trials/structured-data-transformation/challenge-generator.js";
import { verifyTrial5Result, Trial5VerifierInputError } from "../../lib/trials/structured-data-transformation/verifier.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 31 + 13) & 0xff);
}

const CASE_CLASSES = [
  "VALID",
  "SOURCE_PATH_MISSING",
  "INVALID_TYPE_COERCION",
  "UNSUPPORTED_OPERATION",
  "TARGET_PATH_CONFLICT",
] as const;

describe("Trial 5 structured data transformation verifier", () => {
  for (const caseClass of CASE_CLASSES) {
    it(`passes the exact expected ${caseClass} result`, () => {
      const generated = generateStructuredDataTransformationChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass },
        { now: () => new Date("2026-08-31T21:10:00.000Z"), randomBytes: deterministicBytes },
      );
      const result = {
        reason_code: generated.hiddenContext.expected_reason_code,
        result: generated.hiddenContext.expected_result,
      };
      expect(
        verifyTrial5Result({ publicPayload: generated.publicPayload, hiddenContext: generated.hiddenContext, result }),
      ).toMatchObject({ verdict: "PASS", reason_code: "EXPECTED_RESULT_MATCH" });
    });
  }

  it("fails a modified result payload without turning verifier infrastructure into UNKNOWN", () => {
    const generated = generateStructuredDataTransformationChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "VALID" },
      { randomBytes: deterministicBytes },
    );
    expect(
      verifyTrial5Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "TRANSFORMATION_MATCH", result: { tampered: true } },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "TRANSFORMATION_MISMATCH" });
  });

  it("fails a submission that reports the wrong reason code for the same result shape", () => {
    const generated = generateStructuredDataTransformationChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "SOURCE_PATH_MISSING" },
      { randomBytes: deterministicBytes },
    );
    expect(
      verifyTrial5Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "UNSUPPORTED_OPERATION", result: null },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "TRANSFORMATION_MISMATCH" });
  });

  it("independently recomputes the transformation rather than trusting the stored hidden context alone", () => {
    const generated = generateStructuredDataTransformationChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "VALID" },
      { randomBytes: deterministicBytes },
    );
    const tamperedHiddenContext = {
      ...generated.hiddenContext,
      expected_result: { forged: true },
    };
    expect(() =>
      verifyTrial5Result({
        publicPayload: generated.publicPayload,
        hiddenContext: tamperedHiddenContext,
        result: { reason_code: "TRANSFORMATION_MATCH", result: { forged: true } },
      }),
    ).toThrow(Trial5VerifierInputError);
  });

  it("throws Trial5VerifierInputError for a structurally invalid persisted challenge payload", () => {
    expect(() =>
      verifyTrial5Result({
        publicPayload: { not: "a challenge" },
        hiddenContext: { case_class: "VALID", expected_reason_code: "TRANSFORMATION_MATCH", expected_result: null },
        result: { reason_code: "TRANSFORMATION_MATCH", result: null },
      }),
    ).toThrow(Trial5VerifierInputError);
  });

  it("throws Trial5VerifierInputError for a malformed submitted result shape", () => {
    const generated = generateStructuredDataTransformationChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "VALID" },
      { randomBytes: deterministicBytes },
    );
    expect(() =>
      verifyTrial5Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { reason_code: "NOT_A_REAL_REASON_CODE", result: null },
      }),
    ).toThrow(Trial5VerifierInputError);
  });

  it("reports its verifier id and version on every verdict", () => {
    const generated = generateStructuredDataTransformationChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "VALID" },
      { randomBytes: deterministicBytes },
    );
    const verification = verifyTrial5Result({
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      result: { reason_code: generated.hiddenContext.expected_reason_code, result: generated.hiddenContext.expected_result },
    });
    expect(verification.verifier_id).toBe("structured-data-transformation-verifier");
    expect(verification.verifier_version).toBe("1");
  });
});
