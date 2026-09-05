import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const network = readFileSync(new URL("../../web/communication-nav.js", import.meta.url), "utf8");
const mailbox = readFileSync(new URL("../../web/mailbox-nav.js", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../../web/app-shell-navigation.js", import.meta.url), "utf8");

describe("Agent Network browser surface", () => {
  it("loads as a product/network workspace, not Capability 8", () => {
    expect(navigation).toContain('import("/communication-nav.js?v=agent-network-v5")');
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
    expect(network).toContain('signedAction("CREATE_ROOM"');
    expect(network).toContain('signedAction("LIST_ROOMS"');
    expect(network).toContain('signedAction("LIST_MESSAGES"');
    expect(network).toContain('signedAction("SEND_MESSAGE"');
  });

  it("independently verifies stored sender signatures using the sender DID public key", () => {
    expect(network).toContain("parseEd25519DidKey(message.senderDid)");
    expect(network).toContain('crypto.subtle.importKey("raw", rawKey');
    expect(network).toContain("crypto.subtle.verify(");
    expect(network).toContain('action: "SEND_MESSAGE"');
    expect(network).toContain("message.senderSignature");
  });

  it("uses profiles only as presentation metadata while keeping DID visible as technical identity", () => {
    expect(network).toContain("window.FLOPAgentProfiles?.profileForDid?.(did)");
    expect(network).toContain("decorateNetworkIdentity");
    expect(network).toContain("profile.displayName");
    expect(network).toContain('`@${profile.handle}`');
    expect(network).toContain("network-identity-did");
    expect(network).toContain("message.senderDid");
  });

  it("does not drop owner/profile decoration just because async profile resolution beats DOM attachment", () => {
    expect(network).not.toContain("if (!container.isConnected) return");
    expect(network).toContain("container.replaceChildren()");
  });

  it("keeps Mailbox, Agent Network, and Deals mutually exclusive", () => {
    expect(network).toContain('shell.querySelector(".mailbox-workspace")');
    expect(network).toContain('shell.querySelector(".tclk-workspace")');
    expect(network).toContain('shell.classList.remove("mailbox-mode", "tclk-mode")');
    expect(network).toContain('shell.querySelector(".mailbox-entry")?.classList.remove("active")');
    expect(network).toContain('shell.querySelector(".tclk-entry")?.classList.remove("active")');

    expect(mailbox).toContain('shell.querySelector(".communication-workspace")');
    expect(mailbox).toContain('shell.querySelector(".tclk-workspace")');
    expect(mailbox).toContain('shell.classList.remove("network-mode","tclk-mode")');
    expect(mailbox).toContain('shell.querySelector(".network-entry")?.classList.remove("active")');
    expect(mailbox).toContain('shell.querySelector(".tclk-entry")?.classList.remove("active")');
  });

  it("keeps room-message proof labels human-readable in Turkish without changing cryptographic verification", () => {
    expect(network).toContain('copy("SIGNATURE VALID", "İMZA GEÇERLİ")');
    expect(network).toContain('copy("INTEGRITY STORED", "BÜTÜNLÜK KAYITLI")');
    expect(network).toContain('copy("Signed with your active DID · verified with C3", "Aktif DID\'inle imzalanır · C3 ile doğrulanır")');
  });

  it("creates a fresh nonce and timestamp for every signed communication action", () => {
    expect(network).toContain("nonce: crypto.randomUUID()");
    expect(network).toContain("issued_at: new Date().toISOString()");
  });
});
