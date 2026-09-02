import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { evaluateFrameTrust, verifyTransport } from "../../web/tclk-transport.js";
import { generateTestEd25519Identity, type TestEd25519Identity } from "../helpers/ed25519-fixtures.js";

const room = "mb-p-tclk-abc0123456789def";

function signedMessage(identity: TestEd25519Identity, nonce: number, text: string) {
  const canonical = `${room}|${nonce}|${text}`;
  const sig = encodeBase64Url(identity.sign(new TextEncoder().encode(canonical)));
  return { from: identity.did, sig, nonce, text };
}

describe("verifyTransport (raw Technocore transport signature re-verification)", () => {
  it("verifies a genuinely signed transport record", async () => {
    const identity = generateTestEd25519Identity();
    const message = signedMessage(identity, 1, 'tclk1 {"type":"offer"}');
    await expect(verifyTransport(room, message)).resolves.toBe(true);
  });

  it("rejects a record whose sig does not match its claimed sender (forged from)", async () => {
    const signer = generateTestEd25519Identity();
    const victim = generateTestEd25519Identity();
    const message = signedMessage(signer, 1, 'tclk1 {"type":"offer"}');
    message.from = victim.did; // attacker claims to be the victim; the signature is still the signer's
    await expect(verifyTransport(room, message)).resolves.toBe(false);
  });

  it("rejects a record whose signature was produced for a different room (room is bound into the signed bytes)", async () => {
    const identity = generateTestEd25519Identity();
    const message = signedMessage(identity, 1, 'tclk1 {"type":"offer"}');
    await expect(verifyTransport("mb-p-tclk-someotherroom00", message)).resolves.toBe(false);
  });

  it("rejects a structurally incomplete record without throwing", async () => {
    await expect(verifyTransport(room, { from: "did:key:z1", sig: "x" })).resolves.toBe(false);
    await expect(verifyTransport(room, null)).resolves.toBe(false);
  });
});

describe("evaluateFrameTrust (frame.from must equal the transport-verified sender)", () => {
  it("trusts a frame only when the transport signature is valid and from fields agree", () => {
    const item = { from: "did:key:zVictim", frame: { from: "did:key:zVictim" } };
    const message = { from: "did:key:zVictim", sig: "s", nonce: 1, text: "t" };
    expect(evaluateFrameTrust(item, message, true)).toEqual({ fromMatches: true, trusted: true });
  });

  it("never trusts a spoofed frame.from, even with an otherwise-valid transport signature", () => {
    // The raw record really was signed by the attacker DID (transportValid: true),
    // but the decoded frame's own `from` field claims a different, victim DID.
    // This is exactly the "public-room forged from" threat from docs/threat-model.md.
    const item = { from: "did:key:zAttacker", frame: { from: "did:key:zVictim" } };
    const message = { from: "did:key:zAttacker", sig: "s", nonce: 1, text: "t" };
    expect(evaluateFrameTrust(item, message, true)).toEqual({ fromMatches: false, trusted: false });
  });

  it("never trusts matching from fields when the transport signature itself is invalid", () => {
    const item = { from: "did:key:zVictim", frame: { from: "did:key:zVictim" } };
    const message = { from: "did:key:zVictim", sig: "s", nonce: 1, text: "t" };
    expect(evaluateFrameTrust(item, message, false)).toEqual({ fromMatches: true, trusted: false });
  });

  it("never trusts when the MCP-decoded record sender disagrees with the raw transport sender", () => {
    // item.from is what the official MCP decoder reports as the record's sender;
    // message.from is the raw stored Technocore record's sender. These must also agree.
    const item = { from: "did:key:zOther", frame: { from: "did:key:zVictim" } };
    const message = { from: "did:key:zVictim", sig: "s", nonce: 1, text: "t" };
    expect(evaluateFrameTrust(item, message, true)).toEqual({ fromMatches: false, trusted: false });
  });
});
