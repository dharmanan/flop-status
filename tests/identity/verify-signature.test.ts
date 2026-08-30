import { describe, expect, it } from "vitest";
import { verifyEd25519DidKeySignature } from "../../lib/identity/verify-signature.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";

describe("verifyEd25519DidKeySignature", () => {
  it("verifies a valid signature produced by the did:key's matching private key", () => {
    const identity = generateTestEd25519Identity();
    const message = new TextEncoder().encode("trial-1 challenge payload bytes");
    const signature = identity.sign(message);

    expect(verifyEd25519DidKeySignature(identity.did, message, signature)).toBe(true);
  });

  it("fails when the signed payload is modified", () => {
    const identity = generateTestEd25519Identity();
    const message = new TextEncoder().encode("trial-1 challenge payload bytes");
    const signature = identity.sign(message);
    const modifiedMessage = new TextEncoder().encode("trial-1 challenge payload byteS");

    expect(verifyEd25519DidKeySignature(identity.did, modifiedMessage, signature)).toBe(false);
  });

  it("fails when the signature is modified", () => {
    const identity = generateTestEd25519Identity();
    const message = new TextEncoder().encode("trial-1 challenge payload bytes");
    const signature = identity.sign(message);
    const modifiedSignature = new Uint8Array(signature);
    modifiedSignature[10] = modifiedSignature[10]! ^ 0xff;

    expect(verifyEd25519DidKeySignature(identity.did, message, modifiedSignature)).toBe(false);
  });

  it("propagates did:key parsing errors for unsupported identities instead of guessing", () => {
    const message = new TextEncoder().encode("x");
    const signature = new Uint8Array(64);
    expect(() =>
      verifyEd25519DidKeySignature("did:web:example.com", message, signature),
    ).toThrow();
  });
});
