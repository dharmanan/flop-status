import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");

const CAPABILITY_ROWS = [
  { ordinal: 1, name: "Ed25519 Signature Verification", capabilityId: "cryptography.signature-verification" },
  { ordinal: 2, name: "Canonical JSON + SHA256", capabilityId: "data.canonical-json-sha256" },
  { ordinal: 3, name: "Technocore Canonical Message", capabilityId: "protocol.technocore-canonical-message" },
  { ordinal: 4, name: "Signed Receipt Verification", capabilityId: "evidence.signed-receipt-verification" },
];

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

  for (const row of CAPABILITY_ROWS) {
    it(`exposes the full Capability ${row.ordinal} lifecycle`, () => {
      expect(html).toContain(row.name);
      expect(html).toContain(row.capabilityId);
      expect(html).toContain(`id="acquire-capability-${row.ordinal}"`);
      expect(html).toContain(`id="practice-capability-${row.ordinal}"`);
      expect(html).toContain(`id="verify-capability-${row.ordinal}"`);
      expect(html).toContain(`id="capability-${row.ordinal}-certificate"`);
      expect(html).toContain(`id="capability-${row.ordinal}-use"`);
      expect(html).toContain(`id="capability-${row.ordinal}-purpose"`);
      expect(html).toContain(`id="capability-${row.ordinal}-flow"`);
    });
  }

  it("does not start any Capability 5 or later surface", () => {
    expect(html).not.toContain('id="acquire-capability-5"');
    expect(html).not.toContain("structured.data-transformation");
    expect(html).not.toContain("constraint.policy-compliance");
  });

  it("shows certificate count and cumulative rank as separate product state", () => {
    expect(html).toContain('id="certificate-progress"');
    expect(html).toContain('id="rank-progress"');
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
