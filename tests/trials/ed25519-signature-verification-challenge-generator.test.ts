import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "../../lib/crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";
import { verifyEd25519Signature } from "../../lib/crypto/ed25519.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import { DidKeyError } from "../../lib/identity/did-key.js";
import {
  CHALLENGE_TTL_MS,
  generateEd25519SignatureChallenge,
  type RandomBytesFn,
} from "../../lib/trials/ed25519-signature-verification/challenge-generator.js";
import { trial1ChallengePayloadSchema } from "../../lib/trials/ed25519-signature-verification/schema.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

function requesterDid(): string {
  return generateTestEd25519Identity().did;
}

// Small deterministic LCG for reproducibility tests only; not cryptographic.
function createDeterministicRandomBytes(seed: number): RandomBytesFn {
  let state = seed;
  return (length: number) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      bytes[i] = state & 0xff;
    }
    return bytes;
  };
}

describe("generateEd25519SignatureChallenge", () => {
  it("produces a VALID_SIGNATURE case that is actually cryptographically valid", () => {
    const result = generateEd25519SignatureChallenge({
      agentDid: requesterDid(),
      caseClass: "VALID_SIGNATURE",
    });

    expect(result.hiddenContext.case_class).toBe("VALID_SIGNATURE");
    expect(result.hiddenContext.expected_valid).toBe(true);

    const { case: signedCase } = result.publicPayload;
    const isValid = verifyEd25519Signature(
      decodeBase64Url(signedCase.public_key),
      decodeBase64Url(signedCase.message),
      decodeBase64Url(signedCase.signature),
    );
    expect(isValid).toBe(true);
  });

  it("produces an INVALID_SIGNATURE case that is structurally valid but cryptographically invalid", () => {
    const result = generateEd25519SignatureChallenge({
      agentDid: requesterDid(),
      caseClass: "INVALID_SIGNATURE",
    });

    expect(result.hiddenContext.case_class).toBe("INVALID_SIGNATURE");
    expect(result.hiddenContext.expected_valid).toBe(false);

    const { case: signedCase } = result.publicPayload;
    const publicKey = decodeBase64Url(signedCase.public_key);
    const message = decodeBase64Url(signedCase.message);
    const signature = decodeBase64Url(signedCase.signature);

    expect(publicKey.length).toBe(32);
    expect(signature.length).toBe(64);
    expect(verifyEd25519Signature(publicKey, message, signature)).toBe(false);
  });

  it("produces a public payload that passes the strict Trial 1 challenge schema for both case classes", () => {
    for (const caseClass of ["VALID_SIGNATURE", "INVALID_SIGNATURE"] as const) {
      const result = generateEd25519SignatureChallenge({ agentDid: requesterDid(), caseClass });
      expect(trial1ChallengePayloadSchema.safeParse(result.publicPayload).success).toBe(true);
    }
  });

  it("never leaks expected_valid or case_class into the public payload", () => {
    const result = generateEd25519SignatureChallenge({
      agentDid: requesterDid(),
      caseClass: "INVALID_SIGNATURE",
    });

    expect(Object.hasOwn(result.publicPayload, "expected_valid")).toBe(false);
    expect(Object.hasOwn(result.publicPayload, "case_class")).toBe(false);
    expect(JSON.stringify(result.publicPayload)).not.toContain("expected_valid");
  });

  it("generates a different challenge_id on every call", () => {
    const did = requesterDid();
    const a = generateEd25519SignatureChallenge({ agentDid: did });
    const b = generateEd25519SignatureChallenge({ agentDid: did });
    expect(a.publicPayload.challenge_id).not.toBe(b.publicPayload.challenge_id);
  });

  it("generates a different nonce on every call", () => {
    const did = requesterDid();
    const a = generateEd25519SignatureChallenge({ agentDid: did });
    const b = generateEd25519SignatureChallenge({ agentDid: did });
    expect(a.publicPayload.nonce).not.toBe(b.publicPayload.nonce);
  });

  it("sets expires_at exactly CHALLENGE_TTL_MS (10 minutes) after issued_at", () => {
    expect(CHALLENGE_TTL_MS).toBe(10 * 60 * 1000);

    const result = generateEd25519SignatureChallenge({ agentDid: requesterDid() });
    const issuedAt = new Date(result.publicPayload.issued_at).getTime();
    const expiresAt = new Date(result.publicPayload.expires_at).getTime();

    expect(expiresAt - issuedAt).toBe(CHALLENGE_TTL_MS);
  });

  it("uses the injected clock deterministically for issued_at and expires_at", () => {
    const fixedNow = new Date("2026-01-01T00:00:00.000Z");
    const result = generateEd25519SignatureChallenge(
      { agentDid: requesterDid(), caseClass: "VALID_SIGNATURE" },
      { now: () => fixedNow },
    );

    expect(result.publicPayload.issued_at).toBe("2026-01-01T00:00:00.000Z");
    expect(result.publicPayload.expires_at).toBe("2026-01-01T00:10:00.000Z");
  });

  it("reproduces challenge_id, nonce and message deterministically with injected randomness", () => {
    const input = { agentDid: requesterDid(), caseClass: "VALID_SIGNATURE" as const };

    const first = generateEd25519SignatureChallenge(input, {
      randomBytes: createDeterministicRandomBytes(42),
    });
    const second = generateEd25519SignatureChallenge(input, {
      randomBytes: createDeterministicRandomBytes(42),
    });

    expect(second.publicPayload.challenge_id).toBe(first.publicPayload.challenge_id);
    expect(second.publicPayload.nonce).toBe(first.publicPayload.nonce);
    expect(second.publicPayload.case.message).toBe(first.publicPayload.case.message);
    // Ed25519 key generation is not seeded from the injected random source
    // (Node's crypto.generateKeyPairSync takes no seed), so public_key and
    // signature intentionally still differ between the two runs.
  });

  it("changes challenge_hash when the public payload changes", () => {
    const result = generateEd25519SignatureChallenge({ agentDid: requesterDid() });

    const originalNonce = decodeBase64Url(result.publicPayload.nonce);
    const mutatedNonce = new Uint8Array(originalNonce);
    mutatedNonce[0] = mutatedNonce[0]! ^ 0xff;

    const mutatedPayload = { ...result.publicPayload, nonce: encodeBase64Url(mutatedNonce) };
    const mutatedHash = sha256(canonicalizeJsonToBytes(mutatedPayload));

    expect(mutatedHash).not.toBe(result.challengeHash);
  });

  it("produces the same hash for the same canonical public payload", () => {
    const result = generateEd25519SignatureChallenge({ agentDid: requesterDid() });
    const roundTripped = JSON.parse(JSON.stringify(result.publicPayload));
    const recomputed = sha256(canonicalizeJsonToBytes(roundTripped));

    expect(recomputed).toBe(result.challengeHash);
  });

  it("does not use malformed encoding for the invalid case: all fields stay valid base64url of the required lengths", () => {
    const result = generateEd25519SignatureChallenge({
      agentDid: requesterDid(),
      caseClass: "INVALID_SIGNATURE",
    });
    const { case: signedCase } = result.publicPayload;

    expect(() => decodeBase64Url(signedCase.public_key)).not.toThrow();
    expect(() => decodeBase64Url(signedCase.message)).not.toThrow();
    expect(() => decodeBase64Url(signedCase.signature)).not.toThrow();

    expect(decodeBase64Url(signedCase.public_key).length).toBe(32);
    expect(decodeBase64Url(signedCase.signature).length).toBe(64);
  });

  it("rejects an unsupported agent DID instead of guessing", () => {
    expect(() => generateEd25519SignatureChallenge({ agentDid: "did:web:example.com" })).toThrow(
      DidKeyError,
    );
  });

  it("supports omitting caseClass and still produces a schema-valid payload", () => {
    const result = generateEd25519SignatureChallenge({ agentDid: requesterDid() });
    expect(["VALID_SIGNATURE", "INVALID_SIGNATURE"]).toContain(result.hiddenContext.case_class);
    expect(trial1ChallengePayloadSchema.safeParse(result.publicPayload).success).toBe(true);
  });
});
