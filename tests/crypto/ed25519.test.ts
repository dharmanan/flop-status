import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeBase64Url } from "../../lib/crypto/base64url.js";
import { Ed25519Error, verifyEd25519Signature } from "../../lib/crypto/ed25519.js";

function generateRawKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  return { rawPublicKey: decodeBase64Url(jwk.x), privateKey };
}

describe("verifyEd25519Signature", () => {
  it("verifies a valid signature over exact message bytes", () => {
    const { rawPublicKey, privateKey } = generateRawKeyPair();
    const message = new TextEncoder().encode("flop capability lab trial 1");
    const signature = new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey));

    expect(verifyEd25519Signature(rawPublicKey, message, signature)).toBe(true);
  });

  it("rejects a valid signature applied to a modified message", () => {
    const { rawPublicKey, privateKey } = generateRawKeyPair();
    const message = new TextEncoder().encode("original message");
    const tampered = new TextEncoder().encode("original messagE");
    const signature = new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey));

    expect(verifyEd25519Signature(rawPublicKey, tampered, signature)).toBe(false);
  });

  it("rejects a tampered signature over the original message", () => {
    const { rawPublicKey, privateKey } = generateRawKeyPair();
    const message = new TextEncoder().encode("original message");
    const signature = new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey));
    const tamperedSignature = new Uint8Array(signature);
    tamperedSignature[10] = tamperedSignature[10]! ^ 0xff;

    expect(verifyEd25519Signature(rawPublicKey, message, tamperedSignature)).toBe(false);
  });

  it("throws on an incorrectly sized public key", () => {
    const { privateKey } = generateRawKeyPair();
    const message = new TextEncoder().encode("x");
    const signature = new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey));
    expect(() => verifyEd25519Signature(new Uint8Array(31), message, signature)).toThrow(
      Ed25519Error,
    );
  });

  it("throws on an incorrectly sized signature", () => {
    const { rawPublicKey } = generateRawKeyPair();
    const message = new TextEncoder().encode("x");
    expect(() => verifyEd25519Signature(rawPublicKey, message, new Uint8Array(63))).toThrow(
      Ed25519Error,
    );
  });
});
