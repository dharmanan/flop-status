import {
  base64UrlToBytes,
  bytesToBase64Url,
  createPortableIdentity,
  parseBackupJson,
  parseEd25519DidKey,
  restorePortableIdentity,
  serializeBackup,
} from "/identity-crypto.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const TRIAL_ID = "ed25519-signature-verification";
const TRIAL_VERSION = "1";
const SUBMISSION_VERSION = "1";
const CANONICALIZATION = "jcs-rfc8785-v1";
const DB_NAME = "flop-agent-key-v1";
const STORE_NAME = "identity";
const ACTIVE_ID = "active";
const encoder = new TextEncoder();
let identity = null;
let pendingExternal = null;

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
    await new Promise((resolve) => { tx.oncomplete = resolve; tx.onerror = resolve; tx.onabort = resolve; });
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
  const container = byId("capabilities");
  const link = byId("latest-receipt");
  container.replaceChildren();
  link.hidden = true;
  if (!data || !data.agent || data.agent.capabilities.length === 0) {
    byId("evidence-status").textContent = "No verified capability evidence yet.";
    return;
  }
  byId("evidence-status").textContent = "Durable server evidence recovered.";
  for (const capability of data.agent.capabilities) {
    const item = document.createElement("div");
    item.className = "capability";
    item.textContent = capability.capability_id + " · " + capability.evidence_type + " · passes " + capability.passed_trials;
    container.appendChild(item);
    if (capability.latest_receipt_id) {
      link.href = "/verify/" + capability.latest_receipt_id;
      link.hidden = false;
    }
  }
}

async function refreshEvidence() {
  if (!identity) {
    renderEvidence(null);
    return;
  }
  renderEvidence(await getAgentEvidence(identity.did));
}

function hideExternalSigning() {
  pendingExternal = null;
  byId("external-signing").hidden = true;
  byId("external-payload").value = "";
  byId("external-signature").value = "";
}

function renderIdentity() {
  const setup = byId("identity-setup");
  const actions = byId("active-actions");
  const run = byId("run-trial");
  const download = byId("download-backup");
  hideExternalSigning();

  if (!identity) {
    setup.hidden = false;
    actions.hidden = true;
    byId("identity-status").textContent = "Choose how this agent identity is controlled.";
    byId("did").textContent = "";
    byId("custody").textContent = "FLOP is not a private-key custodian.";
    byId("identity-mode").textContent = "none";
    byId("extractable-check").textContent = "n/a";
    byId("backup-check").textContent = "n/a";
    return;
  }

  setup.hidden = true;
  actions.hidden = false;
  run.disabled = false;
  byId("did").textContent = identity.did;

  if (identity.mode === "browser") {
    byId("identity-status").textContent = "Browser-owned identity ready.";
    byId("custody").textContent = "Active signing key is a nonextractable CryptoKey in IndexedDB. Recovery is an encrypted portable backup.";
    byId("identity-mode").textContent = "browser-owned";
    byId("extractable-check").textContent = identity.privateKey.extractable ? "YES · FAIL" : "NO · PASS";
    byId("backup-check").textContent = identity.backup ? "encrypted · ready" : "missing · legacy identity";
    download.hidden = !identity.backup;
  } else {
    byId("identity-status").textContent = "Existing DID connected.";
    byId("custody").textContent = "FLOP holds no private key for this DID. Control is proven only by a valid signed submission from its external signer.";
    byId("identity-mode").textContent = "external signer";
    byId("extractable-check").textContent = "not held by FLOP";
    byId("backup-check").textContent = "owned externally";
    download.hidden = true;
  }
}

