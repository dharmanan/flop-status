import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { sha256 } from "../../lib/crypto/sha256.js";
import {
  signPassReceipt,
  verifyPassReceiptSignature,
  type AttestationSigner,
  type UnsignedPassReceipt,
} from "../../lib/receipts/receipt.js";

function signer(): AttestationSigner {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  return {
    keyId: "test-key-1",
    algorithm: "Ed25519",
    publicKeyEncoding: "base64url",
    publicKey: jwk.x,
    sign(bytes) {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(bytes), privateKey)));
    },
  };
}

function unsigned(keyId: string): UnsignedPassReceipt {
  return {
    receipt_version: "1",
    receipt_id: "11111111-1111-4111-8111-111111111111",
    agent_did: "did:key:z6MkhW5V7fFakeForReceiptShapeOnly",
    capability_id: "cryptography.signature-verification",
    trial_id: "ed25519-signature-verification",
    trial_version: "1",
    challenge_id: "22222222-2222-4222-8222-222222222222",
    challenge_hash: sha256(new TextEncoder().encode("challenge")),
    result_hash: sha256(new TextEncoder().encode("result")),
    verifier_id: "ed25519-signature-verifier",
    verifier_version: "1",
    verdict: "PASS",
    evidence_type: "DETERMINISTICALLY_VERIFIED",
    issued_at: "2026-08-31T07:00:00.000Z",
    server_key_id: keyId,
  };
}

describe("PASS receipt cryptography", () => {
  it("signs RFC 8785 canonical receipt bytes and verifies with the matching public key", () => {
    const key = signer();
    const receipt = signPassReceipt(unsigned(key.keyId), key);
    expect(verifyPassReceiptSignature(receipt, key.publicKey)).toBe(true);
  });

  it("rejects a modified signed receipt field", () => {
    const key = signer();
    const receipt = signPassReceipt(unsigned(key.keyId), key);
    const tampered = { ...receipt, result_hash: sha256(new TextEncoder().encode("other")) };
    expect(verifyPassReceiptSignature(tampered, key.publicKey)).toBe(false);
  });

  it("rejects a modified server signature", () => {
    const key = signer();
    const receipt = signPassReceipt(unsigned(key.keyId), key);
    const bytes = new Uint8Array(64);
    bytes.fill(7);
    expect(
      verifyPassReceiptSignature({ ...receipt, server_signature: encodeBase64Url(bytes) }, key.publicKey),
    ).toBe(false);
  });
});
