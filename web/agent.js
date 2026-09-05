import {
  bytesToBase64Url,
  createEncryptedBackupFromSeed,
  createPortableIdentity,
  identityFromSeed,
  parseBackupJson,
  parseEd25519DidKey,
  restorePortableIdentity,
  serializeBackup,
  serializeIdentitySeed,
} from "/identity-crypto.js";
import { bindLanguageControls, onLanguageChange, t } from "/i18n.js";
import {
  CAPABILITY_ID as CAPABILITY1_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY1_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY1_TRIAL_VERSION,
  createPracticeFixture as createCapability1PracticeFixture,
  evaluatePractice as evaluateCapability1Practice,
  executeEd25519SignatureVerification,
  textMessageToBase64Url,
} from "/capabilities/ed25519-signature-verification.js";
import {
  CAPABILITY_ID as CAPABILITY2_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY2_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY2_TRIAL_VERSION,
  createPracticeFixture as createCapability2PracticeFixture,
  evaluatePractice as evaluateCapability2Practice,
  executeCanonicalJsonSha256,
} from "/capabilities/canonical-json-sha256.js";
import {
  CAPABILITY_ID as CAPABILITY3_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY3_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY3_TRIAL_VERSION,
  createPracticeFixture as createCapability3PracticeFixture,
  evaluatePractice as evaluateCapability3Practice,
  executeTechnocoreCanonicalMessage,
} from "/capabilities/technocore-canonical-message.js";
import {
  CAPABILITY_ID as CAPABILITY4_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY4_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY4_TRIAL_VERSION,
  createPracticeFixture as createCapability4PracticeFixture,
  evaluatePractice as evaluateCapability4Practice,
  executeSignedReceiptVerification,
} from "/capabilities/signed-receipt-verification.js";
import {
  CAPABILITY_ID as CAPABILITY5_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY5_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY5_TRIAL_VERSION,
  createPracticeFixture as createCapability5PracticeFixture,
  evaluatePractice as evaluateCapability5Practice,
  executeStructuredDataTransformation,
} from "/capabilities/structured-data-transformation.js";
import {
  CAPABILITY_ID as CAPABILITY6_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY6_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY6_TRIAL_VERSION,
  createPracticeFixture as createCapability6PracticeFixture,
  evaluatePractice as evaluateCapability6Practice,
  executeConstraintPolicyCompliance,
} from "/capabilities/constraint-policy-compliance.js";
import {
  CAPABILITY_ID as CAPABILITY7_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY7_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY7_TRIAL_VERSION,
  createPracticeFixture as createCapability7PracticeFixture,
  evaluatePractice as evaluateCapability7Practice,
  executeFailureRecoveryIdempotency,
} from "/capabilities/failure-recovery-idempotency.js";
import { canonicalizeJson } from "/capabilities/jcs.js";
import { createVerificationFlow } from "/verification-flow.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const SUBMISSION_VERSION = "1";
const CANONICALIZATION = "jcs-rfc8785-v1";
const DB_NAME = "flop-agent-key-v1";
const STORE_NAME = "identity";
const ACTIVE_ID = "active";
const MASKED_SEED = "•••• •••• •••• •••• •••• •••• •••• ••••";
const encoder = new TextEncoder();

