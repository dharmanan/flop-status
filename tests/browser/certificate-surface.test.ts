import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRODUCTION_CAPABILITIES } from "../../lib/runtime/capability-registry.js";

const certificateJs = readFileSync(new URL("../../web/certificate.js", import.meta.url), "utf8");
const certificateHtml = readFileSync(new URL("../../web/certificate.html", import.meta.url), "utf8");
const explainerJs = readFileSync(new URL("../../web/capability-explainer.js", import.meta.url), "utf8");
const ceremonyJs = readFileSync(new URL("../../web/verification-ceremony.js", import.meta.url), "utf8");
const flowJs = readFileSync(new URL("../../web/verification-flow.js", import.meta.url), "utf8");
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

describe("completed proof is never misrepresented as a live verification", () => {
  it("keeps all existing C1-C4 live flow containers hidden unless a real run explicitly marks them running", () => {
    expect(explainerJs).toContain("for (const number of [1, 2, 3, 4])");
    expect(explainerJs).toContain("!liveFlow.dataset.verificationRunning");
    expect(explainerJs).toContain("liveFlow.hidden = true");
  });

  it("does not reconstruct a completed certificate as a fake live ceremony", () => {
    expect(explainerJs).not.toContain("createVerificationCeremony");
    expect(explainerJs).not.toContain("/api/v1/certificates/");
    expect(explainerJs).not.toContain("/api/v1/verification/");
    expect(explainerJs).not.toContain('mode: "proof"');
  });

  it("only opens the ceremony from the explicit certification reset path", () => {
    expect(ceremonyJs).toContain("container.hidden = true");
    expect(flowJs).toContain('container.dataset.verificationRunning = "true"');
    expect(flowJs).toContain("ceremony.reset()");
    expect(agent).toContain("button.disabled = true");
    expect(agent).toContain("flow.reset()");
  });

  it("uses a single visual scene to explain execution, verification and portability", () => {
    expect(ceremonyJs).toContain('title: copy("Agent Core", "Ajan Core")');
    expect(ceremonyJs).toContain('title: copy("Independent verifier", "Bağımsız verifier")');
    expect(ceremonyJs).toContain('copy("STAYS INSIDE FLOP", "FLOP İÇİNDE KALIR")');
    expect(ceremonyJs).toContain('copy("PORTABLE PROOF", "TAŞINABİLİR KANIT")');
    expect(ceremonyJs).toContain("DID · Certificate · Receipt · Public proof");
  });
});
