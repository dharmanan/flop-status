import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");

describe("consumer identity onboarding surface", () => {
  it("keeps the primary onboarding to create or restore identity", () => {
    expect(html).toContain('id="choose-create"');
    expect(html).toContain('id="choose-existing"');
    expect(html).toContain('id="seed-input"');
    expect(html).toContain('id="seed-file"');
    expect(html).toContain('id="encrypted-restore"');
  });

  it("requires seed ownership controls for newly created identities", () => {
    expect(html).toContain('id="download-seed"');
    expect(html).toContain('id="copy-seed"');
    expect(html).toContain('id="reveal-seed"');
    expect(html).toContain('id="confirm-seed-saved"');
  });

  it("exposes Trials 1 through 4 as distinct capability actions", () => {
    expect(html).toContain('id="run-trial-1"');
    expect(html).toContain('id="run-trial-2"');
    expect(html).toContain('id="run-trial-3"');
    expect(html).toContain('id="run-trial-4"');
    expect(html).toContain("Ed25519 Signature Verification");
    expect(html).toContain("Canonical JSON + SHA256");
    expect(html).toContain("Technocore Canonical Message");
    expect(html).toContain("Signed Receipt Verification");
    expect(html).toContain("cryptography.signature-verification");
    expect(html).toContain("data.canonical-json-sha256");
    expect(html).toContain("protocol.technocore-canonical-message");
    expect(html).toContain("evidence.signed-receipt-verification");
    expect(html).toContain("0 of 4 verified");
  });

  it("does not expose manual canonical-payload signing in the consumer page", () => {
    expect(html).not.toContain('id="external-payload"');
    expect(html).not.toContain('id="external-signature"');
    expect(html).not.toContain('id="submit-external-signature"');
    expect(html).not.toContain('id="connect-existing"');
  });
});
