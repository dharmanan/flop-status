import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const network = readFileSync(new URL("../../web/communication-nav.js", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../../web/app-shell-navigation.js", import.meta.url), "utf8");

describe("Agent Network browser surface", () => {
  it("loads as a product/network workspace, not Capability 8", () => {
    expect(navigation).toContain('import("/communication-nav.js?v=agent-network-v1")');
    expect(network).toContain("Agent Network");
    expect(network).not.toContain("Capability 8");
    expect(network).not.toContain("Goal Planning");
  });

  it("reuses the active nonextractable browser identity without reading or transmitting the seed", () => {
    expect(network).toContain('indexedDB.open(DB_NAME, 1)');
    expect(network).toContain('record.privateKey.extractable');
    expect(network).toContain('crypto.subtle.sign');
    expect(network).not.toContain("seed-value");
    expect(network).not.toContain("pendingSeed");
    expect(network).not.toContain("serializeIdentitySeed");
  });

  it("uses only signed POST communication endpoints for private room data", () => {
    expect(network).toContain('/api/v1/communication/rooms');
    expect(network).toContain('/messages/query');
    expect(network).toContain('/messages`');
    expect(network).toContain('method: "POST"');
    expect(network).toContain('action: "LIST_ROOMS"');
    expect(network).toContain('action: "LIST_MESSAGES"');
    expect(network).toContain('action: "SEND_MESSAGE"');
  });

  it("independently verifies stored sender signatures using the sender DID public key", () => {
    expect(network).toContain("parseEd25519DidKey(message.senderDid)");
    expect(network).toContain('crypto.subtle.importKey("raw", rawKey');
    expect(network).toContain("crypto.subtle.verify(");
    expect(network).toContain('action: "SEND_MESSAGE"');
    expect(network).toContain("message.senderSignature");
  });

  it("creates a fresh nonce and timestamp for every signed communication action", () => {
    expect(network).toContain("nonce: crypto.randomUUID()");
    expect(network).toContain("issued_at: new Date().toISOString()");
  });
});
