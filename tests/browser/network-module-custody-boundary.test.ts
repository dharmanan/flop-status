import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Companion to network-custody-boundary.test.ts, which only covers agent.js and
// the capability modules. TCLK Deals, Mailbox and Agent Network are separate
// browser files with their own signing/network call sites and were not covered
// by that file at all — this closes that gap for the same class of claim:
// the active private key (and, for TCLK, the seed/backup material it is derived
// from) must never be serialized into a request body sent anywhere.
const FILES: Record<string, string> = {
  "tclk-deals.js": readFileSync(new URL("../../web/tclk-deals.js", import.meta.url), "utf8"),
  "mailbox-nav.js": readFileSync(new URL("../../web/mailbox-nav.js", import.meta.url), "utf8"),
  "communication-nav.js": readFileSync(new URL("../../web/communication-nav.js", import.meta.url), "utf8"),
  "agent-profile-ui.js": readFileSync(new URL("../../web/agent-profile-ui.js", import.meta.url), "utf8"),
};

describe("TCLK / Mailbox / Agent Network browser custody boundary", () => {
  it("never serializes private key, seed or JWK material into a request body", () => {
    for (const [file, text] of Object.entries(FILES)) {
      expect(text, file).not.toMatch(/JSON\.stringify\([^)]*(seedHex|privateKey|private_jwk|privateKeyBase64Url|passphrase)/s);
      expect(text, file).not.toMatch(/body:\s*JSON\.stringify\([^)]*(seedHex|privateKey|private_jwk|privateKeyBase64Url|passphrase)/s);
    }
  });

  it("signs locally with crypto.subtle.sign using the active (non-extractable) private key", () => {
    for (const [file, text] of Object.entries(FILES)) {
      expect(text, file).toMatch(/crypto\.subtle\.sign\(\s*\{\s*name:\s*"Ed25519"\s*\}\s*,\s*id(entity)?\.privateKey/);
    }
  });

  it("never exports or reads raw bytes out of the active private key", () => {
    for (const [file, text] of Object.entries(FILES)) {
      expect(text, file).not.toMatch(/exportKey\([^)]*private/i);
      expect(text, file).not.toContain(".privateKey.d");
    }
  });

  it("the TCLK hash-lock secret is only persisted to the dedicated browser-local IndexedDB store", () => {
    const text = FILES["tclk-deals.js"];
    expect(text).toContain('indexedDB.open(SECRET_DB, 1)');
    expect(text).toContain("SECRET_DB = \"flop-tclk-deals-v1\"");
    expect(text).not.toMatch(/localStorage\.[gs]etItem\([^)]*secret/i);
  });
});
