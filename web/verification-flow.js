import { createVerificationCeremony } from "/verification-ceremony.js";

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
  const ceremony = createVerificationCeremony(container, config);

  return {
    localize() { ceremony.localize(); },
    reset() { ceremony.reset(); },
    begin(stepId) { ceremony.begin(stepId); },
    complete(stepId, summaryCopy) { ceremony.complete(stepId, summaryCopy); },
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

    // Existing callers still add raw identifiers through this method. The
    // ceremony promotes the useful identifiers into the visual scene while
    // keeping the controller API backwards compatible.
    addTechnicalLine(titleCopy, value) {
      const key = `${titleCopy?.en ?? ""} ${titleCopy?.tr ?? ""}`.toLowerCase();
      if (key.includes("challenge id")) ceremony.setChallenge(null, { challengeId: value });
      else if (key.includes("challenge hash")) ceremony.setChallenge(null, { challengeHash: value });
      else if (key.includes("receipt id")) ceremony.setDecision({ receipt_id: value });
      else if (key.includes("certificate id") || key.includes("sertifika id")) ceremony.setDecision({ certificate_id: value });
    },
  };
}
