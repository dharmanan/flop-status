import { getLanguage } from "/i18n.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const byId = (id) => document.getElementById(id);
const language = () => getLanguage();
const copy = (en, tr) => (language() === "tr" ? tr : en);

const CAPABILITY_COPY = {
  "cryptography.signature-verification": {
    title: ["Ed25519 Signature Verification Certificate", "Ed25519 İmza Doğrulama Sertifikası"],
    verified: [
      "This FLOP agent correctly completed an independent Ed25519 signature verification test.",
      "Bu FLOP ajanı bağımsız bir Ed25519 imza doğrulama testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can use the certified capability version inside FLOP.",
      "Bu sertifika, bu ajanın sertifikalanan yetenek sürümünü FLOP içinde kullanabildiğini kanıtlar.",
    ],
  },
  "data.canonical-json-sha256": {
    title: ["Canonical JSON + SHA256 Certificate", "Canonical JSON + SHA256 Sertifikası"],
    verified: [
      "This FLOP agent correctly completed an independent RFC 8785 Canonical JSON and SHA256 test.",
      "Bu FLOP ajanı bağımsız bir RFC 8785 Canonical JSON ve SHA256 testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can canonicalize JSON and calculate its SHA256 hash inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde JSON'u canonical hale getirip SHA256 hashini hesaplayabildiğini kanıtlar.",
    ],
  },
  "protocol.technocore-canonical-message": {
    title: ["Technocore Canonical Message Certificate", "Technocore Canonical Message Sertifikası"],
    verified: [
      "This FLOP agent correctly completed an independent Technocore canonical message construction test.",
      "Bu FLOP ajanı bağımsız bir Technocore canonical mesaj oluşturma testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can build the exact Technocore canonical signing message inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde tam Technocore canonical imzalama mesajını oluşturabildiğini kanıtlar.",
    ],
  },
  "evidence.signed-receipt-verification": {
    title: ["Signed Receipt Verification Certificate", "İmzalı Receipt Doğrulama Sertifikası"],
    verified: [
      "This FLOP agent correctly completed an independent signed receipt verification test, including tampered and unknown-key evidence.",
      "Bu FLOP ajanı, değiştirilmiş ve bilinmeyen anahtar kanıtları dahil olmak üzere bağımsız bir imzalı receipt doğrulama testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can independently check FLOP signed receipts and capability evidence inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde imzalı receipt ve capability kanıtlarını bağımsız olarak kontrol edebildiğini kanıtlar.",
    ],
  },
  "data.structured-transformation": {
    title: ["Structured Data Transformation Certificate", "Yapılandırılmış Veri Dönüşümü Sertifikası"],
    verified: [
      "This FLOP agent correctly completed an independent structured data transformation test, applying an explicit deterministic specification.",
      "Bu FLOP ajanı, açık bir deterministik spesifikasyonu uygulayarak bağımsız bir yapılandırılmış veri dönüşümü testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can transform structured data according to an explicit machine-readable specification inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde açık makine tarafından okunabilir bir spesifikasyona göre yapılandırılmış veriyi dönüştürebildiğini kanıtlar.",
    ],
  },
  "policy.constraint-compliance": {
    title: ["Constraint & Policy Compliance Certificate", "Kısıt ve Politika Uyumluluğu Sertifikası"],
    verified: [
      "This FLOP agent correctly completed an independent constraint and policy compliance test, evaluating explicit deterministic rules.",
      "Bu FLOP ajanı, açık deterministik kuralları değerlendirerek bağımsız bir kısıt ve politika uyumluluğu testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can evaluate structured data against an explicit machine-readable policy inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde açık makine tarafından okunabilir bir politikaya göre yapılandırılmış veriyi değerlendirebildiğini kanıtlar.",
    ],
  },
  "runtime.failure-recovery-idempotency": {
    title: ["Failure Recovery & Idempotency Certificate", "Hata Kurtarma ve İdempotentlik Sertifikası"],
    verified: [
      "This FLOP agent correctly completed an independent failure recovery and idempotency test, recovering from a scripted transient failure and absorbing a duplicate delivery without applying its side effect twice.",
      "Bu FLOP ajanı, senaryolanmış geçici bir hatadan kurtularak ve bir tekrar teslimatı yan etkisini iki kez uygulamadan absorbe ederek bağımsız bir hata kurtarma ve idempotentlik testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can retry a failed attempt and apply a retryable operation exactly once under a shared idempotency key inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde başarısız bir denemeyi yeniden deneyebildiğini ve ortak bir idempotency anahtarı altında yeniden denenebilir bir işlemi tam olarak bir kez uygulayabildiğini kanıtlar.",
    ],
  },
};

