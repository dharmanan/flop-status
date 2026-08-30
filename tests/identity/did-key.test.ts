import { describe, expect, it } from "vitest";
import { decodeBase64Url } from "../../lib/crypto/base64url.js";
import {
  MalformedDidError,
  UnsupportedDidMethodError,
  UnsupportedKeyTypeError,
  parseEd25519DidKey,
} from "../../lib/identity/did-key.js";
import {
  ED25519_MULTICODEC_PREFIX,
  SECP256K1_MULTICODEC_PREFIX,
  buildDidKey,
  generateTestEd25519Identity,
} from "../helpers/ed25519-fixtures.js";

// Official W3C did:key spec Ed25519 example (https://w3c-ccg.github.io/did-key-spec/).
// The expected public key bytes below were independently re-derived from this
// exact string with a from-scratch base58btc decoder and cross-checked, rather
// than transcribed from memory.
const KNOWN_ED25519_DID_KEY = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";
const KNOWN_ED25519_PUBLIC_KEY_BASE64URL = "Lm_M42cB3HkUiODQsXRcweM6TByfzEHGO9ND274JcOY";

describe("parseEd25519DidKey", () => {
  it("decodes a known valid Ed25519 did:key to the expected 32 raw bytes", () => {
    const { publicKey, did } = parseEd25519DidKey(KNOWN_ED25519_DID_KEY);
    expect(publicKey.length).toBe(32);
    expect(publicKey).toEqual(decodeBase64Url(KNOWN_ED25519_PUBLIC_KEY_BASE64URL));
    expect(did).toBe(KNOWN_ED25519_DID_KEY);
  });

  it("decodes freshly generated Ed25519 did:keys back to their source public key", () => {
    const identity = generateTestEd25519Identity();
    const { publicKey } = parseEd25519DidKey(identity.did);
    expect(publicKey).toEqual(identity.publicKey);
  });

  it("rejects malformed DIDs", () => {
    expect(() => parseEd25519DidKey("")).toThrow(MalformedDidError);
    expect(() => parseEd25519DidKey("not-a-did")).toThrow(MalformedDidError);
    expect(() => parseEd25519DidKey("did:key:")).toThrow(MalformedDidError);
    expect(() => parseEd25519DidKey("did:key:Zabc")).toThrow(MalformedDidError);
    expect(() => parseEd25519DidKey("did:key:z0OIl")).toThrow(MalformedDidError);
  });

  it("rejects unsupported DID methods", () => {
    expect(() => parseEd25519DidKey("did:web:example.com")).toThrow(UnsupportedDidMethodError);
    expect(() => parseEd25519DidKey("did:ethr:0xabc123")).toThrow(UnsupportedDidMethodError);
  });

  it("rejects unsupported multicodec key types", () => {
    const fakeSecp256k1Key = new Uint8Array(33).fill(7);
    const did = buildDidKey(SECP256K1_MULTICODEC_PREFIX, fakeSecp256k1Key);
    expect(() => parseEd25519DidKey(did)).toThrow(UnsupportedKeyTypeError);
  });

  it("rejects an Ed25519-tagged key that is not exactly 32 bytes", () => {
    const identity = generateTestEd25519Identity();
    const shortKey = identity.publicKey.slice(0, 31);
    const did = buildDidKey(ED25519_MULTICODEC_PREFIX, shortKey);
    expect(() => parseEd25519DidKey(did)).toThrow(MalformedDidError);
  });
});
