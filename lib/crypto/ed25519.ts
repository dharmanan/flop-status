import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { encodeBase64Url } from "./base64url.js";

export class Ed25519Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ed25519Error";
  }
}

export const ED25519_PUBLIC_KEY_LENGTH = 32;
export const ED25519_SIGNATURE_LENGTH = 64;

export function verifyEd25519Signature(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  if (publicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new Ed25519Error(
      `Ed25519 public key must be ${ED25519_PUBLIC_KEY_LENGTH} bytes, got ${publicKey.length}`,
    );
  }
  if (signature.length !== ED25519_SIGNATURE_LENGTH) {
    throw new Ed25519Error(
      `Ed25519 signature must be ${ED25519_SIGNATURE_LENGTH} bytes, got ${signature.length}`,
    );
  }

  const keyObject = createPublicKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      x: encodeBase64Url(publicKey),
    },
    format: "jwk",
  });

  return cryptoVerify(null, Buffer.from(message), keyObject, Buffer.from(signature));
}
