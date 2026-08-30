import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { encodeBase58btc } from "../../lib/crypto/base58.js";
import { decodeBase64Url } from "../../lib/crypto/base64url.js";
import { DID_KEY_PREFIX } from "../../lib/identity/did-key.js";

export const ED25519_MULTICODEC_PREFIX = Uint8Array.of(0xed, 0x01);
// secp256k1-pub multicodec prefix (code 0xe7 as a 2-byte varint), used only to
// build a synthetic did:key for testing rejection of unsupported key types.
export const SECP256K1_MULTICODEC_PREFIX = Uint8Array.of(0xe7, 0x01);

export interface TestEd25519Identity {
  did: string;
  publicKey: Uint8Array;
  sign(message: Uint8Array): Uint8Array;
}

export function buildDidKey(multicodecPrefix: Uint8Array, keyBytes: Uint8Array): string {
  const prefixed = new Uint8Array(multicodecPrefix.length + keyBytes.length);
  prefixed.set(multicodecPrefix, 0);
  prefixed.set(keyBytes, multicodecPrefix.length);
  return `${DID_KEY_PREFIX}z${encodeBase58btc(prefixed)}`;
}

export function generateTestEd25519Identity(): TestEd25519Identity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const rawPublicKey = decodeBase64Url(jwk.x);

  return {
    did: buildDidKey(ED25519_MULTICODEC_PREFIX, rawPublicKey),
    publicKey: rawPublicKey,
    sign(message: Uint8Array): Uint8Array {
      return new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey));
    },
  };
}
