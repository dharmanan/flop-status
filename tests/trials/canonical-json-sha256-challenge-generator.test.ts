import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "../../lib/crypto/canonical-json.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import { generateCanonicalJsonSha256Challenge } from "../../lib/trials/canonical-json-sha256/challenge-generator.js";
import {
  CAPABILITY_ID,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../../lib/trials/canonical-json-sha256/constants.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 17 + 29) & 0xff);
}

describe("Trial 2 canonical JSON + SHA256 challenge generator", () => {
  for (const caseClass of ["NESTED_OBJECT", "UNICODE_KEYS", "ARRAY_MIX", "NUMERIC_EDGE"] as const) {
    it(`generates a valid ${caseClass} challenge with hidden expected result`, () => {
      const identity = generateTestEd25519Identity();
      const now = new Date("2026-08-31T20:00:00.000Z");
      const generated = generateCanonicalJsonSha256Challenge(
        { agentDid: identity.did, caseClass },
        { now: () => now, randomBytes: deterministicBytes },
      );

      expect(generated.publicPayload.agent_did).toBe(identity.did);
      expect(generated.publicPayload.capability_id).toBe(CAPABILITY_ID);
      expect(generated.publicPayload.trial_id).toBe(TRIAL_ID);
      expect(generated.publicPayload.trial_version).toBe(TRIAL_VERSION);
      expect(generated.publicPayload.case.document).toBeDefined();
      expect(generated.hiddenContext.case_class).toBe(caseClass);

      const canonical = canonicalizeJson(generated.publicPayload.case.document);
      expect(generated.hiddenContext.expected_canonical_json).toBe(canonical);
      expect(generated.hiddenContext.expected_sha256).toBe(
        sha256(new TextEncoder().encode(canonical)),
      );
      expect(generated.challengeHash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);
      expect(generated.publicPayload.expires_at).toBe("2026-08-31T20:10:00.000Z");
    });
  }

  it("rejects unsupported DID methods before challenge generation", () => {
    expect(() =>
      generateCanonicalJsonSha256Challenge({ agentDid: "did:web:example.com" }),
    ).toThrow();
  });
});
