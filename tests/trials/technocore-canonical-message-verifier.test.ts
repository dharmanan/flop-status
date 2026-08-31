import { describe, expect, it } from "vitest";
import { generateTechnocoreCanonicalMessageChallenge } from "../../lib/trials/technocore-canonical-message/challenge-generator.js";
import { verifyTrial3Result, Trial3VerifierInputError } from "../../lib/trials/technocore-canonical-message/verifier.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 23 + 7) & 0xff);
}

function fixture() {
  const identity = generateTestEd25519Identity();
  return generateTechnocoreCanonicalMessageChallenge(
    { agentDid: identity.did, caseClass: "WHITESPACE_CONTROL" },
    { randomBytes: deterministicBytes },
  );
}

describe("Trial 3 Technocore canonical-message verifier", () => {
  it("passes exact cleaned text and canonical message", () => {
    const generated = fixture();
    const result = verifyTrial3Result({
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      result: {
        cleaned_text: generated.hiddenContext.expected_cleaned_text,
        canonical_message: generated.hiddenContext.expected_canonical_message,
      },
    });
    expect(result).toMatchObject({ verdict: "PASS", reason_code: "EXPECTED_RESULT_MATCH" });
  });

  it("fails a cleaned-text mismatch", () => {
    const generated = fixture();
    const result = verifyTrial3Result({
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      result: {
        cleaned_text: generated.hiddenContext.expected_cleaned_text + "x",
        canonical_message: generated.hiddenContext.expected_canonical_message,
      },
    });
    expect(result).toMatchObject({ verdict: "FAIL", reason_code: "CLEANED_TEXT_MISMATCH" });
  });

  it("fails a canonical-message mismatch", () => {
    const generated = fixture();
    const result = verifyTrial3Result({
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      result: {
        cleaned_text: generated.hiddenContext.expected_cleaned_text,
        canonical_message: generated.hiddenContext.expected_canonical_message + "x",
      },
    });
    expect(result).toMatchObject({ verdict: "FAIL", reason_code: "CANONICAL_MESSAGE_MISMATCH" });
  });

  it("rejects tampered hidden verifier context as internal input error", () => {
    const generated = fixture();
    expect(() => verifyTrial3Result({
      publicPayload: generated.publicPayload,
      hiddenContext: {
        ...generated.hiddenContext,
        expected_canonical_message: "tampered",
      },
      result: {
        cleaned_text: generated.hiddenContext.expected_cleaned_text,
        canonical_message: generated.hiddenContext.expected_canonical_message,
      },
    })).toThrow(Trial3VerifierInputError);
  });
});