const CAPABILITIES = [
  {
    number: 1,
    capabilityId: CAPABILITY1_ID,
    trialId: CAPABILITY1_TRIAL_ID,
    trialVersion: CAPABILITY1_TRIAL_VERSION,
    statusId: "capability-1-status",
    descriptionId: "capability-1-description",
    purposeId: "capability-1-purpose",
    acquireId: "acquire-capability-1",
    practiceId: "practice-capability-1",
    verifyId: "verify-capability-1",
    certificateId: "capability-1-certificate",
    useId: "capability-1-use",
    practiceResultId: "practice-result",
    flowId: "capability-1-flow",
    name: "Ed25519 Signature Verification",
    certificateName: {
      en: "Ed25519 Signature Verification Certificate",
      tr: "Ed25519 İmza Doğrulama Sertifikası",
    },
    purpose: {
      en: "Checks whether a digital signature really belongs to the supplied key and message. Used inside Flop Proof to verify signed data and identity proofs.",
      tr: "Dijital imzaların gerçekten doğru anahtar ve mesaja ait olup olmadığını kontrol eder. Flop Proof içinde imzalı veri ve kimlik kanıtlarını doğrulamak için kullanılır.",
    },
    execute: executeEd25519SignatureVerification,
    createPracticeFixture: createCapability1PracticeFixture,
    evaluatePractice: evaluateCapability1Practice,
  },
  {
    number: 2,
    capabilityId: CAPABILITY2_ID,
    trialId: CAPABILITY2_TRIAL_ID,
    trialVersion: CAPABILITY2_TRIAL_VERSION,
    statusId: "capability-2-status",
    descriptionId: "capability-2-description",
    purposeId: "capability-2-purpose",
    acquireId: "acquire-capability-2",
    practiceId: "practice-capability-2",
    verifyId: "verify-capability-2",
    certificateId: "capability-2-certificate",
    useId: "capability-2-use",
    practiceResultId: "practice-result-2",
    flowId: "capability-2-flow",
    prerequisiteCapabilityId: CAPABILITY1_ID,
    name: "Canonical JSON + SHA256",
    certificateName: {
      en: "Canonical JSON + SHA256 Certificate",
      tr: "Canonical JSON + SHA256 Sertifikası",
    },
    purpose: {
      en: "Makes the same JSON data produce the same canonical form and SHA256 fingerprint across systems. Used to prove whether data changed and whether two parties are referring to exactly the same content.",
      tr: "Aynı JSON verisinin farklı sistemlerde aynı biçime ve aynı SHA256 parmak izine dönüşmesini sağlar. Veri değişmiş mi, iki taraf gerçekten aynı içeriği mi görüyor, bunu kesin olarak kontrol etmek için kullanılır.",
    },
    execute: executeCanonicalJsonSha256,
    createPracticeFixture: createCapability2PracticeFixture,
    evaluatePractice: evaluateCapability2Practice,
  },
  {
    number: 3,
    capabilityId: CAPABILITY3_ID,
    trialId: CAPABILITY3_TRIAL_ID,
    trialVersion: CAPABILITY3_TRIAL_VERSION,
    statusId: "capability-3-status",
    descriptionId: "capability-3-description",
    purposeId: "capability-3-purpose",
    acquireId: "acquire-capability-3",
    practiceId: "practice-capability-3",
    verifyId: "verify-capability-3",
    certificateId: "capability-3-certificate",
    useId: "capability-3-use",
    practiceResultId: "practice-result-3",
    flowId: "capability-3-flow",
    prerequisiteCapabilityId: CAPABILITY2_ID,
    name: "Technocore Canonical Message",
    certificateName: {
      en: "Technocore Canonical Message Certificate",
      tr: "Technocore Canonical Message Sertifikası",
    },
    purpose: {
      en: "Builds the exact signable message format expected by Technocore. It lets different agents derive the same canonical payload for the same message.",
      tr: "Bir mesajı Technocore'un beklediği kesin imzalanabilir biçime dönüştürür. Farklı ajanların aynı mesaj üzerinde aynı canonical payloadı üretmesini sağlar.",
    },
    execute: executeTechnocoreCanonicalMessage,
    createPracticeFixture: createCapability3PracticeFixture,
    evaluatePractice: evaluateCapability3Practice,
  },
  {
    number: 4,
    capabilityId: CAPABILITY4_ID,
    trialId: CAPABILITY4_TRIAL_ID,
    trialVersion: CAPABILITY4_TRIAL_VERSION,
    statusId: "capability-4-status",
    descriptionId: "capability-4-description",
    purposeId: "capability-4-purpose",
    acquireId: "acquire-capability-4",
    practiceId: "practice-capability-4",
    verifyId: "verify-capability-4",
    certificateId: "capability-4-certificate",
    useId: "capability-4-use",
    practiceResultId: "practice-result-4",
    flowId: "capability-4-flow",
    prerequisiteCapabilityId: CAPABILITY3_ID,
    name: "Signed Receipt Verification",
    certificateName: {
      en: "Signed Receipt Verification Certificate",
      tr: "İmzalı Receipt Doğrulama Sertifikası",
    },
    purpose: {
      en: "Checks whether Flop Proof signed receipts and capability evidence are authentic. This allows certificates and proofs to be independently checked for tampering or forgery.",
      tr: "Flop Proof tarafından imzalanmış receipt ve capability kanıtlarının gerçekten geçerli olup olmadığını kontrol eder. Böylece bir sertifika veya kanıtın sahte ya da değiştirilmiş olup olmadığı bağımsız olarak anlaşılabilir.",
    },
    execute: executeSignedReceiptVerification,
    createPracticeFixture: createCapability4PracticeFixture,
    evaluatePractice: evaluateCapability4Practice,
  },
  {
    number: 5,
    capabilityId: CAPABILITY5_ID,
    trialId: CAPABILITY5_TRIAL_ID,
    trialVersion: CAPABILITY5_TRIAL_VERSION,
    statusId: "capability-5-status",
    descriptionId: "capability-5-description",
    purposeId: "capability-5-purpose",
    acquireId: "acquire-capability-5",
    practiceId: "practice-capability-5",
    verifyId: "verify-capability-5",
    certificateId: "capability-5-certificate",
    useId: "capability-5-use",
    practiceResultId: "practice-result-5",
    flowId: "capability-5-flow",
    prerequisiteCapabilityId: CAPABILITY4_ID,
    name: "Structured Data Transformation",
    certificateName: {
      en: "Structured Data Transformation Certificate",
      tr: "Yapılandırılmış Veri Dönüşümü Sertifikası",
    },
    purpose: {
      en: "Transforms structured source data into an exact target structure according to an explicit machine-readable specification, without inventing, omitting or altering unrelated information.",
      tr: "Yapılandırılmış kaynak veriyi, açık makine tarafından okunabilir bir spesifikasyona göre tam olarak beklenen hedef yapıya dönüştürür; ilgisiz bilgi uydurmaz, atlamaz veya değiştirmez.",
    },
    execute: executeStructuredDataTransformation,
    createPracticeFixture: createCapability5PracticeFixture,
    evaluatePractice: evaluateCapability5Practice,
  },
  {
    number: 6,
    capabilityId: CAPABILITY6_ID,
    trialId: CAPABILITY6_TRIAL_ID,
    trialVersion: CAPABILITY6_TRIAL_VERSION,
    statusId: "capability-6-status",
    descriptionId: "capability-6-description",
    purposeId: "capability-6-purpose",
    acquireId: "acquire-capability-6",
    practiceId: "practice-capability-6",
    verifyId: "verify-capability-6",
    certificateId: "capability-6-certificate",
    useId: "capability-6-use",
    practiceResultId: "practice-result-6",
    flowId: "capability-6-flow",
    prerequisiteCapabilityId: CAPABILITY5_ID,
    name: "Constraint & Policy Compliance",
    certificateName: {
      en: "Constraint & Policy Compliance Certificate",
      tr: "Kısıt ve Politika Uyumluluğu Sertifikası",
    },
    purpose: {
      en: "Evaluates structured data against an explicit machine-readable policy and returns a precise compliance verdict with deterministic violations. Not legal or ethical judgment — explicit rules applied consistently.",
      tr: "Yapılandırılmış veriyi açık, makine tarafından okunabilir bir politikaya göre değerlendirir ve deterministik ihlallerle birlikte kesin bir uyumluluk kararı döndürür. Hukuki veya etik bir değerlendirme değildir — açık kurallar tutarlı biçimde uygulanır.",
    },
    execute: executeConstraintPolicyCompliance,
    createPracticeFixture: createCapability6PracticeFixture,
    evaluatePractice: evaluateCapability6Practice,
  },
  {
    number: 7,
    capabilityId: CAPABILITY7_ID,
    trialId: CAPABILITY7_TRIAL_ID,
    trialVersion: CAPABILITY7_TRIAL_VERSION,
    statusId: "capability-7-status",
    descriptionId: "capability-7-description",
    purposeId: "capability-7-purpose",
    acquireId: "acquire-capability-7",
    practiceId: "practice-capability-7",
    verifyId: "verify-capability-7",
    certificateId: "capability-7-certificate",
    useId: "capability-7-use",
    practiceResultId: "practice-result-7",
    flowId: "capability-7-flow",
    prerequisiteCapabilityId: CAPABILITY6_ID,
    name: "Failure Recovery & Idempotency",
    certificateName: {
      en: "Failure Recovery & Idempotency Certificate",
      tr: "Hata Kurtarma ve İdempotentlik Sertifikası",
    },
    purpose: {
      en: "Recovers safely from a scripted transient failure and applies a retryable operation exactly once, even when the same delivery is repeated. Not autonomous planning or distributed consensus — a bounded, deterministic simulation inside Flop Proof.",
      tr: "Senaryolanmış geçici bir hatadan güvenle kurtulur ve aynı teslimat tekrarlansa bile yeniden denenebilir bir işlemi tam olarak bir kez uygular. Otonom planlama veya dağıtık konsensüs değildir — Flop Proof içinde sınırlı, deterministik bir simülasyondur.",
    },
    execute: executeFailureRecoveryIdempotency,
    createPracticeFixture: createCapability7PracticeFixture,
    evaluatePractice: evaluateCapability7Practice,
  },
];