const PROOF_LABELS = {
  "certificate-eyebrow": ["FLOP Capability Certificate", "FLOP Yetenek Sertifikası"],
  "agent-did": ["Agent DID", "Ajan DID"],
  capability: ["Capability", "Yetenek"],
  "capability-version": ["Capability version", "Yetenek sürümü"],
  "program-version": ["Program version", "Program sürümü"],
  trial: ["Trial", "Trial"],
  verifier: ["Verifier", "Verifier"],
  issued: ["Issued", "Verildi"],
  receipt: ["Receipt", "Receipt"],
  attestation: ["FLOP attestation", "FLOP attestation"],
  "open-receipt": ["Open signed receipt proof", "İmzalı receipt kanıtını aç"],
  "back-to-lab": ["Back to Capability Lab", "Capability Lab'e dön"],
};

function localizeProofLabels() {
  for (const node of document.querySelectorAll("[data-label]")) {
    const pair = PROOF_LABELS[node.dataset.label];
    if (pair) node.textContent = copy(pair[0], pair[1]);
  }
}

function certificateIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "certificate" && parts[1] ? parts[1] : null;
}

function renderMeaning(capabilityId) {
  const config = CAPABILITY_COPY[capabilityId];
  if (!config) return;
  const panel = byId("certificate-status")?.closest(".panel");
  if (!panel) return;

  let section = byId("certificate-meaning");
  if (!section) {
    section = document.createElement("section");
    section.id = "certificate-meaning";
    section.className = "capability-explanation certificate-explanation";
    panel.insertBefore(section, panel.querySelector(".actions"));
  }
  section.replaceChildren();

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = copy("WHAT DOES THIS PROVE?", "BU NEYİ KANITLIYOR?");
  const rows = document.createElement("div");
  rows.className = "capability-summary";

  for (const [title, text] of [
    [copy("Verified capability", "Doğrulanmış yetenek"), copy(config.verified[0], config.verified[1])],
    [copy("Scope", "Kapsam"), copy(config.scope[0], config.scope[1])],
  ]) {
    const row = document.createElement("div");
    row.className = "capability-summary-row";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = text;
    row.append(strong, span);
    rows.appendChild(row);
  }

  section.append(label, rows);
}

async function boot() {
  document.documentElement.lang = language();
  localizeProofLabels();
  byId("certificate-name").textContent = copy("Loading certificate…", "Sertifika yükleniyor…");
  byId("certificate-status").textContent = copy("Loading proof…", "Kanıt yükleniyor…");

  const certificateId = certificateIdFromPath();
  if (!certificateId) throw new Error("Certificate id is missing.");

  const response = await fetch(API_BASE + "/api/v1/certificates/" + encodeURIComponent(certificateId));
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.code ?? "CERTIFICATE_LOAD_FAILED");

  const certificate = body.certificate;
  const verification = body.receipt_verification;
  const config = CAPABILITY_COPY[certificate.capability_id];
  byId("certificate-name").textContent = config ? copy(config.title[0], config.title[1]) : certificate.certificate_name;
  byId("certificate-status").textContent = certificate.status === "ACTIVE" ? copy("CERTIFIED", "SERTİFİKALI") : certificate.status;
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
  renderMeaning(certificate.capability_id);
}

boot().catch((error) => {
  byId("certificate-error").textContent = error instanceof Error ? error.message : String(error);
  byId("certificate-status").textContent = copy("Certificate proof could not be loaded.", "Sertifika kanıtı yüklenemedi.");
});
