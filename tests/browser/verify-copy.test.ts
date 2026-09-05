import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../../web/verify.html", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../../web/i18n.js", import.meta.url), "utf8");
const verify = readFileSync(new URL("../../web/verify.js", import.meta.url), "utf8");

describe("public receipt verification copy", () => {
  it("uses Flop Proof product language instead of infrastructure or legacy lab language", () => {
    expect(html).toContain("← Back to Flop Proof");
    expect(html).toContain("← Flop Proof'a dön");
    expect(html).not.toContain("Capability Lab'e dön");
    expect(i18n).not.toContain("Railway API");
  });

  it("uses clear Turkish receipt labels", () => {
    expect(i18n).toContain('verify_title: "Makbuz doğrulama"');
    expect(i18n).toContain('receipt_signature: "Makbuz imzası"');
    expect(i18n).toContain('receipt_id: "Makbuz kimliği"');
    expect(i18n).toContain('trial: "Test programı"');
    expect(i18n).toContain('verifier: "Doğrulayıcı"');
  });

  it("presents internal status codes as readable proof language", () => {
    expect(verify).toContain('receipt.evidence_type === "DETERMINISTICALLY_VERIFIED" ? t("evidence_deterministic")');
    expect(verify).toContain('verificationData.server_key.status === "ACTIVE" ? t("server_key_active")');
  });
});