const flows = new Map();

let identity = null;
let pendingSeed = null;
let seedSavedAction = false;
let seedRevealed = false;
let setupPath = "create";
let capabilityStates = new Map();
let certificateList = { certificate_count: 0, rank: null, certificates: [] };
let toastTimer = null;

const byId = (id) => document.getElementById(id);
const setOperation = (value) => { byId("operation-status").textContent = value; };
const showToast = (value) => {
  const toast = byId("toast");
  if (!toast) return;
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = value;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    toast.textContent = "";
    toastTimer = null;
  }, 3000);
};

function uiText(en, tr) {
  return document.documentElement.lang === "tr" ? tr : en;
}

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalize(value[key])).join(",") + "}";
  throw new Error("unsupported canonical JSON value");
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, options);
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const error = new Error(body?.error?.code ?? `HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function request(value) {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) open.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function readIdentity() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    return await request(tx.objectStore(STORE_NAME).get(ACTIVE_ID));
  } finally { db.close(); }
}

async function writeIdentity(record) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    await request(tx.objectStore(STORE_NAME).put(record));
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function deleteIdentity() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    await request(tx.objectStore(STORE_NAME).delete(ACTIVE_ID));
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
      tx.onabort = resolve;
    });
  } finally { db.close(); }
}

function normalizedIdentity(record) {
  if (!record || typeof record.did !== "string") return null;
  parseEd25519DidKey(record.did);
  if (record.mode === "external") return { id: ACTIVE_ID, mode: "external", did: record.did };
  if (record.privateKey && record.publicKey) {
    if (record.privateKey.extractable) throw new Error("stored active private key is unexpectedly extractable");
    return { ...record, id: ACTIVE_ID, mode: "browser" };
  }
  return null;
}

function chooseSetupPath(path) {
  setupPath = path === "existing" ? "existing" : "create";
  const create = setupPath === "create";
  byId("create-path").hidden = !create;
  byId("existing-path").hidden = create;
  byId("choose-create").classList.toggle("active", create);
  byId("choose-existing").classList.toggle("active", !create);
  byId("choose-create").setAttribute("aria-pressed", create ? "true" : "false");
  byId("choose-existing").setAttribute("aria-pressed", create ? "false" : "true");
}

function renderSeedGate() {
  byId("seed-gate").hidden = !pendingSeed;
  if (!pendingSeed || !identity) return;
  byId("created-did").textContent = identity.did;
  byId("seed-value").textContent = seedRevealed ? pendingSeed : MASKED_SEED;
  byId("reveal-seed").textContent = seedRevealed ? t("hide_seed") : t("reveal_seed");
  byId("confirm-seed-saved").disabled = !seedSavedAction;
}

function activeCertificates() {
  return (certificateList?.certificates ?? []).filter((item) => item.status === "ACTIVE");
}

function certificateFor(capabilityId) {
  return activeCertificates().find((item) => item.capability_id === capabilityId) ?? null;
}

function localizedCertificateName(certificate) {
  const config = CAPABILITIES.find((item) => item.capabilityId === certificate.capability_id);
  if (!config) return certificate.certificate_name;
  return document.documentElement.lang === "tr" ? config.certificateName.tr : config.certificateName.en;
}

function renderCertificateList() {
  const container = byId("capabilities");
  container.replaceChildren();
  const certificates = activeCertificates();
  const count = certificates.length;
  const rank = certificateList?.rank ?? null;

  byId("certificate-progress").textContent = uiText(`${count} certificate${count === 1 ? "" : "s"}`, `${count} sertifika`);
  const rankBadge = byId("rank-progress");
  if (rankBadge) {
    rankBadge.hidden = !rank;
    if (rank) rankBadge.textContent = rank.rank_name;
  }
  byId("evidence-status").textContent = count === 0
    ? uiText("No certificates yet.", "Henüz sertifika yok.")
    : uiText(`${count} certificate${count === 1 ? "" : "s"}`, `${count} sertifika`);
  for (const certificate of certificates) {
    const item = document.createElement("a");
    item.className = "capability";
    item.href = "/certificate/" + certificate.certificate_id;
    item.textContent = `${localizedCertificateName(certificate)} · ${uiText("Active", "Aktif")}`;
    container.appendChild(item);
  }
}

function prerequisiteMet(config) {
  return !config.prerequisiteCapabilityId || Boolean(certificateFor(config.prerequisiteCapabilityId));
}

function renderOneCapability(config) {
  const state = capabilityStates.get(config.capabilityId) ?? null;
  const installed = state?.installation?.status === "INSTALLED";
  const certificate = state?.certificate ?? certificateFor(config.capabilityId);
  const certified = Boolean(certificate);
  const unlocked = prerequisiteMet(config);
  const browserReady = identity?.mode === "browser" && !pendingSeed;

  const status = byId(config.statusId);
  status.textContent = certified
    ? uiText("Certified", "Sertifikalı")
    : !unlocked
      ? uiText("Locked", "Kilitli")
      : installed
        ? uiText("Installed", "Yüklendi")
        : uiText("Available", "Hazır");
  status.classList.toggle("verified", certified);
  status.classList.toggle("locked", !unlocked && !certified);

  const purpose = byId(config.purposeId);
  if (purpose) purpose.textContent = uiText(config.purpose.en, config.purpose.tr);

  const description = byId(config.descriptionId);
  if (!unlocked) {
    description.textContent = uiText(
      `Complete Capability ${config.number - 1} certificate first.`,
      `Önce Yetenek ${config.number - 1} sertifikasını tamamla.`,
    );
  } else if (certified) {
    description.textContent = uiText(
      `Capability ${config.number} is certified and ready to use inside Flop Proof.`,
      `Yetenek ${config.number} sertifikalı ve Flop Proof içinde kullanıma hazır.`,
    );
  } else if (installed) {
    description.textContent = uiText(
      "Practice the installed capability, then take its certification test.",
      "Yüklü yetenekle pratik yap, ardından sertifika testine gir.",
    );
  } else {
    description.textContent = uiText(
      "Acquire this deterministic capability first. No LLM or API key is required.",
      "Önce bu deterministik yeteneği kazan. LLM veya API anahtarı gerekmez.",
    );
  }

  byId(config.acquireId).hidden = !unlocked || installed || !browserReady;
  byId(config.practiceId).hidden = !unlocked || !installed || !browserReady;
  byId(config.verifyId).hidden = !unlocked || !installed || certified || !browserReady;
  byId(config.useId).hidden = !unlocked || !installed || !browserReady;

  const link = byId(config.certificateId);
  link.hidden = !certified;
  if (certified) link.href = "/certificate/" + certificate.certificate_id;

  byId(config.acquireId).textContent = uiText("Get capability", "Yeteneği kazan");
  byId(config.practiceId).textContent = uiText("Practice", "Pratik yap");
  byId(config.verifyId).textContent = uiText("Take certification test", "Sertifika testine gir");
  link.textContent = uiText(`Open Capability ${config.number} certificate`, `Yetenek ${config.number} sertifikasını aç`);

  flowFor(config).localize();
}

function renderCapabilityState() {
  for (const config of CAPABILITIES) renderOneCapability(config);
  renderCertificateList();
}

function renderIdentity() {
  const setup = byId("identity-setup");
  const summary = byId("identity-summary");
  const actions = byId("active-actions");
  const evidencePanel = byId("evidence-panel");
  const technical = byId("technical-details");
  const backupRow = byId("backup-download-row");

  if (pendingSeed && identity) {
    setup.hidden = true;
    summary.hidden = false;
    actions.hidden = true;
    evidencePanel.hidden = true;
    technical.hidden = false;
    backupRow.hidden = true;
    byId("identity-status").textContent = t("op_created");
    byId("did").textContent = identity.did;
    byId("custody").textContent = t("seed_warning");
    byId("identity-mode").textContent = t("browser_owned");
    byId("extractable-check").textContent = t("nonextractable");
    byId("backup-check").textContent = identity.backup ? t("encrypted_ready") : t("optional_none");
    renderSeedGate();
    return;
  }

  byId("seed-gate").hidden = true;

  if (!identity) {
    setup.hidden = false;
    summary.hidden = true;
    actions.hidden = true;
    evidencePanel.hidden = true;
    technical.hidden = true;
    backupRow.hidden = true;
    chooseSetupPath(setupPath);
    byId("identity-mode").textContent = t("none");
    byId("extractable-check").textContent = "n/a";
    byId("backup-check").textContent = "n/a";
    return;
  }

  setup.hidden = true;
  summary.hidden = false;
  actions.hidden = false;
  evidencePanel.hidden = false;
  technical.hidden = false;
  byId("did").textContent = identity.did;

  if (identity.mode === "browser") {
    byId("identity-status").textContent = t("browser_ready");
    byId("custody").textContent = t("browser_custody");
    byId("identity-mode").textContent = t("browser_owned");
    byId("extractable-check").textContent = t("nonextractable");
    byId("backup-check").textContent = identity.backup ? t("encrypted_ready") : t("optional_none");
    backupRow.hidden = !identity.backup;
  } else {
    byId("identity-status").textContent = t("existing_connected");
    byId("custody").textContent = t("external_custody");
    byId("identity-mode").textContent = t("external_signer_mode");
    byId("extractable-check").textContent = t("not_held");
    byId("backup-check").textContent = t("owned_externally");
    backupRow.hidden = true;
  }
  renderCapabilityState();
}

async function refreshProductState() {
  if (!identity) {
    capabilityStates = new Map();
    certificateList = { certificate_count: 0, rank: null, certificates: [] };
    return;
  }
  const encodedDid = encodeURIComponent(identity.did);
  const [states, certificates] = await Promise.all([
    Promise.all(CAPABILITIES.map(async (config) => [
      config.capabilityId,
      await jsonRequest(`/api/v1/agents/${encodedDid}/product-capabilities/${encodeURIComponent(config.capabilityId)}`),
    ])),
    jsonRequest(`/api/v1/agents/${encodedDid}/certificates`),
  ]);
  capabilityStates = new Map(states);
  certificateList = certificates;
  renderCapabilityState();
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

function downloadBackup(backup) {
  downloadText(serializeBackup(backup), "flop-identity-" + backup.did.slice(-12) + ".flopkey", "application/octet-stream");
}

function syncFileName(inputId, outputId) {
  const file = byId(inputId).files[0];
  byId(outputId).textContent = file ? file.name : t("no_file_selected");
}

async function createBrowserIdentity() {
  byId("create-identity").disabled = true;
  setOperation(t("op_create"));
  try {
    const created = await createPortableIdentity();
    identity = { id: ACTIVE_ID, mode: "browser", did: created.did, publicKey: created.publicKey, privateKey: created.privateKey, backup: null };
    pendingSeed = created.seedHex;
    seedSavedAction = false;
    seedRevealed = false;
    renderIdentity();
    setOperation(t("op_created"));
  } finally {
    byId("create-identity").disabled = false;
  }
}

function markSeedSavedAction() {
  seedSavedAction = true;
  byId("confirm-seed-saved").disabled = false;
}

function downloadSeedIdentity() {
  if (!identity || !pendingSeed) return;
  downloadText(serializeIdentitySeed(identity.did, pendingSeed), "flop-identity-" + identity.did.slice(-8) + ".txt", "text/plain");
  markSeedSavedAction();
  setOperation(t("op_seed_downloaded"));
}

async function copySeed() {
  if (!pendingSeed) return;
  await navigator.clipboard.writeText(pendingSeed);
  markSeedSavedAction();
  setOperation(t("op_seed_copied"));
}

function toggleSeed() {
  if (!pendingSeed) return;
  seedRevealed = !seedRevealed;
  renderSeedGate();
}

async function createOptionalBackup() {
  if (!identity || !pendingSeed) return;
  const passphrase = byId("backup-passphrase").value;
  const confirm = byId("backup-passphrase-confirm").value;
  if (passphrase !== confirm) throw new Error(t("err_passphrase_match"));
  const backup = await createEncryptedBackupFromSeed(pendingSeed, passphrase);
  if (backup.did !== identity.did) throw new Error("encrypted backup DID mismatch");
  identity.backup = backup;
  downloadBackup(backup);
  byId("backup-passphrase").value = "";
  byId("backup-passphrase-confirm").value = "";
  renderIdentity();
  setOperation(t("op_backup_created"));
}

async function confirmSeedSaved() {
  if (!identity || !pendingSeed || !seedSavedAction) return;
  await writeIdentity(identity);
  pendingSeed = null;
  seedSavedAction = false;
  seedRevealed = false;
  renderIdentity();
  await refreshProductState();
  setOperation(t("op_seed_confirmed"));
}

async function signInFromSeed() {
  let source = byId("seed-input").value.trim();
  const file = byId("seed-file").files[0];
  if (!source && file) source = await file.text();
  if (!source) throw new Error(t("err_seed_missing"));
  setOperation(t("op_seed_signin"));
  const restored = await identityFromSeed(source);
  identity = { id: ACTIVE_ID, mode: "browser", did: restored.did, publicKey: restored.publicKey, privateKey: restored.privateKey, backup: null };
  await writeIdentity(identity);
  byId("seed-input").value = "";
  byId("seed-file").value = "";
  syncFileName("seed-file", "seed-file-name");
  renderIdentity();
  await refreshProductState();
  setOperation(t("op_seed_signed_in"));
}

async function restoreBrowserIdentity() {
  const file = byId("restore-file").files[0];
  if (!file) throw new Error(t("err_choose_backup"));
  const passphrase = byId("restore-passphrase").value;
  byId("restore-identity").disabled = true;
  setOperation(t("op_restore"));
  try {
    const backup = parseBackupJson(await file.text());
    const restored = await restorePortableIdentity(backup, passphrase);
    identity = { id: ACTIVE_ID, mode: "browser", did: restored.did, publicKey: restored.publicKey, privateKey: restored.privateKey, backup: restored.backup };
    await writeIdentity(identity);
    byId("restore-passphrase").value = "";
    byId("restore-file").value = "";
    syncFileName("restore-file", "restore-file-name");
    renderIdentity();
    await refreshProductState();
    setOperation(t("op_restored"));
  } finally {
    byId("restore-identity").disabled = false;
  }
}

function configFor(number) {
  const config = CAPABILITIES.find((item) => item.number === number);
  if (!config) throw new Error(`UNKNOWN_CAPABILITY_${number}`);
  return config;
}

function flowFor(config) {
  let flow = flows.get(config.capabilityId);
  if (!flow) {
    flow = createVerificationFlow(byId(config.flowId));
    flows.set(config.capabilityId, flow);
  }
  return flow;
}

async function acquireCapability(number) {
  if (!identity || identity.mode !== "browser" || pendingSeed) throw new Error(t("err_identity_first"));
  const config = configFor(number);
  const button = byId(config.acquireId);
  button.disabled = true;
  try {
    setOperation(uiText(`Installing Capability ${number}…`, `Yetenek ${number} yükleniyor…`));
    await jsonRequest(`/api/v1/agents/${encodeURIComponent(identity.did)}/product-capabilities/${encodeURIComponent(config.capabilityId)}/acquire`, { method: "POST" });
    await refreshProductState();
    setOperation(uiText(`Capability ${number} installed.`, `Yetenek ${number} yüklendi.`));
  } finally {
    button.disabled = false;
  }
}

async function practiceCapability(number) {
  const config = configFor(number);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  const button = byId(config.practiceId);
  button.disabled = true;
  try {
    const fixture = await config.createPracticeFixture();
    const result = await config.execute(fixture.input);
    const passed = await config.evaluatePractice(result, fixture);
    byId(config.practiceResultId).textContent = passed
      ? uiText("Practice passed. The installed capability produced the expected result.", "Pratik başarılı. Yüklü yetenek beklenen sonucu üretti.")
      : uiText("Practice failed. Try again.", "Pratik başarısız. Tekrar deneyebilirsin.");
  } finally { button.disabled = false; }
}

function challengeSummary(number) {
  if (number === 1) return { en: "A fresh one-time public key, message and signature were generated for this DID.", tr: "Bu DID için tek kullanımlık yeni bir public key, mesaj ve imza üretildi." };
  if (number === 2) return { en: "A fresh JSON document was generated.", tr: "Yeni bir JSON belgesi üretildi." };
  if (number === 3) return { en: "A fresh room, nonce and raw message text were generated.", tr: "Yeni bir room, nonce ve ham mesaj metni üretildi." };
  if (number === 4) return { en: "A fresh signed receipt and a bounded server key set were generated.", tr: "Yeni bir imzalı receipt ve sınırlı sunucu anahtar kümesi üretildi." };
  if (number === 5) return { en: "Fresh source data and a transformation specification were generated.", tr: "Yeni bir kaynak veri ve transformation specification üretildi." };
  if (number === 6) return { en: "A fresh input document and a policy rule set were generated.", tr: "Yeni bir girdi belgesi ve politika kural kümesi üretildi." };
  return { en: "A fresh operation, initial state, attempt plan and retry policy were generated.", tr: "Yeni bir operation, initial state, attempt plan ve retry policy üretildi." };
}

function resultSummary(number, result) {
  if (number === 1) return { en: `Signature evaluated as ${result.reason_code}.`, tr: `İmza ${result.reason_code} olarak değerlendirildi.` };
  if (number === 2) return { en: `Canonical form of ${result.canonical_json.length} characters and its SHA256 digest were produced.`, tr: `${result.canonical_json.length} karakterlik canonical biçim ve SHA256 özeti üretildi.` };
  if (number === 3) return { en: "The text was cleaned and the canonical room|nonce|text message was built.", tr: "Metin temizlendi ve canonical room|nonce|metin mesajı oluşturuldu." };
  if (number === 4) return { en: `The receipt was classified as ${result.status} (${result.reason_code}).`, tr: `Receipt ${result.status} (${result.reason_code}) olarak sınıflandırıldı.` };
  if (number === 5) return { en: `The transformation was evaluated as ${result.reason_code}.`, tr: `Dönüşüm ${result.reason_code} olarak değerlendirildi.` };
  if (number === 6) return { en: `The policy evaluation was classified as ${result.reason_code}.`, tr: `Politika değerlendirmesi ${result.reason_code} olarak sınıflandırıldı.` };
  return { en: `The recovery simulation ended as ${result.reason_code}.`, tr: `Kurtarma simülasyonu ${result.reason_code} olarak sonuçlandı.` };
}

async function certifyCapability(number) {
  if (!identity || identity.mode !== "browser" || pendingSeed) throw new Error(t("err_identity_first"));
  const config = configFor(number);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  const button = byId(config.verifyId);
  const flow = flowFor(config);
  button.disabled = true;
  flow.reset();
  try {
    flow.begin("challenge");
    setOperation(uiText("Preparing a fresh test…", "Yeni test hazırlanıyor…"));
    const created = await jsonRequest("/api/v1/challenges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_did: identity.did, trial_id: config.trialId }),
    });
    const challenge = created.challenge;
    flow.complete("challenge", challengeSummary(number));
    flow.addTechnicalLine({ en: "Challenge id:", tr: "Challenge id:" }, challenge.challenge_id);
    flow.addTechnicalLine({ en: "Challenge hash:", tr: "Challenge hash:" }, created.challenge_hash);

    flow.begin("execute");
    setOperation(uiText("The capability is solving the test…", "Yetenek testi çözüyor…"));
    const result = await config.execute(challenge.case);
    flow.complete("execute", { en: "The installed capability module produced the answer.", tr: "Yüklü yetenek modülü cevabı üretti." });

    flow.begin("result");
    flow.complete("result", resultSummary(number, result));

    flow.begin("sign");
    const payload = {
      submission_version: SUBMISSION_VERSION,
      canonicalization: CANONICALIZATION,
      challenge_id: challenge.challenge_id,
      challenge_hash: created.challenge_hash,
      agent_did: identity.did,
      trial_id: config.trialId,
      trial_version: config.trialVersion,
      result,
      submitted_at: new Date().toISOString(),
    };
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, encoder.encode(canonicalize(payload))));
    flow.complete("sign", { en: "The result was signed with this agent's own DID key.", tr: "Sonuç bu ajanın kendi DID anahtarı ile imzalandı." });

    flow.begin("verify");
    setOperation(uiText("Flop Proof is verifying the result…", "Sonuç Flop Proof tarafından doğrulanıyor…"));
    let submitted;
    try {
      submitted = await jsonRequest(`/api/v1/challenges/${challenge.challenge_id}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payload,
          signature: { algorithm: "Ed25519", encoding: "base64url", value: bytesToBase64Url(signature) },
        }),
      });
    } catch (error) {
      // VERIFICATION_UNKNOWN means FLOP could not decide. That is an
      // infrastructure state, never a capability failure, so it gets its own
      // visual state instead of being shown as FAIL.
      if (error instanceof Error && error.message === "VERIFICATION_UNKNOWN") {
        const unknownSummary = { en: "Flop Proof could not complete verification. This is an infrastructure state, not a capability failure.", tr: "Flop Proof doğrulamayı tamamlayamadı. Bu bir altyapı durumudur, yetenek başarısızlığı değildir." };
        flow.unknown("verify", unknownSummary);
        flow.unknown("verdict", { en: "UNKNOWN — no verdict was recorded.", tr: "UNKNOWN — sonuç kaydedilmedi." });
        setOperation(uiText("UNKNOWN. Try again later.", "UNKNOWN. Daha sonra tekrar dene."));
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      flow.fail("verify", { en: message, tr: message });
      throw error;
    }

    flow.complete("verify", { en: "Flop Proof recomputed the expected answer independently and compared it.", tr: "Flop Proof beklenen cevabı bağımsız olarak yeniden hesapladı ve karşılaştırdı." });

    if (submitted.verdict !== "PASS") {
      flow.fail("verdict", { en: "FAIL — the answers did not match. No certificate was issued.", tr: "FAIL — sonuçlar eşleşmedi. Sertifika verilmedi." });
      await refreshProductState();
      setOperation(uiText(`FAIL. Capability ${number} was not certified.`, `FAIL. Yetenek ${number} sertifikalandırılmadı.`));
      return;
    }
    if (!submitted.receipt_id || !submitted.certificate_id) {
      throw new Error("CERTIFICATION_DID_NOT_PRODUCE_CERTIFICATE");
    }

    flow.complete("verdict", { en: "PASS — the two results matched.", tr: "PASS — iki sonuç eşleşti." });
    flow.addTechnicalLine({ en: "Receipt id:", tr: "Receipt id:" }, submitted.receipt_id);
    flow.showCertificateStep();
    flow.complete("certificate", { en: "An individual certificate and an immutable signed receipt were created.", tr: "Bu yeteneğe özel bir sertifika ve değiştirilemez imzalı receipt oluşturuldu." });
    flow.addTechnicalLine({ en: "Certificate id:", tr: "Sertifika id:" }, submitted.certificate_id);

    await refreshProductState();
    setOperation(uiText(`PASS. Capability ${number} certified.`, `PASS. Yetenek ${number} sertifikalandı.`));
  } finally { button.disabled = false; }
}

