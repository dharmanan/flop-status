import { describe, expect, it } from "vitest";
import { PUBLIC_AGENT_SCRIPT } from "../../lib/runtime/agent-page.js";

describe("browser agent custody surface", () => {
  it("uses IndexedDB and a nonextractable WebCrypto Ed25519 private key", () => {
    expect(PUBLIC_AGENT_SCRIPT).toContain("indexedDB.open");
    expect(PUBLIC_AGENT_SCRIPT).toContain('generateKey({ name: "Ed25519" }, false');
    expect(PUBLIC_AGENT_SCRIPT).toContain("privateKey.extractable");
    expect(PUBLIC_AGENT_SCRIPT).toContain("crypto.subtle.sign");
    expect(PUBLIC_AGENT_SCRIPT).not.toContain("localStorage");
    expect(PUBLIC_AGENT_SCRIPT).not.toContain("sessionStorage");
    expect(PUBLIC_AGENT_SCRIPT).not.toContain('exportKey("jwk", identity.privateKey');
    expect(PUBLIC_AGENT_SCRIPT).not.toContain('exportKey("pkcs8", identity.privateKey');
  });

  it("runs the actual Trial 1 HTTP flow and recovers server evidence after load", () => {
    expect(PUBLIC_AGENT_SCRIPT).toContain('fetch("/api/v1/challenges"');
    expect(PUBLIC_AGENT_SCRIPT).toContain('"/submissions"');
    expect(PUBLIC_AGENT_SCRIPT).toContain('fetch("/api/v1/agents/"');
    expect(PUBLIC_AGENT_SCRIPT).toContain("Hard refresh this page to test recovery");
  });
});
