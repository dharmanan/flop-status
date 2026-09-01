import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const certificateHtml = readFileSync(new URL("../../web/certificate.html", import.meta.url), "utf8");
const certificateJs = readFileSync(new URL("../../web/certificate.js", import.meta.url), "utf8");

describe("certificate language and capability-specific proof surface", () => {
  it("uses the shared language source", () => {
    expect(certificateJs).toContain('import { getLanguage } from "/i18n.js"');
    expect(certificateJs).toContain("getLanguage()");
  });

  it("localizes proof labels without a second certificate-page explainer script", () => {
    expect(certificateJs).toContain("PROOF_LABELS");
    expect(certificateJs).toContain("localizeProofLabels");
    expect(certificateHtml).not.toContain("/capability-explainer.js");
  });

  it("contains human-readable proof copy for Capability 1 and Capability 2", () => {
    expect(certificateJs).toContain('"cryptography.signature-verification"');
    expect(certificateJs).toContain('"data.canonical-json-sha256"');
    expect(certificateJs).toContain("Canonical JSON + SHA256 Sertifikası");
    expect(certificateJs).toContain("BU NEYİ KANITLIYOR?");
  });

  it("cache-busts the Capability 2 certificate script", () => {
    expect(certificateHtml).toContain("/certificate.js?v=capability2-certificate-v2");
  });
});
