import { describe, expect, it } from "vitest";
import { generateTechnocoreCanonicalMessageChallenge } from "../../lib/trials/technocore-canonical-message/challenge-generator.js";
import { CAPABILITY_ID, TRIAL_ID, TRIAL_VERSION } from "../../lib/trials/technocore-canonical-message/constants.js";
import { buildCanonicalTechnocoreMessage } from "../../lib/trials/technocore-canonical-message/protocol.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 19 + 31) & 0xff);
}

describe("Trial 3 Technocore canonical-message challenge generator", () => {
  for (const caseClass of ["WHITESPACE_CONTROL", "UNICODE_TEXT", "PIPE_TEXT", "PLAIN_TEXT"] as const) {
    it(`generates a valid ${caseClass} fixture`, () => {
      const identity = generateTestEd25519Identity();
      const now = new Date("2026-08-31T20:30:00.000Z");
      const generated = generateTechnocoreCanonicalMessageChallenge(
        { agentDid: identity.did, caseClass },
        { now: () => now, randomBytes: deterministicBytes },
      );

      expect(generated.publicPayload.agent_did).toBe(identity.did);
      expect(generated.publicPayload.capability_id).toBe(CAPABILITY_ID);
      expect(generated.publicPayload.trial_id).toBe(TRIAL_ID);
      expect(generated.publicPayload.trial_version).toBe(TRIAL_VERSION);
      expect(generated.hiddenContext.case_class).toBe(caseClass);
      expect(generated.publicPayload.expires_at).toBe("2026-08-31T20:40:00.000Z");

      const expected = buildCanonicalTechnocoreMessage(
        generated.publicPayload.case.room,
        generated.publicPayload.case.nonce,
        generated.publicPayload.case.text,
      );
      expect(generated.hiddenContext.expected_cleaned_text).toBe(expected.cleanedText);
      expect(generated.hiddenContext.expected_canonical_message).toBe(expected.canonicalMessage);
      expect(generated.challengeHash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);
    });
  }

  it("keeps sender DID outside the Technocore canonical string", () => {
    const identity = generateTestEd25519Identity();
    const generated = generateTechnocoreCanonicalMessageChallenge(
      { agentDid: identity.did, caseClass: "PLAIN_TEXT" },
      { randomBytes: deterministicBytes },
    );
    expect(generated.hiddenContext.expected_canonical_message).not.toContain(identity.did);
    expect(generated.hiddenContext.expected_canonical_message).toBe(
      `${generated.publicPayload.case.room}|${generated.publicPayload.case.nonce}|${generated.hiddenContext.expected_cleaned_text}`,
    );
  });
});
