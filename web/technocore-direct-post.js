// The final write leg of TCLK's browser-signed post flow, and nothing else.
//
// The hosted TCLK MCP has no signing key, so tclk_post_frame's first call
// returns a signing challenge (room, nonce, canonical, text) instead of
// posting anything. The browser signs `canonical` locally with its
// nonextractable Ed25519 key. Previously the signed record was relayed back
// through a second tclk_post_frame MCP call; this module instead POSTs it
// directly from the browser to Technocore, since production has verified
// Technocore's CORS and the CSP change allow it. Everything upstream of this
// — frame construction, room derivation, the challenge itself, and signing —
// is unchanged and untouched by this file. This module never sees, and must
// never be given, the private key: only the already-produced did/signature.

const TECHNOCORE_BASE_URL = "https://technocore.chat";

// The Technocore/TCLK room grammar: lowercase alphanumeric, "_" and "-",
// starting with an alphanumeric, up to 48 characters.
const ROOM_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export class TechnocoreDirectPostError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "TechnocoreDirectPostError";
    if (detail && typeof detail === "object") Object.assign(this, detail);
  }
}

// Pulls one short, human-useful line out of a rejection response body: Technocore's
// own error field when the body is JSON, otherwise the first non-blank line of raw
// text. Capped so a large/unexpected body can never bloat the surfaced error.
function firstUsefulLine(bodyText) {
  const raw = String(bodyText ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const candidate = parsed.error?.message ?? parsed.error ?? parsed.message ?? parsed.code;
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 300);
    }
  } catch {
    // Not JSON (or not an object) — fall through to the raw-text line below.
  }
  const line = raw.split("\n").find((entry) => entry.trim().length > 0) ?? "";
  return line.trim().slice(0, 300);
}

/**
 * POSTs one already-signed TCLK record directly to Technocore. `challenge`
 * must be the exact { nonce, text } the hosted MCP's signing challenge
 * returned, and `signed` the exact { did, signature } produced by signing
 * `challenge.canonical` — this function does not reconstruct, re-derive, or
 * modify either. Resolves only on an HTTP 2xx response; every other outcome
 * (a non-2xx response, or the fetch itself failing — network/CORS/etc.)
 * throws instead of retrying or pretending the record was posted.
 *
 * @param {string} room
 * @param {{nonce: number | string, text: string}} challenge
 * @param {{did: string, signature: string}} signed
 * @returns {Promise<{posted: true}>}
 */
export async function postSignedRecordDirect(room, challenge, signed) {
  if (typeof room !== "string" || !ROOM_RE.test(room)) {
    throw new TechnocoreDirectPostError(`Refusing to post: invalid Technocore room name ${JSON.stringify(room)}`);
  }

  const url = `${TECHNOCORE_BASE_URL}/r/${encodeURIComponent(room)}?format=json`;
  const body = JSON.stringify({
    did: signed.did,
    sig: signed.signature,
    nonce: String(challenge.nonce),
    text: challenge.text,
  });

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch (error) {
    throw new TechnocoreDirectPostError(
      `Could not reach Technocore directly: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (!response.ok) {
    let bodyText = "";
    try { bodyText = await response.text(); } catch { bodyText = ""; }
    const detail = firstUsefulLine(bodyText);
    throw new TechnocoreDirectPostError(
      `Technocore rejected the direct post: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
      { status: response.status, body: bodyText },
    );
  }

  return { posted: true };
}
