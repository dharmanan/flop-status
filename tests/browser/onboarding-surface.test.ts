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

  it("does not expose manual canonical-payload signing in the consumer page", () => {
    expect(html).not.toContain('id="external-payload"');
    expect(html).not.toContain('id="external-signature"');
    expect(html).not.toContain('id="submit-external-signature"');
    expect(html).not.toContain('id="connect-existing"');
  });
});