function downloadBackup(backup) {
  const blob = new Blob([serializeBackup(backup)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "flop-identity-" + backup.did.slice(-12) + ".json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

async function createBrowserIdentity() {
  const passphrase = byId("create-passphrase").value;
  byId("create-identity").disabled = true;
  setOperation("Creating browser-owned Ed25519 identity and encrypted backup…");
  try {
    const created = await createPortableIdentity(passphrase);
    identity = { id: ACTIVE_ID, mode: "browser", did: created.did, publicKey: created.publicKey, privateKey: created.privateKey, backup: created.backup };
    await writeIdentity(identity);
    downloadBackup(created.backup);
    byId("create-passphrase").value = "";
    renderIdentity();
    await refreshEvidence();
    setOperation("Identity created. Encrypted recovery backup downloaded. Keep that file and its passphrase separately.");
  } finally { byId("create-identity").disabled = false; }
}

async function restoreBrowserIdentity() {
  const file = byId("restore-file").files[0];
  if (!file) throw new Error("choose an encrypted FLOP identity backup first");
  const passphrase = byId("restore-passphrase").value;
  byId("restore-identity").disabled = true;
  setOperation("Decrypting backup locally and restoring a nonextractable active key…");
  try {
    const backup = parseBackupJson(await file.text());
    const restored = await restorePortableIdentity(backup, passphrase);
    identity = { id: ACTIVE_ID, mode: "browser", did: restored.did, publicKey: restored.publicKey, privateKey: restored.privateKey, backup: restored.backup };
    await writeIdentity(identity);
    byId("restore-passphrase").value = "";
    byId("restore-file").value = "";
    renderIdentity();
    await refreshEvidence();
    setOperation("Identity restored locally. The active private key is nonextractable.");
  } finally { byId("restore-identity").disabled = false; }
}

async function connectExistingDid() {
  const did = byId("existing-did").value.trim();
  parseEd25519DidKey(did);
  identity = { id: ACTIVE_ID, mode: "external", did };
  await writeIdentity(identity);
  byId("existing-did").value = "";
  renderIdentity();
  await refreshEvidence();
  setOperation("Existing DID connected. FLOP has no private key. Run a trial to prove control with your external signer.");
}

async function prepareTrialPayload() {
  if (!identity) throw new Error("connect or create an identity first");
  setOperation("Creating DID-bound challenge…");
  const challengeResponse = await fetch(API_BASE + "/api/v1/challenges", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_did: identity.did, trial_id: TRIAL_ID }),
  });
  const created = await challengeResponse.json();
  if (!challengeResponse.ok) throw new Error(created.error ? created.error.code : "challenge creation failed");

  const challenge = created.challenge;
  const message = base64UrlToBytes(challenge.case.message);
  const challengePublicKey = await crypto.subtle.importKey("raw", base64UrlToBytes(challenge.case.public_key), { name: "Ed25519" }, false, ["verify"]);
  const valid = await crypto.subtle.verify({ name: "Ed25519" }, challengePublicKey, base64UrlToBytes(challenge.case.signature), message);
  const result = { valid, reason_code: valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID", message_hash: await sha256(message) };
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
  const envelope = { payload, signature: { algorithm: "Ed25519", encoding: "base64url", value: signatureValue } };
  const submitResponse = await fetch(API_BASE + "/api/v1/challenges/" + challengeId + "/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope),
  });
  const submitted = await submitResponse.json();
  if (!submitResponse.ok) throw new Error(submitted.error ? submitted.error.code : "submission failed");
  if (submitted.verdict !== "PASS" || !submitted.receipt_id) throw new Error("Trial 1 did not produce PASS");
  await refreshEvidence();
  return submitted;
}

async function runTrial() {
  if (!identity) throw new Error("identity is not ready");
  byId("run-trial").disabled = true;
  try {
    const prepared = await prepareTrialPayload();
    if (identity.mode === "external") {
      pendingExternal = prepared;
      byId("external-payload").value = prepared.canonicalPayload;
      byId("external-signing").hidden = false;
      setOperation("Challenge ready. Sign the exact canonical payload with the external DID signer, then paste its base64url Ed25519 signature.");
      return;
    }

    const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, encoder.encode(prepared.canonicalPayload)));
    setOperation("Submitting browser-signed result…");
    await submitEnvelope(prepared.challenge.challenge_id, prepared.payload, bytesToBase64Url(signature));
    setOperation("PASS. Receipt persisted on Railway and is publicly verifiable.");
  } finally { byId("run-trial").disabled = false; }
}

async function submitExternalSignature() {
  if (!identity || identity.mode !== "external" || !pendingExternal) throw new Error("no external signing request is pending");
  const signatureValue = byId("external-signature").value.trim();
  const signature = base64UrlToBytes(signatureValue);
  if (signature.length !== 64) throw new Error("Ed25519 signature must decode to 64 bytes");
  const publicKey = await crypto.subtle.importKey("raw", parseEd25519DidKey(identity.did), { name: "Ed25519" }, false, ["verify"]);
  const locallyValid = await crypto.subtle.verify({ name: "Ed25519" }, publicKey, signature, encoder.encode(pendingExternal.canonicalPayload));
  if (!locallyValid) throw new Error("signature does not prove control of the connected DID for this exact payload");
  byId("submit-external-signature").disabled = true;
  setOperation("External DID signature is valid locally. Submitting to Capability Lab…");
  try {
    await submitEnvelope(pendingExternal.challenge.challenge_id, pendingExternal.payload, signatureValue);
    hideExternalSigning();
    setOperation("PASS. External DID control was proven by signature; FLOP never received its private key.");
  } finally { byId("submit-external-signature").disabled = false; }
}

async function disconnectIdentity() {
  await deleteIdentity();
  identity = null;
  renderIdentity();
  await refreshEvidence();
  setOperation("Local identity connection removed. No server-side private key existed to delete.");
}

async function boot() {
  try {
    const stored = await readIdentity();
    identity = normalizedIdentity(stored);
    renderIdentity();
    await refreshEvidence();
    if (identity) setOperation("Identity recovered from this browser.");
  } catch (error) {
    identity = null;
    renderIdentity();
    setOperation(error instanceof Error ? error.message : String(error));
  }
}

function report(error) {
  setOperation(error instanceof Error ? error.message : String(error));
}

byId("create-identity").addEventListener("click", () => createBrowserIdentity().catch(report));
byId("restore-identity").addEventListener("click", () => restoreBrowserIdentity().catch(report));
byId("connect-existing").addEventListener("click", () => connectExistingDid().catch(report));
byId("run-trial").addEventListener("click", () => runTrial().catch(report));
byId("download-backup").addEventListener("click", () => {
  if (identity && identity.mode === "browser" && identity.backup) downloadBackup(identity.backup);
});
byId("reset-identity").addEventListener("click", () => disconnectIdentity().catch(report));
byId("submit-external-signature").addEventListener("click", () => submitExternalSignature().catch(report));
byId("cancel-external-signing").addEventListener("click", () => { hideExternalSigning(); setOperation("External signing request cancelled locally."); });

boot();
