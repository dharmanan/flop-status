import { createVerificationCeremony } from "/verification-ceremony.js";

const ceremonyStyleId = "flop-verification-ceremony-style";
if (!document.getElementById(ceremonyStyleId)) {
  const link = document.createElement("link");
  link.id = ceremonyStyleId;
  link.rel = "stylesheet";
  link.href = "/verification-ceremony.css?v=ceremony-v1";
  document.head.appendChild(link);
}

/**
 * Shared production verification controller.
 *
 * VERIFICATION RUN / DOĞRULAMA AKIŞI
 *
 * The controller preserves the real-operation contract used by the product:
 * challenge -> execute -> result -> sign -> verify -> verdict -> certificate.
 * It does not advance itself. Every state transition is called by agent.js
 * only when the represented operation actually starts or resolves.
 */
const STEP_IDS = ["challenge", "execute", "result", "sign", "verify", "verdict", "certificate"];
const STEP_TITLES = [
  ["Fresh challenge created", "Fresh challenge oluşturuldu"],
  ["Capability executed", "Capability çalıştı"],
  ["Output produced", "Output üretildi"],
  ["Signed with agent DID", "Ajan DID'i ile imzalandı"],
  ["FLOP verified independently", "FLOP bağımsız doğruladı"],
  ["Verifier decision", "Verifier kararı"],
  ["Certificate issued", "Certificate oluşturuldu"],
];
void STEP_IDS;
void STEP_TITLES;

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
      ceremony.reset();
      const did = document.getElementById("did")?.textContent?.trim();
      if (did) ceremony.setIdentity(did);
    },
    begin(stepId) { ceremony.begin(stepId); },
    complete(stepId, summaryCopy) {
      ceremony.complete(stepId, summaryCopy);
      if (stepId === "result" && summaryCopy) {
        ceremony.setResult(document.documentElement.lang === "tr" ? summaryCopy.tr : summaryCopy.en);
      }
      if (stepId === "sign") {
        const did = document.getElementById("did")?.textContent?.trim();
        if (did) ceremony.setIdentity(did);
      }
    },
    unknown(stepId, summaryCopy) { ceremony.unknown(stepId, summaryCopy); },
    fail(stepId, summaryCopy) { ceremony.fail(stepId, summaryCopy); },
    showCertificateStep() { ceremony.showCertificate(); },

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
