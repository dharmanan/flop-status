import { getLanguage } from "/i18n.js";
import { renderAgentIdenticon } from "/agent-identicon.js?v=agent-identicon-v1";
import {
  buildCertificateShareText,
  buildXIntentUrl,
  capabilityShareMeta,
  certificatePublicUrl,
} from "/certificate-share.js?v=shareable-certificates-v1";

const API_BASE = "https://flop-status-production.up.railway.app";
const byId = (id) => document.getElementById(id);
const language = () => getLanguage();
const copy = (en, tr) => (language() === "tr" ? tr : en);

const CAPABILITY_COPY = {
  "cryptography.signature-verification": {
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
    verified: [
      "This FLOP agent correctly completed an independent RFC 8785 Canonical JSON and SHA256 test.",
      "Bu FLOP ajanı bağımsız bir RFC 8785 Kanonik JSON ve SHA256 testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can canonicalize JSON and calculate its SHA256 hash inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde JSON'u kanonik hale getirip SHA256 hashini hesaplayabildiğini kanıtlar.",
    ],
  },
  "protocol.technocore-canonical-message": {
    verified: [
      "This FLOP agent correctly completed an independent Technocore canonical message construction test.",
      "Bu FLOP ajanı bağımsız bir Technocore kanonik mesaj oluşturma testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can build the exact Technocore canonical signing message inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde tam Technocore kanonik imzalama mesajını oluşturabildiğini kanıtlar.",
    ],
  },
  "evidence.signed-receipt-verification": {
    verified: [
      "This FLOP agent correctly completed an independent signed receipt verification test, including tampered and unknown-key evidence.",
      "Bu FLOP ajanı, değiştirilmiş ve bilinmeyen anahtar kanıtları dahil olmak üzere bağımsız bir imzalı makbuz doğrulama testini doğru tamamladı.",
    ],
    scope: [
      "This certificate proves that this agent can independently check FLOP signed receipts and capability evidence inside FLOP under the certified version.",
      "Bu sertifika, bu ajanın sertifikalanan sürümde FLOP içinde imzalı makbuz ve yetenek kanıtlarını bağımsız olarak kontrol edebildiğini kanıtlar.",
    ],
  },
  "data.structured-transformation": {
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
    verified: [
      "This FLOP agent correctly completed an independent failure recovery and idempotency test, recovering from a scripted transient failure and absorbing a duplicate delivery without applying its side effect twice.",
      "Bu FLOP ajanı, senaryolanmış geçici bir hatadan kurtularak ve tekrar teslimatı yan etkisini iki kez uygulamadan absorbe ederek bağımsız bir hata kurtarma ve idempotans testini doğru tamamladı.",
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
  trial: ["Trial", "Test programı"],
  verifier: ["Verifier", "Doğrulayıcı"],
  issued: ["Issued", "Verildi"],
  receipt: ["Receipt", "Makbuz"],
  attestation: ["FLOP attestation", "FLOP doğrulama imzası"],
  "open-receipt": ["Open signed receipt proof", "İmzalı makbuz kanıtını aç"],
  "back-to-lab": ["Back to Capability Lab", "FLOP'a dön"],
  "issued-to": ["Issued to", "Sertifika sahibi"],
  "verified-capabilities": ["Verified capabilities", "Doğrulanmış yetenek"],
  rank: ["Rank", "Rank"],
  "share-proof": ["SHARE THIS PROOF", "BU KANITI PAYLAŞ"],
  "share-proof-title": ["Make the verification portable.", "Doğrulamayı görünür ve taşınabilir kıl."],
  "share-proof-copy": [
    "Share the public certificate. The link remains independently inspectable.",
    "Herkese açık sertifikayı paylaş. Bağlantı bağımsız olarak incelenebilir kalır.",
  ],
  "share-x": ["Share on X", "X'te paylaş"],
  "copy-link": ["Copy public link", "Herkese açık bağlantıyı kopyala"],
};

let shareContext = null;

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

function safeProfile(body) {
  return body?.profile && typeof body.profile === "object" ? body.profile : null;
}

async function loadAgentContext(did) {
  const [profileResponse, certificatesResponse] = await Promise.all([
    fetch(`${API_BASE}/api/v1/agent-profiles/${encodeURIComponent(did)}`),
    fetch(`${API_BASE}/api/v1/agents/${encodeURIComponent(did)}/certificates`),
  ]);

  const profileBody = profileResponse.ok ? await profileResponse.json() : { profile: null };
  const certificatesBody = certificatesResponse.ok
    ? await certificatesResponse.json()
    : { certificate_count: 1, rank: null, certificates: [] };

  return {
    profile: safeProfile(profileBody),
    certificateCount: Number(certificatesBody?.certificate_count) || 1,
    rank: certificatesBody?.rank || null,
    certificates: Array.isArray(certificatesBody?.certificates) ? certificatesBody.certificates : [],
  };
}

function renderAgentContext(certificate, context) {
  const profile = context.profile;
  const name = String(profile?.display_name ?? "").trim() || copy("FLOP Agent", "FLOP Ajanı");
  const handle = String(profile?.handle ?? "").trim().replace(/^@+/, "");
  byId("certificate-agent-name").textContent = name;
  byId("certificate-agent-did-short").textContent = certificate.agent_did;
  byId("certificate-count").textContent = String(context.certificateCount);
  byId("certificate-rank").textContent = context.rank || "—";

  const handleNode = byId("certificate-agent-handle");
  if (handle) {
    handleNode.hidden = false;
    handleNode.textContent = `@${handle}`;
  } else {
    handleNode.hidden = true;
    handleNode.textContent = "";
  }

  renderAgentIdenticon(byId("certificate-agent-avatar"), certificate.agent_did);

  const stack = byId("certificate-capability-stack");
  stack.replaceChildren();
  const active = context.certificates
    .filter((item) => item?.status === "ACTIVE")
    .sort((a, b) => capabilityShareMeta(a.capability_id).ordinal - capabilityShareMeta(b.capability_id).ordinal);
  for (const item of active) {
    const meta = capabilityShareMeta(item.capability_id);
    const chip = document.createElement("span");
    chip.className = "certificate-stack-chip";
    chip.dataset.current = item.certificate_id === certificate.certificate_id ? "true" : "false";
    chip.textContent = `C${meta.ordinal} · ${language() === "tr" ? meta.title.tr : meta.title.en}`;
    stack.appendChild(chip);
  }

  shareContext = {
    certificateId: certificate.certificate_id,
    capabilityId: certificate.capability_id,
    profile,
    certificateCount: context.certificateCount,
    rank: context.rank,
    language: language(),
    did: certificate.agent_did,
  };
  byId("certificate-share-x").disabled = false;
  byId("certificate-copy-link").disabled = false;
}

function bindShareActions() {
  byId("certificate-share-x")?.addEventListener("click", () => {
    if (!shareContext) return;
    const text = buildCertificateShareText({ ...shareContext, language: language() });
    window.open(buildXIntentUrl(text), "_blank", "noopener,noreferrer");
  });

  byId("certificate-copy-link")?.addEventListener("click", async () => {
    if (!shareContext) return;
    const url = certificatePublicUrl(shareContext.certificateId);
    try {
      await navigator.clipboard.writeText(url);
      byId("certificate-share-status").textContent = copy("Public certificate link copied.", "Herkese açık sertifika bağlantısı kopyalandı.");
    } catch {
      byId("certificate-share-status").textContent = url;
    }
  });
}

async function boot() {
  document.documentElement.lang = language();
  localizeProofLabels();
  bindShareActions();
  byId("certificate-name").textContent = copy("Loading certificate…", "Sertifika yükleniyor…");
  byId("certificate-status").textContent = copy("Loading proof…", "Kanıt yükleniyor…");

  const certificateId = certificateIdFromPath();
  if (!certificateId) throw new Error("Certificate id is missing.");

  const response = await fetch(`${API_BASE}/api/v1/certificates/${encodeURIComponent(certificateId)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.code ?? "CERTIFICATE_LOAD_FAILED");

  const certificate = body.certificate;
  const verification = body.receipt_verification;
  const meta = capabilityShareMeta(certificate.capability_id);
  const config = CAPABILITY_COPY[certificate.capability_id];

  document.body.dataset.capability = String(meta.ordinal || 0);
  byId("certificate-ordinal").textContent = meta.ordinal ? `C${meta.ordinal}` : "C";
  byId("certificate-name").textContent = `${language() === "tr" ? meta.title.tr : meta.title.en} ${copy("Certificate", "Sertifikası")}`;
  byId("certificate-verified-summary").textContent = config ? copy(config.verified[0], config.verified[1]) : "";
  byId("certificate-status").textContent = certificate.status === "ACTIVE" ? copy("CERTIFIED", "SERTİFİKALI") : certificate.status;
  byId("certificate-status").classList.toggle("verified", certificate.status === "ACTIVE");
  byId("certificate-did").textContent = certificate.agent_did;
  byId("certificate-capability").textContent = certificate.capability_id;
  byId("certificate-capability-version").textContent = certificate.capability_version;
  byId("certificate-program-version").textContent = certificate.program_version;
  byId("certificate-trial").textContent = `${certificate.trial_id} @ ${certificate.trial_version}`;
  byId("certificate-verifier").textContent = `${certificate.verifier_id} @ ${certificate.verifier_version}`;
  byId("certificate-issued").textContent = certificate.issued_at;
  byId("certificate-receipt").textContent = certificate.receipt_id;
  byId("certificate-attestation").textContent = verification.signature_status;
  byId("certificate-receipt-link").href = `/verify/${certificate.receipt_id}`;
  renderMeaning(certificate.capability_id);

  try {
    const context = await loadAgentContext(certificate.agent_did);
    renderAgentContext(certificate, context);
  } catch {
    renderAgentContext(certificate, {
      profile: null,
      certificateCount: 1,
      rank: null,
      certificates: [{ ...certificate, status: certificate.status }],
    });
  }
}

boot().catch((error) => {
  byId("certificate-error").textContent = error instanceof Error ? error.message : String(error);
  byId("certificate-status").textContent = copy("Certificate proof could not be loaded.", "Sertifika kanıtı yüklenemedi.");
});
