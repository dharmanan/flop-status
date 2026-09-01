import { getLanguage } from "/i18n.js";

const API_BASE = "https://flop-status-production.up.railway.app";

const byId = (id) => document.getElementById(id);

function language() {
  return getLanguage();
}

function copy(en, tr) {
  return language() === "tr" ? tr : en;
}

function certificateIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "certificate" && parts[1] ? parts[1] : null;
}

async function boot() {
  document.documentElement.lang = language();
  byId("certificate-name").textContent = copy("Loading certificate…", "Sertifika yükleniyor…");
  byId("certificate-status").textContent = copy("Loading proof…", "Kanıt yükleniyor…");

  const certificateId = certificateIdFromPath();
  if (!certificateId) throw new Error("Certificate id is missing.");

  const response = await fetch(API_BASE + "/api/v1/certificates/" + encodeURIComponent(certificateId));
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.code ?? "CERTIFICATE_LOAD_FAILED");

  const certificate = body.certificate;
  const verification = body.receipt_verification;
  byId("certificate-name").textContent = certificate.certificate_name;
  byId("certificate-status").textContent = certificate.status === "ACTIVE"
    ? copy("CERTIFIED", "SERTİFİKALI")
    : certificate.status;
  byId("certificate-status").classList.toggle("verified", certificate.status === "ACTIVE");
  byId("certificate-did").textContent = certificate.agent_did;
  byId("certificate-capability").textContent = certificate.capability_id;
  byId("certificate-capability-version").textContent = certificate.capability_version;
  byId("certificate-program-version").textContent = certificate.program_version;
  byId("certificate-trial").textContent = certificate.trial_id + " @ " + certificate.trial_version;
  byId("certificate-verifier").textContent = certificate.verifier_id + " @ " + certificate.verifier_version;
  byId("certificate-issued").textContent = certificate.issued_at;
  byId("certificate-receipt").textContent = certificate.receipt_id;
  byId("certificate-attestation").textContent = verification.signature_status;
  byId("certificate-receipt-link").href = "/verify/" + certificate.receipt_id;
}

boot().catch((error) => {
  byId("certificate-error").textContent = error instanceof Error ? error.message : String(error);
  byId("certificate-status").textContent = copy(
    "Certificate proof could not be loaded.",
    "Sertifika kanıtı yüklenemedi.",
  );
});
