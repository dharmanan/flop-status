import { describe, expect, it } from "vitest";
import { generateSignedReceiptVerificationChallenge } from "../../lib/trials/signed-receipt-verification/challenge-generator.js";
import { CAPABILITY_ID, TRIAL_ID, TRIAL_VERSION } from "../../lib/trials/signed-receipt-verification/constants.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 19 + 7) & 0xff);
}

describe("Trial 4 signed receipt verification challenge generator", () => {
  for (const caseClass of ["VALID", "TAMPERED_FIELD", "KEY_ID_MISMATCH", "UNKNOWN_KEY"] as const) {
    it(`generates a bounded ${caseClass} challenge`, () => {
      const identity = generateTestEd25519Identity();
      const generated = generateSignedReceiptVerificationChallenge(
        { agentDid: identity.did, caseClass },
        { now: () => new Date("2026-08-31T21:00:00.000Z"), randomBytes: deterministicBytes },
      );
      expect(generated.publicPayload.agent_did).toBe(identity.did);
      expect(generated.publicPayload.capability_id).toBe(CAPABILITY_ID);
      expect(generated.publicPayload.trial_id).toBe(TRIAL_ID);
      expect(generated.publicPayload.trial_version).toBe(TRIAL_VERSION);
      expect(generated.publicPayload.case.server_keys.length).toBeGreaterThanOrEqual(1);
      expect(generated.hiddenContext.case_class).toBe(caseClass);
      expect(generated.challengeHash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);
    });
  }
});