async function useCapability1() {
  const config = configFor(1);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  const message = byId("use-message").value;
  const publicKey = byId("use-public-key").value.trim();
  const signature = byId("use-signature").value.trim();
  if (!message || !publicKey || !signature) throw new Error(uiText("Complete all use fields.", "Kullanım alanlarının tümünü doldur."));
  const result = await executeEd25519SignatureVerification({ public_key: publicKey, message: textMessageToBase64Url(message), signature });
  byId("use-capability-1-result").textContent = JSON.stringify(result, null, 2);
}

async function useCapability2() {
  const config = configFor(2);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  let document_;
  try {
    document_ = JSON.parse(byId("use-json-2").value);
  } catch {
    throw new Error(uiText("Enter valid JSON.", "Geçerli bir JSON gir."));
  }
  const result = await executeCanonicalJsonSha256({ document: document_ });
  byId("use-capability-2-result").textContent = JSON.stringify(result, null, 2);
}

async function useCapability3() {
  const config = configFor(3);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  const room = byId("use-room").value.trim();
  const nonce = byId("use-nonce").value.trim();
  const text = byId("use-text").value;
  if (!room || !nonce || !text) throw new Error(uiText("Complete all use fields.", "Kullanım alanlarının tümünü doldur."));
  const result = await executeTechnocoreCanonicalMessage({ room, nonce, text });
  byId("use-capability-3-result").textContent = JSON.stringify(result, null, 2);
}

