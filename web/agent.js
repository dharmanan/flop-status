(() => {
  "use strict";

  const API_BASE = "https://flop-status-production.up.railway.app";
  const TRIAL_ID = "ed25519-signature-verification";
  const TRIAL_VERSION = "1";
  const SUBMISSION_VERSION = "1";
  const CANONICALIZATION = "jcs-rfc8785-v1";
  const DB_NAME = "flop-agent-key-v1";
  const STORE_NAME = "identity";
  const ACTIVE_ID = "active";
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const encoder = new TextEncoder();
  let identity = null;

  const byId = (id) => document.getElementById(id);
  const setOperation = (value) => { byId("operation-status").textContent = value; };

  function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    const pad = "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function base58(bytes) {
    if (bytes.length === 0) return "";
    const digits = [0];
    for (const byte of bytes) {
      let carry = byte;
      for (let i = 0; i < digits.length; i += 1) {
        carry += digits[i] * 256;
        digits[i] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = Math.floor(carry / 58);
      }
    }
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
    let output = "1".repeat(zeros);
    for (let i = digits.length - 1; i >= 0; i -= 1) output += alphabet[digits[i]];
    return output;
  }

  function didFromPublicKey(raw) {
    const prefixed = new Uint8Array(raw.length + 2);
    prefixed.set([0xed, 0x01], 0);
    prefixed.set(raw, 2);
    return "did:key:z" + base58(prefixed);
  }

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
    } finally { db.close(); }
  }

  async function createIdentity() {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    if (pair.privateKey.extractable) throw new Error("browser created an extractable private key");
    const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const record = { id: ACTIVE_ID, did: didFromPublicKey(rawPublic), publicKey: pair.publicKey, privateKey: pair.privateKey };
    await writeIdentity(record);
    return record;
  }

  async function ensureIdentity() {
    const existing = await readIdentity();
    if (existing && existing.privateKey && existing.publicKey && existing.did) {
      if (existing.privateKey.extractable) throw new Error("stored private key is unexpectedly extractable");
      return existing;
    }
    return createIdentity();
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
    if (!identity) return;
    renderEvidence(await getAgentEvidence(identity.did));
  }

  async function runTrial() {
    if (!identity) throw new Error("browser identity is not ready");
    byId("run-trial").disabled = true;
    setOperation("Creating DID-bound challenge…");
    try {
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
      const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, encoder.encode(canonicalize(payload))));
      const envelope = { payload, signature: { algorithm: "Ed25519", encoding: "base64url", value: bytesToBase64Url(signature) } };

      setOperation("Submitting browser-signed result…");
      const submitResponse = await fetch(API_BASE + "/api/v1/challenges/" + challenge.challenge_id + "/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const submitted = await submitResponse.json();
      if (!submitResponse.ok) throw new Error(submitted.error ? submitted.error.code : "submission failed");
      if (submitted.verdict !== "PASS" || !submitted.receipt_id) throw new Error("Trial 1 did not produce PASS");
      await refreshEvidence();
      setOperation("PASS. Receipt persisted on Railway. Hard refresh this Vercel page to test recovery.");
    } finally { byId("run-trial").disabled = false; }
  }

  async function boot() {
    try {
      identity = await ensureIdentity();
      byId("identity-status").textContent = "Secure browser identity ready.";
      byId("did").textContent = identity.did;
      byId("custody").textContent = "Private signing CryptoKey is nonextractable and stored in IndexedDB.";
      byId("extractable-check").textContent = identity.privateKey.extractable ? "YES · FAIL" : "NO · PASS";
      byId("run-trial").disabled = false;
      await refreshEvidence();
    } catch (error) {
      byId("identity-status").textContent = "Browser custody unavailable.";
      setOperation(error instanceof Error ? error.message : String(error));
    }
  }

  byId("run-trial").addEventListener("click", () => runTrial().catch((error) => setOperation(error instanceof Error ? error.message : String(error))));
  byId("reset-identity").addEventListener("click", () => deleteIdentity().then(() => location.reload()).catch((error) => setOperation(error instanceof Error ? error.message : String(error))));
  boot();
})();
