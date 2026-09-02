// Small, framework-free module for the single most security-critical TCLK
// guarantee: a public Technocore room record is untrusted until FLOP
// independently re-verifies its raw transport signature AND confirms the
// decoded frame's `from` actually equals that verified signer. Kept free of
// any DOM/network/identity-storage dependency (only identity-crypto.js's pure
// DID-parsing helper) so it is directly unit-testable without a browser.

import { base64UrlToBytes, parseEd25519DidKey } from "/identity-crypto.js";

const encoder = new TextEncoder();

export async function verifyTransport(room, message) {
  try {
    if (
      typeof message?.from !== "string" ||
      typeof message?.sig !== "string" ||
      message?.nonce === undefined ||
      typeof message?.text !== "string"
    ) {
      return false;
    }
    const rawKey = parseEd25519DidKey(message.from);
    const key = await crypto.subtle.importKey("raw", rawKey, { name: "Ed25519" }, false, ["verify"]);
    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64UrlToBytes(message.sig),
      encoder.encode(`${room}|${message.nonce}|${message.text}`),
    );
  } catch {
    return false;
  }
}

// A decoded TCLK frame only becomes trusted transcript input when the raw
// transport signature is valid AND the raw signer, the MCP-decoded record
// sender, and the frame's own internal `from` field all agree — this is what
// stops a world-writable room line from advancing a deal merely by putting
// another DID in `frame.from`.
export function evaluateFrameTrust(item, message, transportValid) {
  const fromMatches = item?.frame?.from === item?.from && item?.from === message.from;
  return { fromMatches, trusted: Boolean(transportValid) && fromMatches };
}
