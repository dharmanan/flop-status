import { describe, expect, it } from "vitest";
import { generateSignedReceiptVerificationChallenge } from "../../lib/trials/signed-receipt-verification/challenge-generator.js";
import { verifyTrial4Result } from "../../lib/trials/signed-receipt-verification/verifier.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 23 + 11) & 0xff);
}

describe("Trial 4 signed receipt verification verifier", () => {
  for (const caseClass of ["VALID", "TAMPERED_FIELD", "KEY_ID_MISMATCH", "UNKNOWN_KEY"] as const) {
    it(`passes the exact expected ${caseClass} result`, () => {
      const generated = generateSignedReceiptVerificationChallenge(
        { agentDid: generateTestEd25519Identity().did, caseClass },
        { now: () => new Date("2026-08-31T21:10:00.000Z"), randomBytes: deterministicBytes },
      );
      const result = {
        status: generated.hiddenContext.expected_status,
        reason_code: generated.hiddenContext.expected_reason_code,
        key_id: generated.hiddenContext.expected_key_id,
      };
      expect(verifyTrial4Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result,
      })).toMatchObject({ verdict: "PASS", reason_code: "EXPECTED_RESULT_MATCH" });
    });
  }

  it("fails a wrong status without turning verifier infrastructure into UNKNOWN", () => {
    const generated = generateSignedReceiptVerificationChallenge(
      { agentDid: generateTestEd25519Identity().did, caseClass: "VALID" },
      { randomBytes: deterministicBytes },
    );
    expect(verifyTrial4Result({
      publicPayload: generated.publicPayload,
      hiddenContext: generated.hiddenContext,
      result: { status: "INVALID", reason_code: "SIGNATURE_VALID", key_id: generated.hiddenContext.expected_key_id },
    })).toMatchObject({ verdict: "FAIL", reason_code: "STATUS_MISMATCH" });
  });
});
