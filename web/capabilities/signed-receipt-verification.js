import { base64UrlToBytes, bytesToBase64Url } from "/identity-crypto.js";
import { canonicalizeJsonToBytes } from "/capabilities/jcs.js";

export const CAPABILITY_ID = "evidence.signed-receipt-verification";
export const PRODUCTION_TRIAL_ID = "signed-receipt-verification-certification";
export const TRIAL_VERSION = "1";

async function verifyReceiptSignature(receipt, publicKeyBase64Url) {
  const { server_signature: serverSignature, ...unsigned } = receipt;
  let publicKeyBytes;
  let signatureBytes;
  try {
    publicKeyBytes = base64UrlToBytes(publicKeyBase64Url);
    signatureBytes = base64UrlToBytes(serverSignature);
  } catch {
    return false;
  }
  if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) return false;

  const key = await crypto.subtle.importKey("raw", publicKeyBytes, { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, signatureBytes, canonicalizeJsonToBytes(unsigned));
}

/**
 * The single signed receipt verification executor, used by practice,
 * certification and normal FLOP use. UNKNOWN is reserved for a receipt whose
 * declared server key is outside the supplied key set — missing key
 * material, not failed evidence — and is never reported as INVALID.
 */
export async function executeSignedReceiptVerification(input) {
  const receipt = input.receipt;
  const declared = input.server_keys.find((key) => key.key_id === receipt.server_key_id);
  if (!declared) {
    return { status: "UNKNOWN", reason_code: "SERVER_KEY_NOT_FOUND", key_id: null };
  }

  if (await verifyReceiptSignature(receipt, declared.public_key)) {
    return { status: "VALID", reason_code: "SIGNATURE_VALID", key_id: declared.key_id };
  }

  for (const key of input.server_keys) {
    if (key.key_id === declared.key_id) continue;
    if (await verifyReceiptSignature(receipt, key.public_key)) {
      return { status: "INVALID", reason_code: "KEY_ID_MISMATCH", key_id: key.key_id };
    }
  }

  return { status: "INVALID", reason_code: "SIGNATURE_INVALID", key_id: declared.key_id };
}

function practiceHash(label) {
  return "sha256:" + bytesToBase64Url(new TextEncoder().encode(label.padEnd(32, "-")).slice(0, 32));
}

async function practiceServerKey(keyId) {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return {
    public: { key_id: keyId, algorithm: "Ed25519", encoding: "base64url", public_key: bytesToBase64Url(publicKey) },
    async sign(unsigned) {
      const signature = await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, canonicalizeJsonToBytes(unsigned));
      return bytesToBase64Url(new Uint8Array(signature));
    },
  };
}

/**
 * Bounded practice fixture. The expected status is known from how the
 * fixture was constructed, not from running the capability.
 */
export async function createPracticeFixture() {
  const keyA = await practiceServerKey("flop-practice-key-a");
  const keyB = await practiceServerKey("flop-practice-key-b");

  const unsigned = {
    receipt_version: "1",
    receipt_id: crypto.randomUUID(),
    agent_did: "did:key:z6Mkpractice00000000000000000000000000000000000",
    capability_id: "practice.capability",
    trial_id: "practice-trial",
    trial_version: "1",
    challenge_id: crypto.randomUUID(),
    challenge_hash: practiceHash("practice-challenge"),
    result_hash: practiceHash("practice-result"),
    verifier_id: "practice-verifier",
    verifier_version: "1",
    verdict: "PASS",
    evidence_type: "DETERMINISTICALLY_VERIFIED",
    issued_at: new Date().toISOString(),
    server_key_id: keyA.public.key_id,
  };
  const receipt = { ...unsigned, server_signature: await keyA.sign(unsigned) };

  return {
    input: { receipt, server_keys: [keyA.public, keyB.public] },
    expected: { status: "VALID", reason_code: "SIGNATURE_VALID", key_id: keyA.public.key_id },
  };
}

export async function evaluatePractice(result, fixture) {
  return (
    result.status === fixture.expected.status &&
    result.reason_code === fixture.expected.reason_code &&
    result.key_id === fixture.expected.key_id
  );
}
