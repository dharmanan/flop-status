import {
  base64UrlToBytes,
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

const API_BASE = "https://flop-status-production.up.railway.app";
const TRIAL_ID = "ed25519-signature-verification";
const TRIAL_VERSION = "1";
const SUBMISSION_VERSION = "1";
const CANONICALIZATION = "jcs-rfc8785-v1";
const DB_NAME = "flop-agent-key-v1";
const STORE_NAME = "identity";
const ACTIVE_ID = "active";
const MASKED_SEED = "•••• •••• •••• •••• •••• •••• •••• ••••";
const encoder = new TextEncoder();

let identity = null;
let pendingSeed = null;
let seedSavedAction = false;
let seedRevealed = false;
let evidenceData = null;
let setupPath = "create";

const byId = (id) => document.getElementById(id);
const setOperation = (value) => { byId("operation-status").textContent = value; };

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalize(value[key])).join(",") + "}";
  throw new Error("unsupported canonical JSON value");
}

async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return "sha256:" + bytesToBase64Url(digest);
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

async function getAgentEvidence(did) {
  const response = await fetch(API_BASE + "/api/v1/agents/" + encodeURIComponent(did));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("agent evidence read failed with HTTP " + response.status);
  return response.json();
}

function renderEvidence(data) {
  evidenceData = data;
  const container = byId("capabilities");
  const link = byId("latest-receipt");
  container.replaceChildren();
  link.hidden = true;
  if (!data || !data.agent || data.agent.capabilities.length === 0) {
    byId("evidence-status").textContent = t("no_evidence");
    return;
  }
  byId("evidence-status").textContent = t("durable_evidence");
  for (const capability of data.agent.capabilities) {
    const item = document.createElement("div");
    item.className = "capability";
    item.textContent = capability.capability_id + " · " + capability.evidence_type + " · " + t("passes") + " " + capability.passed_trials;
    container.appendChild(item);
    if (capability.latest_receipt_id) {
      link.href = "/verify/" + capability.latest_receipt_id;
      link.hidden = false;
    }
  }
}

async function refreshEvidence() {
  if (!identity) return renderEvidence(null);
  renderEvidence(await getAgentEvidence(identity.did));
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

function renderIdentity() {
  const setup = byId("identity-setup");
  const summary = byId("identity-summary");
  const actions = byId("active-actions");
  const evidencePanel = byId("evidence-panel");
  const technical = byId("technical-details");
  const run = byId("run-trial");
  const backupRow = byId("backup-download-row");
  const apiNote = byId("external-api-note");

  if (pendingSeed && identity) {
    setup.hidden = true;
    summary.hidden = false;
    actions.hidden = true;
    evidencePanel.hidden = true;
    technical.hidden = false;
    apiNote.hidden = true;
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
    apiNote.hidden = true;
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
    run.hidden = false;
    run.disabled = false;
    apiNote.hidden = true;
    byId("identity-status").textContent = t("browser_ready");
    byId("custody").textContent = t("browser_custody");
    byId("identity-mode").textContent = t("browser_owned");
    byId("extractable-check").textContent = t("nonextractable");
    byId("backup-check").textContent = identity.backup ? t("encrypted_ready") : t("optional_none");
    backupRow.hidden = !identity.backup;
  } else {
    run.hidden = true;
    apiNote.hidden = false;
    byId("identity-status").textContent = t("existing_connected");
    byId("custody").textContent = t("external_custody");
    byId("identity-mode").textContent = t("external_signer_mode");
    byId("extractable-check").textContent = t("not_held");
    byId("backup-check").textContent = t("owned_externally");
    backupRow.hidden = true;
  }
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
    identity = {
      id: ACTIVE_ID,
      mode: "browser",
      did: created.did,
      publicKey: created.publicKey,
      privateKey: created.privateKey,
      backup: null,
    };
    pendingSeed = created.seedHex;
    seedSavedAction = false;
    seedRevealed = false;
    renderIdentity();
    await refreshEvidence();
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
  downloadText(
    serializeIdentitySeed(identity.did, pendingSeed),
    "flop-identity-" + identity.did.slice(-8) + ".txt",
    "text/plain",
  );
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
  await refreshEvidence();
  setOperation(t("op_seed_confirmed"));
}

async function signInFromSeed() {
  let source = byId("seed-input").value.trim();
  const file = byId("seed-file").files[0];
  if (!source && file) source = await file.text();
  if (!source) throw new Error(t("err_seed_missing"));
  setOperation(t("op_seed_signin"));
  const restored = await identityFromSeed(source);
  identity = {
    id: ACTIVE_ID,
    mode: "browser",
    did: restored.did,
    publicKey: restored.publicKey,
    privateKey: restored.privateKey,
    backup: null,
  };
  await writeIdentity(identity);
  byId("seed-input").value = "";
  byId("seed-file").value = "";
  syncFileName("seed-file", "seed-file-name");
  renderIdentity();
  await refreshEvidence();
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
    identity = {
      id: ACTIVE_ID,
      mode: "browser",
      did: restored.did,
      publicKey: restored.publicKey,
      privateKey: restored.privateKey,
      backup: restored.backup,
    };
    await writeIdentity(identity);
    byId("restore-passphrase").value = "";
    byId("restore-file").value = "";
    syncFileName("restore-file", "restore-file-name");
    renderIdentity();
    await refreshEvidence();
    setOperation(t("op_restored"));
  } finally {
    byId("restore-identity").disabled = false;
  }
}

