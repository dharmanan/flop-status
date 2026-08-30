import { decodeBase58btc } from "../crypto/base58.js";

export const DID_KEY_PREFIX = "did:key:";
const MULTIBASE_BASE58BTC_PREFIX = "z";

// multicodec varint prefix for "ed25519-pub" (code 0xed, encoded as a 2-byte unsigned varint)
const ED25519_MULTICODEC_PREFIX = Uint8Array.of(0xed, 0x01);
const ED25519_RAW_PUBLIC_KEY_LENGTH = 32;

export class DidKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DidKeyError";
  }
}

export class MalformedDidError extends DidKeyError {
  constructor(message: string) {
    super(message);
    this.name = "MalformedDidError";
  }
}

export class UnsupportedDidMethodError extends DidKeyError {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedDidMethodError";
  }
}

export class UnsupportedKeyTypeError extends DidKeyError {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedKeyTypeError";
  }
}

export interface Ed25519DidKey {
  did: string;
  publicKey: Uint8Array;
}

function hasMulticodecPrefix(decoded: Uint8Array, prefix: Uint8Array): boolean {
  if (decoded.length < prefix.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i += 1) {
    if (decoded[i] !== prefix[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Parses a did:key string, accepting only Ed25519 keys.
 * Throws MalformedDidError, UnsupportedDidMethodError or UnsupportedKeyTypeError
 * rather than guessing or partially accepting unsupported input.
 */
export function parseEd25519DidKey(did: string): Ed25519DidKey {
  if (typeof did !== "string" || did.length === 0) {
    throw new MalformedDidError("DID must be a non-empty string");
  }
  if (!did.startsWith("did:")) {
    throw new MalformedDidError(`value is not a DID: ${JSON.stringify(did)}`);
  }
  if (!did.startsWith(DID_KEY_PREFIX)) {
    const method = did.split(":")[1] ?? "";
    throw new UnsupportedDidMethodError(`unsupported DID method: ${method || did}`);
  }

  const multibaseValue = did.slice(DID_KEY_PREFIX.length);
  if (multibaseValue.length === 0) {
    throw new MalformedDidError("did:key is missing a multibase value");
  }
  if (!multibaseValue.startsWith(MULTIBASE_BASE58BTC_PREFIX)) {
    throw new MalformedDidError(
      "unsupported multibase encoding: did:key value must use the base58btc ('z') prefix",
    );
  }

  let decoded: Uint8Array;
  try {
    decoded = decodeBase58btc(multibaseValue.slice(MULTIBASE_BASE58BTC_PREFIX.length));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new MalformedDidError(`did:key value is not valid base58btc: ${message}`);
  }

  if (!hasMulticodecPrefix(decoded, ED25519_MULTICODEC_PREFIX)) {
    const prefixHex = Buffer.from(
      decoded.slice(0, ED25519_MULTICODEC_PREFIX.length),
    ).toString("hex");
    throw new UnsupportedKeyTypeError(
      `unsupported did:key multicodec prefix: 0x${prefixHex || "<empty>"}`,
    );
  }

  const publicKey = decoded.slice(ED25519_MULTICODEC_PREFIX.length);
  if (publicKey.length !== ED25519_RAW_PUBLIC_KEY_LENGTH) {
    throw new MalformedDidError(
      `expected a ${ED25519_RAW_PUBLIC_KEY_LENGTH}-byte Ed25519 public key, got ${publicKey.length} bytes`,
    );
  }

  return { did, publicKey };
}