async function useCapability4() {
  const config = configFor(4);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  let receipt;
  let serverKeys;
  try {
    receipt = JSON.parse(byId("use-receipt").value);
    serverKeys = JSON.parse(byId("use-server-keys").value);
  } catch {
    throw new Error(uiText("Enter valid JSON.", "Geçerli bir JSON gir."));
  }
  const result = await executeSignedReceiptVerification({ receipt, server_keys: serverKeys });
  byId("use-capability-4-result").textContent = JSON.stringify(result, null, 2);
}

async function useCapability5() {
  const config = configFor(5);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  let source;
  let spec;
  try {
    source = JSON.parse(byId("use-source-5").value);
    spec = JSON.parse(byId("use-spec-5").value);
  } catch {
    throw new Error(uiText("Enter valid JSON.", "Geçerli bir JSON gir."));
  }
  const result = await executeStructuredDataTransformation({ source, spec });
  byId("use-capability-5-result").textContent = JSON.stringify(result, null, 2);
}

async function useCapability6() {
  const config = configFor(6);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  let document_;
  let policy;
  try {
    document_ = JSON.parse(byId("use-document-6").value);
    policy = JSON.parse(byId("use-policy-6").value);
  } catch {
    throw new Error(uiText("Enter valid JSON.", "Geçerli bir JSON gir."));
  }
  const result = await executeConstraintPolicyCompliance({ document: document_, policy });
  byId("use-capability-6-result").textContent = JSON.stringify(result, null, 2);
}

