import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const certificateHtml = readFileSync(new URL("../../web/certificate.html", import.meta.url), "utf8");
const certificateJs = readFileSync(new URL("../../web/certificate.js", import.meta.url), "utf8");
const explainerJs = readFileSync(new URL("../../web/capability-explainer.js", import.meta.url), "utf8");

describe("certificate language surface", () => {
  it("uses the shared language source for certificate scripts", () => {
    expect(certificateJs).toContain('import { getLanguage } from "/i18n.js"');
    expect(certificateJs).toContain("return getLanguage()");
    expect(explainerJs).toContain('import { getLanguage } from "/i18n.js"');
    expect(explainerJs).toContain("return getLanguage()");
  });

  it("cache-busts the localized certificate scripts", () => {
    expect(certificateHtml).toContain("/certificate.js?v=capability1-certificate-v3");
    expect(certificateHtml).toContain("/capability-explainer.js?v=capability1-explainer-v5");
  });
});
