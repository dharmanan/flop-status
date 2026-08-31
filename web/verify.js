import { bindLanguageControls, onLanguageChange, t } from "/i18n.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const status = document.getElementById("signature-status");
const fields = document.getElementById("receipt-fields");
const errorNode = document.getElementById("verification-error");
let verificationData = null;
let signatureValid = null;

function decode(value) {
  const pad = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalize(value[key])).join(",") + "}";
  throw new Error("unsupported canonical JSON value");
}

function addField(label, value) {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = String(value);
  fields.append(dt, dd);
}

function render() {
  if (signatureValid === true) status.textContent = t("valid");
  else if (signatureValid === false) status.textContent = t("invalid");
  else status.textContent = t("checking");

  fields.replaceChildren();
  if (!verificationData) return;
  const receipt = verificationData.receipt;
  const labels = [
    [t("receipt_id"), receipt.receipt_id],
    [t("agent_did"), receipt.agent_did],
    [t("capability"), receipt.capability_id],
    [t("trial"), receipt.trial_id],
    [t("trial_version"), receipt.trial_version],
    [t("verifier"), receipt.verifier_id],
    [t("verifier_version"), receipt.verifier_version],
    [t("verdict"), receipt.verdict],
    [t("evidence_type"), receipt.evidence_type],
    [t("challenge_hash"), receipt.challenge_hash],
    [t("result_hash"), receipt.result_hash],
    [t("issued_at"), receipt.issued_at],
    [t("server_key_id"), receipt.server_key_id],
    [t("server_key_status"), verificationData.server_key.status],
  ];
  for (const [label, value] of labels) addField(label, value);
}

async function boot() {
  bindLanguageControls();
  onLanguageChange(render);
  render();

  const match = location.pathname.match(/^\/verify\/([^/]+)$/);
  if (!match) throw new Error("receipt id missing from URL");
  const receiptId = match[1];
  const response = await fetch(API_BASE + "/api/v1/verification/" + encodeURIComponent(receiptId));
  if (!response.ok) throw new Error("verification API returned HTTP " + response.status);
  const data = await response.json();
  const receipt = { ...data.receipt };
  const signature = receipt.server_signature;
  delete receipt.server_signature;
  if (data.server_key.key_id !== receipt.server_key_id) throw new Error("server key id mismatch");
  const key = await crypto.subtle.importKey("raw", decode(data.server_key.public_key), { name: "Ed25519" }, false, ["verify"]);
  signatureValid = await crypto.subtle.verify({ name: "Ed25519" }, key, decode(signature), new TextEncoder().encode(canonicalize(receipt)));
  verificationData = data;
  render();
}

boot().catch((error) => {
  signatureValid = null;
  status.textContent = t("unavailable");
  errorNode.textContent = error instanceof Error ? error.message : String(error);
});
