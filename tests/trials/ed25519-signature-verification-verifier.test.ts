import { describe, expect, it } from "vitest";
import { decodeBase64Url } from "../../lib/crypto/base64url.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import { generateEd25519SignatureChallenge } from "../../lib/trials/ed25519-signature-verification/challenge-generator.js";
import {
  Trial1VerifierInputError,
  verifyTrial1Result,
} from "../../lib/trials/ed25519-signature-verification/verifier.js";

function fixture() {
  const identity = generateTestEd25519Identity();
  const generated = generateEd25519SignatureChallenge({ agentDid: identity.did });
  const result = {
    valid: generated.hiddenContext.expected_valid,
    reason_code: generated.hiddenContext.expected_valid ? "SIGNATURE_VALID" as const : "SIGNATURE_INVALID" as const,
    message_hash: sha256(decodeBase64Url(generated.publicPayload.case.message)),
  };
  return { generated, result };
}

describe("Trial 1 deterministic verifier", () => {
  it("returns PASS only when validity, reason code and exact message hash all match", () => {
    const f = fixture();
    expect(
      verifyTrial1Result({
        publicPayload: f.generated.publicPayload,
        hiddenContext: f.generated.hiddenContext,
        result: f.result,
      }),
    ).toMatchObject({ verdict: "PASS", reason_code: "EXPECTED_RESULT_MATCH" });
  });

  it("returns FAIL for an incorrect validity answer", () => {
    const f = fixture();
    expect(
      verifyTrial1Result({
        publicPayload: f.generated.publicPayload,
        hiddenContext: f.generated.hiddenContext,
        result: { ...f.result, valid: !f.result.valid },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "RESULT_VALIDITY_MISMATCH" });
  });

  it("returns FAIL for a reason code inconsistent with the submitted boolean", () => {
    const f = fixture();
    const wrong = f.result.valid ? "SIGNATURE_INVALID" as const : "SIGNATURE_VALID" as const;
    expect(
      verifyTrial1Result({
        publicPayload: f.generated.publicPayload,
        hiddenContext: f.generated.hiddenContext,
        result: { ...f.result, reason_code: wrong },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "REASON_CODE_MISMATCH" });
  });

  it("returns FAIL for a message hash not bound to the exact challenge message bytes", () => {
    const f = fixture();
    expect(
      verifyTrial1Result({
        publicPayload: f.generated.publicPayload,
        hiddenContext: f.generated.hiddenContext,
        result: { ...f.result, message_hash: sha256(new TextEncoder().encode("other")) },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "MESSAGE_HASH_MISMATCH" });
  });

  it("throws verifier input error rather than producing capability FAIL when hidden ground truth is inconsistent", () => {
    const f = fixture();
    const inconsistent = {
      expected_valid: !f.generated.hiddenContext.expected_valid,
      case_class: f.generated.hiddenContext.case_class,
    };
    expect(() =>
      verifyTrial1Result({
        publicPayload: f.generated.publicPayload,
        hiddenContext: inconsistent,
        result: f.result,
      }),
    ).toThrow(Trial1VerifierInputError);
  });
});
