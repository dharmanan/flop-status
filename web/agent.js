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
  executeEd25519SignatureVerification,
  textMessageToBase64Url,
} from "/capabilities/ed25519-signature-verification.js";
import {
  CAPABILITY_ID as CAPABILITY2_ID,
  PRODUCTION_TRIAL_ID as CAPABILITY2_TRIAL_ID,
  TRIAL_VERSION as CAPABILITY2_TRIAL_VERSION,
  createPracticeFixture as createCapability2PracticeFixture,
  executeCanonicalJsonSha256,
} from "/capabilities/canonical-json-sha256.js";

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
    acquireId: "acquire-capability-1",
    practiceId: "practice-capability-1",
    verifyId: "verify-capability-1",
    certificateId: "capability-1-certificate",
    useId: "capability-1-use",
    practiceResultId: "practice-result",
    name: "Ed25519 Signature Verification",
    certificateName: {
      en: "Ed25519 Signature Verification Certificate",
      tr: "Ed25519 İmza Doğrulama Sertifikası",
    },
  },
  {
    number: 2,
    capabilityId: CAPABILITY2_ID,
    trialId: CAPABILITY2_TRIAL_ID,
    trialVersion: CAPABILITY2_TRIAL_VERSION,
    statusId: "capability-2-status",
    descriptionId: "capability-2-description",
    acquireId: "acquire-capability-2",
    practiceId: "practice-capability-2",
    verifyId: "verify-capability-2",
    certificateId: "capability-2-certificate",
    useId: "capability-2-use",
    practiceResultId: "practice-result-2",
    prerequisiteCapabilityId: CAPABILITY1_ID,
    name: "Canonical JSON + SHA256",
    certificateName: {
      en: "Canonical JSON + SHA256 Certificate",
      tr: "Canonical JSON + SHA256 Sertifikası",
    },
  },
];

let identity = null;
let pendingSeed = null;
let seedSavedAction = false;
let seedRevealed = false;
let setupPath = "create";
let capabilityStates = new Map();
let certificateList = { certificate_count: 0, certificates: [] };

const byId = (id) => document.getElementById(id);
const setOperation = (value) => { byId("operation-status").textContent = value; };

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
  if (!response.ok) throw new Error(body?.error?.code ?? `HTTP_${response.status}`);
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
  byId("certificate-progress").textContent = uiText(`${count} certificate${count === 1 ? "" : "s"}`, `${count} sertifika`);
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

  const description = byId(config.descriptionId);
  if (!unlocked) {
    description.textContent = uiText(
      `Complete Capability ${config.number - 1} certificate first.`,
      `Önce Yetenek ${config.number - 1} sertifikasını tamamla.`,
    );
  } else if (certified) {
    description.textContent = uiText(
      `Capability ${config.number} is certified and ready to use inside FLOP.`,
      `Yetenek ${config.number} sertifikalı ve FLOP içinde kullanıma hazır.`,
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
    certificateList = { certificate_count: 0, certificates: [] };
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

async function practiceCapability1() {
  const config = configFor(1);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  const button = byId(config.practiceId);
  button.disabled = true;
  try {
    const fixture = await createCapability1PracticeFixture();
    const result = await executeEd25519SignatureVerification(fixture.input);
    const passed = result.valid === fixture.expected_valid;
    byId(config.practiceResultId).textContent = passed
      ? uiText("Practice passed. The capability correctly verified a sample Ed25519 signature.", "Pratik başarılı. Yetenek örnek bir Ed25519 imzasını doğru doğruladı.")
      : uiText("Practice failed. Try again.", "Pratik başarısız. Tekrar deneyebilirsin.");
  } finally { button.disabled = false; }
}

async function practiceCapability2() {
  const config = configFor(2);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  const button = byId(config.practiceId);
  button.disabled = true;
  try {
    const fixture = createCapability2PracticeFixture();
    const result = await executeCanonicalJsonSha256(fixture.input);
    const passed = result.canonical_json === fixture.expected.canonical_json && result.sha256 === fixture.expected.sha256;
    byId(config.practiceResultId).textContent = passed
      ? uiText("Practice passed. The capability canonicalized JSON and calculated the correct SHA256 hash.", "Pratik başarılı. Yetenek JSON'u canonical hale getirdi ve doğru SHA256 hashini hesapladı.")
      : uiText("Practice failed. Try again.", "Pratik başarısız. Tekrar deneyebilirsin.");
  } finally { button.disabled = false; }
}

async function certifyCapability(number, execute) {
  if (!identity || identity.mode !== "browser" || pendingSeed) throw new Error(t("err_identity_first"));
  const config = configFor(number);
  if (capabilityStates.get(config.capabilityId)?.installation?.status !== "INSTALLED") throw new Error("CAPABILITY_NOT_INSTALLED");
  const button = byId(config.verifyId);
  button.disabled = true;
  try {
    setOperation(uiText("Preparing a fresh test…", "Yeni test hazırlanıyor…"));
    const created = await jsonRequest("/api/v1/challenges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_did: identity.did, trial_id: config.trialId }),
    });
    const challenge = created.challenge;
    setOperation(uiText("The capability is solving the test…", "Yetenek testi çözüyor…"));
    const result = await execute(challenge.case);
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
    setOperation(uiText("FLOP is verifying the result…", "Sonuç FLOP tarafından doğrulanıyor…"));
    const submitted = await jsonRequest(`/api/v1/challenges/${challenge.challenge_id}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        payload,
        signature: { algorithm: "Ed25519", encoding: "base64url", value: bytesToBase64Url(signature) },
      }),
    });
    if (submitted.verdict !== "PASS" || !submitted.receipt_id || !submitted.certificate_id) {
      throw new Error("CERTIFICATION_DID_NOT_PRODUCE_CERTIFICATE");
    }
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
  let document;
  try {
    document = JSON.parse(byId("use-json-2").value);
  } catch {
    throw new Error(uiText("Enter valid JSON.", "Geçerli bir JSON gir."));
  }
  const result = await executeCanonicalJsonSha256({ document });
  byId("use-capability-2-result").textContent = JSON.stringify(result, null, 2);
}

async function disconnectIdentity() {
  await deleteIdentity();
  identity = null;
  pendingSeed = null;
  seedSavedAction = false;
  seedRevealed = false;
  setupPath = "create";
  capabilityStates = new Map();
  certificateList = { certificate_count: 0, certificates: [] };
  renderIdentity();
  setOperation(t("op_disconnected"));
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
byId("practice-capability-1").addEventListener("click", () => practiceCapability1().catch(report));
byId("verify-capability-1").addEventListener("click", () => certifyCapability(1, executeEd25519SignatureVerification).catch(report));
byId("use-capability-1-run").addEventListener("click", () => useCapability1().catch(report));
byId("acquire-capability-2").addEventListener("click", () => acquireCapability(2).catch(report));
byId("practice-capability-2").addEventListener("click", () => practiceCapability2().catch(report));
byId("verify-capability-2").addEventListener("click", () => certifyCapability(2, executeCanonicalJsonSha256).catch(report));
byId("use-capability-2-run").addEventListener("click", () => useCapability2().catch(report));
byId("download-backup").addEventListener("click", () => { if (identity?.backup) downloadBackup(identity.backup); });
byId("reset-identity").addEventListener("click", () => disconnectIdentity().catch(report));

boot();
