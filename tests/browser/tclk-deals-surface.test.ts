import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deals = readFileSync(new URL("../../web/tclk-deals.js", import.meta.url), "utf8");
const network = readFileSync(new URL("../../web/communication-nav.js", import.meta.url), "utf8");
const profileHint = readFileSync(new URL("../../web/tclk-profile-hint.js", import.meta.url), "utf8");
const transport = readFileSync(new URL("../../web/tclk-transport.js", import.meta.url), "utf8");

describe("TCLK Deals browser surface", () => {
  it("loads Deals as a network primitive, not a capability", () => {
    expect(network).toContain('import("/tclk-deals.js?v=tclk-deals-v1")');
    expect(network).toContain('import("/tclk-profile-hint.js?v=tclk-deals-v1")');
    expect(deals).toContain('copy("Deals", "Anlaşmalar")');
    expect(deals).toContain("tclk-workspace");
    expect(deals).not.toContain("Capability 8");
  });

  it("keeps protocol metadata in the Deals header, not the Agent Status card", () => {
    expect(profileHint).toContain('protocol.textContent = "TCLK 1"');
    expect(profileHint).toContain('rail.textContent = "PAPERRAIL"');
    expect(profileHint).toContain('alpha.textContent = "ALPHA"');
    expect(profileHint).toContain('lock.textContent = copy("HASH LOCK", "HASH KİLİDİ")');
    expect(profileHint).not.toContain("agent-protocol-hint");
    expect(profileHint).not.toContain("agent-status-card");
  });

  it("uses official rooms and replays board records through the official state machine", () => {
    expect(deals).toContain('const OFFER_ROOM = "tclk-offers"');
    expect(deals).toContain('tool("tclk_apply_transcript"');
    expect(deals).toContain('`mb-p-tclk-${contract.slice(2, 18)}`');
    expect(deals).toContain("boardRecords.map((record) => record.line)");
  });

  it("signs the official transport challenge locally and re-verifies raw Technocore signatures", () => {
    expect(deals).toContain("challenge.canonical");
    expect(deals).toContain("crypto.subtle.sign");
    expect(deals).toContain('import { evaluateFrameTrust, verifyTransport } from "/tclk-transport.js"');
    expect(transport).toContain('encoder.encode(`${room}|${message.nonce}|${message.text}`)');
    expect(transport).toContain("fromMatches = item?.frame?.from === item?.from && item?.from === message.from");
    expect(transport).toContain("trusted: Boolean(transportValid) && fromMatches");
    expect(deals).not.toContain("TECHNOCORE_SIGNING_KEY");
    expect(deals).not.toContain("TCLK_PAYMENT_KEY");
  });

  it("keeps acceptance secrets browser-local and PaperRail explicitly no-value", () => {
    expect(deals).toContain('const SECRET_DB = "flop-tclk-deals-v1"');
    expect(deals).toContain("await saveSecret(accepted.contract, accepted.secret)");
    expect(deals).toContain('copy("No real funds", "Gerçek para yok")');
    expect(deals).toContain('lock: "hash"');
    expect(deals).toContain('rails: ["paper"]');
    expect(deals).not.toContain("schnorrAdaptor");
  });

  it("resumes a matching PaperRail lock after a lost LOCK-frame post", () => {
    expect(deals).toContain("async function ensurePaperLock(terms)");
    expect(deals).toContain('error.code !== "PAPER_RECORD_EXISTS"');
    expect(deals).toContain("await readPaper(terms.contract)");
    expect(deals).toContain("existing.statement !== terms.statement");
    expect(deals).toContain("await ensurePaperLock({ contract: accept.contract");
  });
});
