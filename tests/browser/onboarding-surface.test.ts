import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");

describe("consumer identity and sequential production capability surface", () => {
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

  it("shows Capability 1 and Capability 2 as separate certification steps", () => {
    expect(html).toContain("Ed25519 Signature Verification");
    expect(html).toContain("cryptography.signature-verification");
    expect(html).toContain('id="acquire-capability-1"');
    expect(html).toContain('id="verify-capability-1"');
    expect(html).toContain("Canonical JSON + SHA256");
    expect(html).toContain("data.canonical-json-sha256");
    expect(html).toContain('id="capability-2-status"');
    expect(html).toContain('id="acquire-capability-2"');
    expect(html).toContain('id="practice-capability-2"');
    expect(html).toContain('id="verify-capability-2"');
    expect(html).toContain('id="capability-2-certificate"');
    expect(html).toContain('id="capability-2-use"');
  });

  it("renders Capability 2 locked by default until production state unlocks it", () => {
    expect(html).toContain('<span id="capability-2-status" class="trial-status">Locked</span>');
    expect(html).toContain('id="acquire-capability-2" type="button" hidden');
  });

  it("does not expose the old four-button development acceptance harness", () => {
    expect(html).not.toContain('id="run-trial-1"');
    expect(html).not.toContain('id="run-trial-2"');
    expect(html).not.toContain('id="run-trial-3"');
    expect(html).not.toContain('id="run-trial-4"');
    expect(html).not.toContain("0 of 4 verified");
  });

  it("does not expose manual canonical-payload signing in the consumer page", () => {
    expect(html).not.toContain('id="external-payload"');
    expect(html).not.toContain('id="external-signature"');
    expect(html).not.toContain('id="submit-external-signature"');
    expect(html).not.toContain('id="connect-existing"');
  });
});
