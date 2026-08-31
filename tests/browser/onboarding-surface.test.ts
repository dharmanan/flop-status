import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");

describe("consumer identity and production capability surface", () => {
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

  it("starts the production certificate journey at Capability 1 only", () => {
    expect(html).toContain("Ed25519 Signature Verification");
    expect(html).toContain("cryptography.signature-verification");
    expect(html).toContain('id="acquire-capability-1"');
    expect(html).toContain('id="practice-capability-1"');
    expect(html).toContain('id="verify-capability-1"');
    expect(html).toContain('id="capability-1-certificate"');
    expect(html).toContain('id="capability-1-use"');
    expect(html).toContain("0 certificates");
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