async function useCapability7() {
  const config = configFor(7);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  let scenario;
  try {
    scenario = JSON.parse(byId("use-scenario-7").value);
  } catch {
    throw new Error(uiText("Enter valid JSON.", "Geçerli bir JSON gir."));
  }
  const result = await executeFailureRecoveryIdempotency(scenario);
  byId("use-capability-7-result").textContent = JSON.stringify(result, null, 2);
}

async function disconnectIdentity() {
  await deleteIdentity();
  identity = null;
  pendingSeed = null;
  seedSavedAction = false;
  seedRevealed = false;
  setupPath = "create";
  capabilityStates = new Map();
  certificateList = { certificate_count: 0, rank: null, certificates: [] };
  renderIdentity();
  setOperation("");
  showToast(t("op_disconnected"));
}

async function boot() {
  bindLanguageControls();
  chooseSetupPath("create");
  byId("seed-file-button").addEventListener("click", () => byId("seed-file").click());
  byId("seed-file").addEventListener("change", () => syncFileName("seed-file", "seed-file-name"));
  byId("restore-file-button").addEventListener("click", () => byId("restore-file").click());
  byId("restore-file").addEventListener("change", () => syncFileName("restore-file", "restore-file-name"));

  onLanguageChange(() => {
    renderIdentity();
    renderCapabilityState();
    syncFileName("seed-file", "seed-file-name");
    syncFileName("restore-file", "restore-file-name");
  });

  try {
    const stored = await readIdentity();
    identity = normalizedIdentity(stored);
    renderIdentity();
    if (identity) {
      await refreshProductState();
      setOperation(t("op_recovered"));
    }
  } catch (error) {
    renderIdentity();
    setOperation(error instanceof Error ? error.message : String(error));
  }
}

