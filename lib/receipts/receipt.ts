import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { decodeBase64Url } from "../crypto/base64url.js";
import { ED25519_PUBLIC_KEY_LENGTH, ED25519_SIGNATURE_LENGTH, verifyEd25519Signature } from "../crypto/ed25519.js";

export const RECEIPT_VERSION = "1" as const;
export const RECEIPT_EVIDENCE_TYPE = "DETERMINISTICALLY_VERIFIED" as const;

export interface UnsignedPassReceipt {
  receipt_version: typeof RECEIPT_VERSION;
  receipt_id: string;
  agent_did: string;
  capability_id: string;
  trial_id: string;
  trial_version: string;
  challenge_id: string;
  challenge_hash: string;
  result_hash: string;
  verifier_id: string;
  verifier_version: string;
  verdict: "PASS";
  evidence_type: typeof RECEIPT_EVIDENCE_TYPE;
  issued_at: string;
  server_key_id: string;
}

export interface SignedPassReceipt extends UnsignedPassReceipt {
  server_signature: string;
}

export interface AttestationSigner {
  keyId: string;
  algorithm: "Ed25519";
  publicKeyEncoding: "base64url";
  publicKey: string;
  sign(message: Uint8Array): string;
}

export function signPassReceipt(
  unsignedReceipt: UnsignedPassReceipt,
  signer: AttestationSigner,
): SignedPassReceipt {
  const publicKey = decodeBase64Url(signer.publicKey);
  if (publicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new Error(`attestation public key must be ${ED25519_PUBLIC_KEY_LENGTH} bytes`);
  }
  if (unsignedReceipt.server_key_id !== signer.keyId) {
    throw new Error("receipt server_key_id does not match active signer key id");
  }

  const signature = signer.sign(canonicalizeJsonToBytes(unsignedReceipt));
  const signatureBytes = decodeBase64Url(signature);
  if (signatureBytes.length !== ED25519_SIGNATURE_LENGTH) {
    throw new Error(`attestation signature must be ${ED25519_SIGNATURE_LENGTH} bytes`);
  }

  return { ...unsignedReceipt, server_signature: signature };
}

export function verifyPassReceiptSignature(
  receipt: SignedPassReceipt,
  publicKeyBase64Url: string,
): boolean {
  const { server_signature, ...unsignedReceipt } = receipt;
  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = decodeBase64Url(publicKeyBase64Url);
    signature = decodeBase64Url(server_signature);
  } catch {
    return false;
  }
  if (publicKey.length !== ED25519_PUBLIC_KEY_LENGTH || signature.length !== ED25519_SIGNATURE_LENGTH) {
    return false;
  }
  return verifyEd25519Signature(publicKey, canonicalizeJsonToBytes(unsignedReceipt), signature);
}
