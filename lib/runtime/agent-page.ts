export const PUBLIC_AGENT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FLOP Agent Capability Lab</title>
<link rel="stylesheet" href="/assets/agent.css">
</head>
<body>
<main>
<p class="eyebrow">FLOP Capability Lab</p>
<h1>Your agent says what it can do. We test it.</h1>
<section class="panel">
<div class="label">Browser identity</div>
<div id="identity-status" class="status">Loading secure browser key…</div>
<div id="did" class="mono"></div>
<div id="custody" class="muted"></div>
</section>
<section class="actions">
<button id="run-trial" disabled>Run Ed25519 trial</button>
<button id="reset-identity" class="secondary">Reset local identity</button>
</section>
<section class="panel">
<div class="label">Server evidence</div>
<div id="evidence-status" class="status">Waiting for identity…</div>
<div id="capabilities"></div>
<a id="latest-receipt" class="receipt" hidden>Open latest verified receipt</a>
</section>
<section class="panel checks">
<div class="label">Custody checks</div>
<div>Private key storage <strong>IndexedDB CryptoKey</strong></div>
<div>Private key exportable <strong id="extractable-check">checking</strong></div>
<div>Private key network transfer <strong>never</strong></div>
</section>
<p id="operation-status" class="operation"></p>
</main>
<script src="/assets/agent.js" defer></script>
</body>
</html>`;

export const PUBLIC_AGENT_SCRIPT = `(() => {
  "use strict";
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
    return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
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
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
    if (typeof value === "object") {
      return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalize(value[key])).join(",") + "}";
    }
    throw new Error("unsupported canonical JSON value");
  }

  async function sha256(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return "sha256:" + bytesToBase64Url(digest);
  }

  function request(requestValue) {
    return new Promise((resolve, reject) => {
      requestValue.onsuccess = () => resolve(requestValue.result);
      requestValue.onerror = () => reject(requestValue.error);
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
    } finally {
      db.close();
    }
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
    } finally {
      db.close();
    }
  }

  async function deleteIdentity() {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      await request(tx.objectStore(STORE_NAME).delete(ACTIVE_ID));
    } finally {
      db.close();
    }
  }

  async function createIdentity() {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    if (pair.privateKey.extractable) throw new Error("browser created an extractable private key");
    const rawPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const record = {
      id: ACTIVE_ID,
      did: didFromPublicKey(rawPublic),
      publicKey: pair.publicKey,
      privateKey: pair.privateKey,
    };
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
    const response = await fetch("/api/v1/agents/" + encodeURIComponent(did));
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
      const challengeResponse = await fetch("/api/v1/challenges", {
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
      const payloadBytes = encoder.encode(canonicalize(payload));
      const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, payloadBytes));
      const envelope = {
        payload,
        signature: { algorithm: "Ed25519", encoding: "base64url", value: bytesToBase64Url(signature) },
      };

      setOperation("Submitting browser-signed result…");
      const submitResponse = await fetch("/api/v1/challenges/" + challenge.challenge_id + "/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const submitted = await submitResponse.json();
      if (!submitResponse.ok) throw new Error(submitted.error ? submitted.error.code : "submission failed");
      if (submitted.verdict !== "PASS" || !submitted.receipt_id) throw new Error("Trial 1 did not produce PASS");
      await refreshEvidence();
      setOperation("PASS. Receipt persisted on the server. Hard refresh this page to test recovery.");
    } finally {
      byId("run-trial").disabled = false;
    }
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

  byId("run-trial").addEventListener("click", () => {
    runTrial().catch((error) => setOperation(error instanceof Error ? error.message : String(error)));
  });
  byId("reset-identity").addEventListener("click", () => {
    deleteIdentity().then(() => location.reload()).catch((error) => setOperation(error instanceof Error ? error.message : String(error)));
  });
  boot();
})();`;

export const PUBLIC_AGENT_CSS = `
:root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; background: #111; color: #f4f4f4; }
main { width: min(920px, calc(100% - 40px)); margin: 64px auto; }
.eyebrow, .label { opacity: .55; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
h1 { max-width: 820px; font-size: clamp(40px, 7vw, 78px); line-height: .96; margin: 14px 0 44px; letter-spacing: -.045em; }
.panel { border-top: 1px solid #333; padding: 22px 0 26px; }
.status { margin: 10px 0; font-size: 19px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; line-height: 1.45; }
.muted, .operation { opacity: .62; line-height: 1.5; }
.actions { display: flex; gap: 10px; margin: 10px 0 34px; flex-wrap: wrap; }
button { appearance: none; border: 1px solid #eee; background: #eee; color: #111; padding: 12px 16px; border-radius: 999px; cursor: pointer; font: inherit; }
button:disabled { opacity: .35; cursor: default; }
button.secondary { background: transparent; color: #eee; border-color: #444; }
.capability { padding: 12px 0; border-bottom: 1px solid #292929; overflow-wrap: anywhere; }
.receipt { display: inline-block; margin-top: 18px; color: inherit; }
.checks > div:not(.label) { padding: 7px 0; }
.operation { min-height: 24px; }
`;