function report(error) {
  setOperation(error instanceof Error ? error.message : String(error));
}

byId("choose-create").addEventListener("click", () => chooseSetupPath("create"));
byId("choose-existing").addEventListener("click", () => chooseSetupPath("existing"));
byId("create-identity").addEventListener("click", () => createBrowserIdentity().catch(report));
byId("download-seed").addEventListener("click", downloadSeedIdentity);
byId("copy-seed").addEventListener("click", () => copySeed().catch(report));
byId("reveal-seed").addEventListener("click", toggleSeed);
byId("create-backup").addEventListener("click", () => createOptionalBackup().catch(report));
byId("confirm-seed-saved").addEventListener("click", () => confirmSeedSaved().catch(report));
byId("signin-seed").addEventListener("click", () => signInFromSeed().catch(report));
byId("restore-identity").addEventListener("click", () => restoreBrowserIdentity().catch(report));
byId("acquire-capability-1").addEventListener("click", () => acquireCapability(1).catch(report));
byId("practice-capability-1").addEventListener("click", () => practiceCapability(1).catch(report));
byId("verify-capability-1").addEventListener("click", () => certifyCapability(1).catch(report));
byId("use-capability-1-run").addEventListener("click", () => useCapability1().catch(report));
byId("acquire-capability-2").addEventListener("click", () => acquireCapability(2).catch(report));
byId("practice-capability-2").addEventListener("click", () => practiceCapability(2).catch(report));
byId("verify-capability-2").addEventListener("click", () => certifyCapability(2).catch(report));
byId("use-capability-2-run").addEventListener("click", () => useCapability2().catch(report));
byId("acquire-capability-3").addEventListener("click", () => acquireCapability(3).catch(report));
byId("practice-capability-3").addEventListener("click", () => practiceCapability(3).catch(report));
byId("verify-capability-3").addEventListener("click", () => certifyCapability(3).catch(report));
byId("use-capability-3-run").addEventListener("click", () => useCapability3().catch(report));
byId("acquire-capability-4").addEventListener("click", () => acquireCapability(4).catch(report));
byId("practice-capability-4").addEventListener("click", () => practiceCapability(4).catch(report));
byId("verify-capability-4").addEventListener("click", () => certifyCapability(4).catch(report));
byId("use-capability-4-run").addEventListener("click", () => useCapability4().catch(report));
byId("acquire-capability-5").addEventListener("click", () => acquireCapability(5).catch(report));
byId("practice-capability-5").addEventListener("click", () => practiceCapability(5).catch(report));
byId("verify-capability-5").addEventListener("click", () => certifyCapability(5).catch(report));
byId("use-capability-5-run").addEventListener("click", () => useCapability5().catch(report));
byId("acquire-capability-6").addEventListener("click", () => acquireCapability(6).catch(report));
byId("practice-capability-6").addEventListener("click", () => practiceCapability(6).catch(report));
byId("verify-capability-6").addEventListener("click", () => certifyCapability(6).catch(report));
byId("use-capability-6-run").addEventListener("click", () => useCapability6().catch(report));
byId("acquire-capability-7").addEventListener("click", () => acquireCapability(7).catch(report));
byId("practice-capability-7").addEventListener("click", () => practiceCapability(7).catch(report));
byId("verify-capability-7").addEventListener("click", () => certifyCapability(7).catch(report));
byId("use-capability-7-run").addEventListener("click", () => useCapability7().catch(report));
byId("download-backup").addEventListener("click", () => { if (identity?.backup) downloadBackup(identity.backup); });
byId("reset-identity").addEventListener("click", () => disconnectIdentity().catch(report));

boot();
