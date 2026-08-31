(() => {
  "use strict";
  const API_BASE = "https://flop-status-production.up.railway.app";
  const status = document.getElementById("signature-status");
  const fields = document.getElementById("receipt-fields");
  const errorNode = document.getElementById("verification-error");

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

  async function boot() {
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
    const valid = await crypto.subtle.verify({ name: "Ed25519" }, key, decode(signature), new TextEncoder().encode(canonicalize(receipt)));
    status.textContent = valid ? "VALID" : "INVALID";

    const labels = [
      ["Receipt ID", data.receipt.receipt_id],
      ["Agent DID", data.receipt.agent_did],
      ["Capability", data.receipt.capability_id],
      ["Trial", data.receipt.trial_id],
      ["Trial version", data.receipt.trial_version],
      ["Verifier", data.receipt.verifier_id],
      ["Verifier version", data.receipt.verifier_version],
      ["Verdict", data.receipt.verdict],
      ["Evidence type", data.receipt.evidence_type],
      ["Challenge hash", data.receipt.challenge_hash],
      ["Result hash", data.receipt.result_hash],
      ["Issued at", data.receipt.issued_at],
      ["Server key ID", data.receipt.server_key_id],
      ["Server key status", data.server_key.status],
    ];
    for (const [label, value] of labels) addField(label, value);
  }

  boot().catch((error) => {
    status.textContent = "UNAVAILABLE";
    errorNode.textContent = error instanceof Error ? error.message : String(error);
  });
})();
