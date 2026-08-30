import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { parseEd25519DidKey } from "./did-key.js";

/**
 * Verifies an Ed25519 signature against the public key extracted from a
 * supported did:key DID. Operates on exactly the bytes supplied by the caller;
 * callers are responsible for decoding message/signature bytes deterministically.
 */
export function verifyEd25519DidKeySignature(
  did: string,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  const { publicKey } = parseEd25519DidKey(did);
  return verifyEd25519Signature(publicKey, message, signature);
}
