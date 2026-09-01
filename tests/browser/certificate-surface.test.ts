import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRODUCTION_CAPABILITIES } from "../../lib/runtime/capability-registry.js";

const certificateJs = readFileSync(new URL("../../web/certificate.js", import.meta.url), "utf8");
const certificateHtml = readFileSync(new URL("../../web/certificate.html", import.meta.url), "utf8");
const explainerJs = readFileSync(new URL("../../web/capability-explainer.js", import.meta.url), "utf8");
const agent = readFileSync(new URL("../../web/agent.js", import.meta.url), "utf8");

describe("certificate page is capability aware for Capabilities 1-4", () => {
  it("uses the shared language source", () => {
    expect(certificateJs).toContain('import { getLanguage } from "/i18n.js"');
    expect(certificateJs).toContain("getLanguage()");
  });

  it("derives its explanation from the loaded certificate's capability id, without a second per-capability script", () => {
    expect(certificateJs).toContain("CAPABILITY_COPY[certificate.capability_id]");
    expect(certificateJs).toContain("renderMeaning(certificate.capability_id)");
    expect(certificateHtml).not.toContain("/capability-explainer.js");
    expect(certificateHtml).not.toContain("/capability2-explainer.js");
    expect(certificateHtml).not.toContain("/capability3-explainer.js");
    expect(certificateHtml).not.toContain("/capability4-explainer.js");
  });

  it("shows the WHAT DOES THIS PROVE section in both languages", () => {
    expect(certificateJs).toContain('copy("WHAT DOES THIS PROVE?", "BU NEYİ KANITLIYOR?")');
  });

  for (const capability of PRODUCTION_CAPABILITIES) {
    it(`contains human-readable proof copy for Capability ${capability.ordinal} (${capability.capabilityId})`, () => {
      expect(certificateJs).toContain(`"${capability.capabilityId}"`);
    });
  }

  it("never claims general intelligence, benchmark superiority or execution outside FLOP", () => {
    const lowered = certificateJs.toLowerCase();
    for (const phrase of ["general intelligence", "genel zekâ", "any environment", "all agents", "benchmark"]) {
      expect(lowered).not.toContain(phrase.toLowerCase());
    }
  });
});

describe("capability purpose is visible on the main lab page for Capabilities 1-4", () => {
  for (const capability of PRODUCTION_CAPABILITIES) {
    it(`declares purpose copy for Capability ${capability.ordinal}`, () => {
      expect(agent).toContain(`purposeId: "capability-${capability.ordinal}-purpose"`);
    });
  }

  it("renders the purpose text into the DOM regardless of install state", () => {
    expect(agent).toContain("byId(config.purposeId)");
    expect(agent).toContain("purpose.textContent = uiText(config.purpose.en, config.purpose.tr)");
  });

  it("shows a locked state that names the required prerequisite capability", () => {
    expect(agent).toContain('uiText("Locked", "Kilitli")');
    expect(agent).toContain("prerequisiteMet(config)");
  });

  it("keeps certificate count and cumulative rank as separate, independently derived state", () => {
    expect(agent).toContain('byId("certificate-progress")');
    expect(agent).toContain('byId("rank-progress")');
    expect(agent).toContain("certificateList?.rank");
  });
});

describe("main-page explanation covers Capabilities 1-4 without duplicating a whole file per capability", () => {
  for (const capability of PRODUCTION_CAPABILITIES) {
    it(`explains Capability ${capability.ordinal} once it is installed`, () => {
      expect(explainerJs).toContain(`number: ${capability.ordinal}`);
    });
  }

  it("is the only main-page explainer script and anchors Capability 1 to the original unsuffixed practice result", () => {
    expect(explainerJs).toContain('practiceResultId: "practice-result"');
    expect(explainerJs).toContain('practiceResultId: "practice-result-2"');
    expect(explainerJs).toContain('practiceResultId: "practice-result-3"');
    expect(explainerJs).toContain('practiceResultId: "practice-result-4"');
  });
});
