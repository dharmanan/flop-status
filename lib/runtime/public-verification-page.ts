import { encodeBase64Url } from "../crypto/base64url.js";
import type { PublicReceiptVerification } from "../verification/public-verification-service.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function row(label: string, value: string): string {
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

export function renderPublicVerificationPage(verification: PublicReceiptVerification): string {
  const { receipt, server_key: serverKey } = verification;
  const browserData = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify({ receipt, server_key: serverKey })),
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FLOP Receipt Verification</title>
<link rel="stylesheet" href="/assets/verify.css">
</head>
<body data-verification="${browserData}">
<main>
<p class="eyebrow">FLOP Capability Lab</p>
<h1>Receipt verification</h1>
<p class="status">Receipt signature: <strong id="receipt-signature-status">CHECKING</strong></p>
<dl>
${row("Receipt ID", receipt.receipt_id)}
${row("Agent DID", receipt.agent_did)}
${row("Capability", receipt.capability_id)}
${row("Trial", receipt.trial_id)}
${row("Trial version", receipt.trial_version)}
${row("Verifier", receipt.verifier_id)}
${row("Verifier version", receipt.verifier_version)}
${row("Verdict", receipt.verdict)}
${row("Evidence type", receipt.evidence_type)}
${row("Challenge hash", receipt.challenge_hash)}
${row("Result hash", receipt.result_hash)}
${row("Issued at", receipt.issued_at)}
${row("Server key ID", receipt.server_key_id)}
${row("Server key status", serverKey.status)}
</dl>
<p class="note">This page verifies the stored receipt signature in this browser using the public Ed25519 key shown by the service. It does not prove model provenance or absence of human assistance.</p>
</main>
<script src="/assets/verify.js" defer></script>
</body>
</html>`;
}

export const PUBLIC_VERIFICATION_SCRIPT = `(() => {
  const status = document.getElementById("receipt-signature-status");
  const fail = (value) => { if (status) status.textContent = value; };
  try {
    const encoded = document.body.dataset.verification;
    if (!encoded) throw new Error("missing verification data");
    const pad = "=".repeat((4 - encoded.length % 4) % 4);
    const json = atob(encoded.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const bytes = Uint8Array.from(json, c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const receipt = { ...data.receipt };
    const signatureValue = receipt.server_signature;
    delete receipt.server_signature;
    if (data.server_key.key_id !== receipt.server_key_id) throw new Error("key id mismatch");
    if (data.server_key.algorithm !== "Ed25519" || data.server_key.encoding !== "base64url") {
      throw new Error("unsupported key metadata");
    }
    const decode = (value) => {
      const p = "=".repeat((4 - value.length % 4) % 4);
      const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + p);
      return Uint8Array.from(binary, c => c.charCodeAt(0));
    };
    const canonical = "{" + Object.keys(receipt).sort().map(
      key => JSON.stringify(key) + ":" + JSON.stringify(receipt[key])
    ).join(",") + "}";
    Promise.resolve().then(async () => {
      const publicKey = await crypto.subtle.importKey(
        "raw", decode(data.server_key.public_key), { name: "Ed25519" }, false, ["verify"]
      );
      const valid = await crypto.subtle.verify(
        { name: "Ed25519" }, publicKey, decode(signatureValue), new TextEncoder().encode(canonical)
      );
      if (status) {
        status.textContent = valid ? "VALID" : "INVALID";
        status.dataset.browserVerified = "true";
      }
    }).catch(() => fail("UNAVAILABLE"));
  } catch {
    fail("UNAVAILABLE");
  }
})();`;

export const PUBLIC_VERIFICATION_CSS = `
:root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; background: #111; color: #f5f5f5; }
main { width: min(920px, calc(100% - 40px)); margin: 64px auto; }
.eyebrow { opacity: .6; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
h1 { font-size: clamp(36px, 7vw, 72px); margin: 12px 0 28px; letter-spacing: -.04em; }
.status { font-size: 20px; padding: 18px 0; border-top: 1px solid #333; border-bottom: 1px solid #333; }
dl { display: grid; grid-template-columns: minmax(140px, 220px) 1fr; gap: 0; margin: 28px 0; }
dt, dd { margin: 0; padding: 12px 0; border-bottom: 1px solid #292929; overflow-wrap: anywhere; }
dt { opacity: .55; padding-right: 20px; }
.note { max-width: 720px; opacity: .55; line-height: 1.55; }
@media (max-width: 640px) { dl { grid-template-columns: 1fr; } dt { border-bottom: 0; padding-bottom: 2px; } dd { padding-top: 2px; } }
`;
