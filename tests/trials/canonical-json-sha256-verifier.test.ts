import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "../../lib/crypto/canonical-json.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import { generateCanonicalJsonSha256Challenge } from "../../lib/trials/canonical-json-sha256/challenge-generator.js";
import { verifyTrial2Result } from "../../lib/trials/canonical-json-sha256/verifier.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function deterministicBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 31 + 7) & 0xff);
}

function fixture() {
  const identity = generateTestEd25519Identity();
  const generated = generateCanonicalJsonSha256Challenge(
    { agentDid: identity.did, caseClass: "UNICODE_KEYS" },
    {
      now: () => new Date("2026-08-31T20:30:00.000Z"),
      randomBytes: deterministicBytes,
    },
  );
  const canonical = canonicalizeJson(generated.publicPayload.case.document);
  return {
    generated,
    result: {
      canonical_json: canonical,
      sha256: sha256(new TextEncoder().encode(canonical)),
    },
  };
}

describe("Trial 2 deterministic verifier", () => {
  it("passes the exact canonical JSON and SHA256 result", () => {
    const { generated, result } = fixture();
    expect(
      verifyTrial2Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result,
      }),
    ).toMatchObject({ verdict: "PASS", reason_code: "EXPECTED_RESULT_MATCH" });
  });

  it("fails a non-canonical JSON result even when it is semantically equivalent", () => {
    const { generated, result } = fixture();
    const parsed = JSON.parse(result.canonical_json) as Record<string, unknown>;
    const reversedEntries = Object.entries(parsed).reverse();
    const nonCanonical = JSON.stringify(Object.fromEntries(reversedEntries));

    expect(
      verifyTrial2Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { ...result, canonical_json: nonCanonical },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "CANONICAL_JSON_MISMATCH" });
  });

  it("fails an incorrect SHA256 digest", () => {
    const { generated, result } = fixture();
    expect(
      verifyTrial2Result({
        publicPayload: generated.publicPayload,
        hiddenContext: generated.hiddenContext,
        result: { ...result, sha256: "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
      }),
    ).toMatchObject({ verdict: "FAIL", reason_code: "SHA256_MISMATCH" });
  });

  it("rejects persisted hidden context that disagrees with the challenge", () => {
    const { generated, result } = fixture();
    expect(() =>
      verifyTrial2Result({
        publicPayload: generated.publicPayload,
        hiddenContext: {
          ...generated.hiddenContext,
          expected_canonical_json: "{}",
        },
        result,
      }),
    ).toThrow(/hidden verifier context disagrees/i);
  });
});
