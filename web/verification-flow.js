import { createVerificationCeremony } from "/verification-ceremony.js";

function loadCeremonyStyle(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

loadCeremonyStyle("flop-verification-ceremony-style", "/verification-ceremony-live.css?v=ceremony-live-v2");
loadCeremonyStyle("flop-verification-ceremony-layout", "/verification-ceremony-layout.css?v=ceremony-layout-v1");
loadCeremonyStyle("flop-verification-ceremony-overlap-fixes", "/verification-ceremony-overlap-fixes.css?v=ceremony-overlap-v1");

/**
 * VERIFICATION RUN / DOĞRULAMA AKIŞI
 * Shared production verification controller. It never starts itself.
 * agent.js calls reset only after the user explicitly starts certification,
 * then advances the real sequence:
 * challenge -> execute -> result -> sign -> verify -> verdict -> certificate.
 */
export function createVerificationFlow(container, config = {}) {
  const inferredNumber = Number(container?.id?.match(/capability-(\d+)-flow/)?.[1] ?? config.number ?? 4);
  const card = container?.closest?.(".capability-card");
  const inferredName = card?.querySelector?.(".trial-copy strong")?.textContent?.trim() || config.name || `Capability ${inferredNumber}`;
  const inferredCapabilityId = card?.querySelector?.(".trial-capability")?.textContent?.trim() || config.capabilityId || "";
  const ceremony = createVerificationCeremony(container, {
    ...config,
    number: inferredNumber,
    name: inferredName,
    capabilityId: inferredCapabilityId,
  });

  return {
    localize() { ceremony.localize(); },
    reset() {
      container.dataset.verificationRunning = "true";
      ceremony.reset();
      const did = document.getElementById("did")?.textContent?.trim();
      if (did) ceremony.setIdentity(did);
      container.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    begin(stepId) { ceremony.begin(stepId); },
    complete(stepId, summaryCopy) {
      ceremony.complete(stepId, summaryCopy);
      if (stepId === "result" && summaryCopy) ceremony.setResult(document.documentElement.lang === "tr" ? summaryCopy.tr : summaryCopy.en);
      if (stepId === "sign") {
        const did = document.getElementById("did")?.textContent?.trim();
        if (did) ceremony.setIdentity(did);
      }
    },
    unknown(stepId, summaryCopy) { ceremony.unknown(stepId, summaryCopy); },
    fail(stepId, summaryCopy) { ceremony.fail(stepId, summaryCopy); },
    showCertificateStep() {},
    setChallenge(caseData, meta) { ceremony.setChallenge(caseData, meta); },
    setResult(result) { ceremony.setResult(result); },
    setResultHash(value) { ceremony.setResultHash(value); },
    setIdentity(did) { ceremony.setIdentity(did); },
    setSignature(value) { ceremony.setSignature(value); },
    setVerifier(id, version) { ceremony.setVerifier(id, version); },
    setDecision(decision) { ceremony.setDecision(decision); },
    completeProof(proof) { ceremony.completeProof(proof); },
    addTechnicalLine(titleCopy, value) {
      const key = `${titleCopy?.en ?? ""} ${titleCopy?.tr ?? ""}`.toLowerCase();
      if (key.includes("challenge id")) ceremony.setChallenge(null, { challengeId: value });
      else if (key.includes("challenge hash")) ceremony.setChallenge(null, { challengeHash: value });
      else if (key.includes("receipt id")) ceremony.setDecision({ receipt_id: value });
      else if (key.includes("certificate id") || key.includes("sertifika id")) ceremony.setDecision({ certificate_id: value });
    },
  };
}
