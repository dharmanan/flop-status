import { getLanguage } from "/i18n.js";
import { createVerificationCeremony } from "/verification-ceremony.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const byId = (id) => document.getElementById(id);

const CAPABILITIES = [1, 2, 3, 4].map((number) => ({
  number,
  statusId: `capability-${number}-status`,
  certificateLinkId: `capability-${number}-certificate`,
  flowId: `capability-${number}-flow`,
}));

const proofCache = new Map();
const scenes = new Map();

function certified(config) {
  return ["Certified", "Sertifikalı"].includes(byId(config.statusId)?.textContent ?? "");
}

function latestCertified() {
  return CAPABILITIES.filter(certified).reduce((latest, config) => Math.max(latest, config.number), 0);
}

function certificateId(config) {
  const link = byId(config.certificateLinkId);
  if (!link || link.hidden) return null;
  return link.getAttribute("href")?.match(/^\/certificate\/([^/]+)$/)?.[1] ?? null;
}

function capabilityMeta(config) {
  const card = byId(config.flowId)?.closest(".capability-card");
  return {
    name: card?.querySelector(".trial-copy strong")?.textContent?.trim() || `Capability ${config.number}`,
    capabilityId: card?.querySelector(".trial-capability")?.textContent?.trim() || "",
  };
}

async function loadProof(id) {
  if (!id) return null;
  if (proofCache.has(id)) return proofCache.get(id);

  const promise = (async () => {
    const certificateResponse = await fetch(`${API_BASE}/api/v1/certificates/${encodeURIComponent(id)}`);
    if (!certificateResponse.ok) throw new Error("CERTIFICATE_PROOF_UNAVAILABLE");
    const certificateBody = await certificateResponse.json();
    const certificate = certificateBody.certificate;
    if (!certificate?.receipt_id) throw new Error("CERTIFICATE_RECEIPT_MISSING");

    const verificationResponse = await fetch(`${API_BASE}/api/v1/verification/${encodeURIComponent(certificate.receipt_id)}`);
    if (!verificationResponse.ok) throw new Error("RECEIPT_PROOF_UNAVAILABLE");
    const verification = await verificationResponse.json();

    return {
      certificate,
      attestation: certificateBody.receipt_verification?.signature_status ?? "VALID",
      receipt: verification.receipt,
      serverKey: verification.server_key,
    };
  })();

  proofCache.set(id, promise);
  try {
    return await promise;
  } catch (error) {
    proofCache.delete(id);
    throw error;
  }
}

function ensureSurface(config) {
  const id = `capability-${config.number}-ceremony-proof`;
  let section = byId(id);
  if (section) return section;

  section = document.createElement("section");
  section.id = id;
  section.className = "certified-proof-surface";
  section.hidden = true;
  byId(config.flowId)?.insertAdjacentElement("afterend", section);
  return section;
}

function disposeScene(number) {
  const existing = scenes.get(number);
  if (existing) existing.destroy();
  scenes.delete(number);
}

async function renderCertified(config) {
  const section = ensureSurface(config);
  if (!section) return;

  const liveFlow = byId(config.flowId);
  const shouldShow = certified(config) && config.number === latestCertified() && (!liveFlow || liveFlow.hidden);
  if (!shouldShow) {
    section.hidden = true;
    disposeScene(config.number);
    return;
  }

  const id = certificateId(config);
  if (!id) {
    section.hidden = true;
    return;
  }

  try {
    const proof = await loadProof(id);
    if (!proof || !certified(config) || config.number !== latestCertified() || (liveFlow && !liveFlow.hidden)) return;

    disposeScene(config.number);
    const meta = capabilityMeta(config);
    const ceremony = createVerificationCeremony(section, {
      number: config.number,
      name: meta.name,
      capabilityId: meta.capabilityId,
      mode: "proof",
    });
    scenes.set(config.number, ceremony);

    ceremony.setIdentity(proof.certificate.agent_did);
    ceremony.setChallenge(
      config.number === 4
        ? { receipt: proof.receipt, signature: proof.receipt?.server_signature, key_id: proof.receipt?.server_key_id, server_keys: [proof.serverKey] }
        : null,
      {
        challengeHash: proof.receipt?.challenge_hash,
        challengeId: proof.receipt?.challenge_id,
      },
    );
    ceremony.setResult({
      verdict: proof.receipt?.verdict,
      evidence_type: proof.receipt?.evidence_type,
      result_hash: proof.receipt?.result_hash,
      verifier: `${proof.receipt?.verifier_id ?? ""} @ ${proof.receipt?.verifier_version ?? ""}`,
    });
    if (proof.receipt?.server_signature) ceremony.setSignature(proof.receipt.server_signature);
    ceremony.setVerifier(proof.receipt?.verifier_id ?? "", proof.receipt?.verifier_version ?? "");
    ceremony.setDecision({
      verdict: proof.receipt?.verdict,
      receipt_id: proof.receipt?.receipt_id,
      certificate_id: proof.certificate.certificate_id,
      result_hash: proof.receipt?.result_hash,
      verifier_id: proof.receipt?.verifier_id,
      verifier_version: proof.receipt?.verifier_version,
    });
    ceremony.completeProof({
      did: proof.certificate.agent_did,
      challengeHash: proof.receipt?.challenge_hash,
      trial: `${proof.receipt?.trial_id ?? ""} @ ${proof.receipt?.trial_version ?? ""}`,
      receipt: proof.receipt,
      certificate: proof.certificate,
      attestation: proof.attestation,
    });
    section.hidden = false;
  } catch {
    section.hidden = true;
    disposeScene(config.number);
  }
}

function renderAll() {
  for (const config of CAPABILITIES) void renderCertified(config);
}

function boot() {
  if (!byId("active-actions")) return;
  CAPABILITIES.forEach(ensureSurface);
  renderAll();

  const observer = new MutationObserver(renderAll);
  for (const config of CAPABILITIES) {
    const status = byId(config.statusId);
    const certificate = byId(config.certificateLinkId);
    const flow = byId(config.flowId);
    if (status) observer.observe(status, { childList: true, subtree: true });
    if (certificate) observer.observe(certificate, { attributes: true, attributeFilter: ["hidden", "href"] });
    if (flow) observer.observe(flow, { attributes: true, attributeFilter: ["hidden"] });
  }
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderAll();
  });
}

void getLanguage;
boot();
