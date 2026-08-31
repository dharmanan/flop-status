import { base64UrlToBytes, bytesToBase64Url } from "/identity-crypto.js";

const encoder = new TextEncoder();

export const CAPABILITY_ID = "cryptography.signature-verification";
export const CAPABILITY_VERSION = "1";
export const MODULE_ID = "ed25519-signature-verification-browser";
export const MODULE_VERSION = "1";
export const PRODUCTION_TRIAL_ID = "ed25519-signature-verification-certification";
export const TRIAL_VERSION = "1";

async function messageHash(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return "sha256:" + bytesToBase64Url(digest);
}

export async function executeEd25519SignatureVerification(input) {
  const publicKeyBytes = base64UrlToBytes(input.public_key);
  const messageBytes = base64UrlToBytes(input.message);
  const signatureBytes = base64UrlToBytes(input.signature);
  if (publicKeyBytes.length !== 32) throw new Error("Ed25519 public key must be 32 bytes");
  if (signatureBytes.length !== 64) throw new Error("Ed25519 signature must be 64 bytes");

  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicKeyBytes,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    signatureBytes,
    messageBytes,
  );
  return {
    valid,
    reason_code: valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID",
    message_hash: await messageHash(messageBytes),
  };
}

export function textMessageToBase64Url(text) {
  return bytesToBase64Url(encoder.encode(text));
}

export async function createPracticeFixture() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const message = crypto.getRandomValues(new Uint8Array(24));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, message));
  const makeInvalid = crypto.getRandomValues(new Uint8Array(1))[0] >= 128;
  if (makeInvalid) signature[0] ^= 0xff;
  return {
    input: {
      public_key: bytesToBase64Url(publicKey),
      message: bytesToBase64Url(message),
      signature: bytesToBase64Url(signature),
    },
    expected_valid: !makeInvalid,
  };
}