async function prepareTrialPayload() {
  if (!identity || identity.mode !== "browser" || pendingSeed) throw new Error(t("err_identity_first"));
  setOperation(t("op_challenge"));
  const challengeResponse = await fetch(API_BASE + "/api/v1/challenges", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_did: identity.did, trial_id: TRIAL_ID }),
  });
  const created = await challengeResponse.json();
  if (!challengeResponse.ok) throw new Error(created.error ? created.error.code : "challenge creation failed");

  const challenge = created.challenge;
  const message = base64UrlToBytes(challenge.case.message);
  const challengePublicKey = await crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(challenge.case.public_key),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    challengePublicKey,
    base64UrlToBytes(challenge.case.signature),
    message,
  );
  const result = {
    valid,
    reason_code: valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID",
    message_hash: await sha256(message),
  };
  const payload = {
    submission_version: SUBMISSION_VERSION,
    canonicalization: CANONICALIZATION,
    challenge_id: challenge.challenge_id,
    challenge_hash: created.challenge_hash,
    agent_did: identity.did,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    result,
    submitted_at: new Date().toISOString(),
  };
  return { challenge, payload, canonicalPayload: canonicalize(payload) };
}

async function submitEnvelope(challengeId, payload, signatureValue) {
  const envelope = {
    payload,
    signature: { algorithm: "Ed25519", encoding: "base64url", value: signatureValue },
  };
  const submitResponse = await fetch(
    API_BASE + "/api/v1/challenges/" + challengeId + "/submissions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    },
  );
  const submitted = await submitResponse.json();
  if (!submitResponse.ok) throw new Error(submitted.error ? submitted.error.code : "submission failed");
  if (submitted.verdict !== "PASS" || !submitted.receipt_id) throw new Error("Trial 1 did not produce PASS");
  await refreshEvidence();
  return submitted;
}

async function runTrial() {
  if (!identity || identity.mode !== "browser" || pendingSeed) throw new Error(t("err_identity_first"));
  byId("run-trial").disabled = true;
  try {
    const prepared = await prepareTrialPayload();
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        { name: "Ed25519" },
        identity.privateKey,
        encoder.encode(prepared.canonicalPayload),
      ),
    );
    setOperation(t("op_submitting"));
    await submitEnvelope(
      prepared.challenge.challenge_id,
      prepared.payload,
      bytesToBase64Url(signature),
    );
    setOperation(t("op_pass"));
  } finally {
    byId("run-trial").disabled = false;
  }
}

async function disconnectIdentity() {
  await deleteIdentity();
  identity = null;
  pendingSeed = null;
  seedSavedAction = false;
  seedRevealed = false;
  setupPath = "create";
  renderIdentity();
  await refreshEvidence();
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
    renderEvidence(evidenceData);
    syncFileName("seed-file", "seed-file-name");
    syncFileName("restore-file", "restore-file-name");
  });

  try {
    const stored = await readIdentity();
    identity = normalizedIdentity(stored);
    renderIdentity();
    await refreshEvidence();
    if (identity) setOperation(t("op_recovered"));
  } catch (error) {
    identity = null;
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
byId("run-trial").addEventListener("click", () => runTrial().catch(report));
byId("download-backup").addEventListener("click", () => {
  if (identity?.backup) downloadBackup(identity.backup);
});
byId("reset-identity").addEventListener("click", () => disconnectIdentity().catch(report));

boot();
