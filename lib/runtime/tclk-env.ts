// Shared, fail-closed resolution for the two external TCLK/Technocore
// endpoints. Every raw TCLK room read and every PaperRail read/write must
// resolve the venue through resolveTechnocoreUrl() so they can never split
// onto different Technocore hosts. Neither resolver has a built-in default:
// this test environment must never silently talk to a remote hosted service.

export class TclkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TclkConfigError";
  }
}

/**
 * Reduces a Technocore venue URL to one canonical string so the same venue
 * can never persist under two different identities (e.g. a trailing slash,
 * mixed-case host, or redundant default port). Deliberately narrow: a venue
 * is exactly an origin, so anything beyond scheme+host+port — credentials,
 * a path, a query, a fragment — is rejected rather than silently folded in
 * or dropped, since either would hide a likely misconfiguration.
 */
export function canonicalizeVenueUrl(raw: string): string {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TclkConfigError(`TECHNOCORE_URL is not a valid URL: ${JSON.stringify(raw)}`);
  }
  if (parsed.protocol !== "https:") {
    throw new TclkConfigError("TECHNOCORE_URL must use https://");
  }
  if (parsed.username || parsed.password) {
    throw new TclkConfigError("TECHNOCORE_URL must not include credentials");
  }
  if (parsed.search) {
    throw new TclkConfigError("TECHNOCORE_URL must not include a query string");
  }
  if (parsed.hash) {
    throw new TclkConfigError("TECHNOCORE_URL must not include a fragment");
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new TclkConfigError("TECHNOCORE_URL must be a bare origin, with no path");
  }
  return parsed.origin;
}

export function resolveTechnocoreUrl(): string {
  const value = process.env.TECHNOCORE_URL?.trim();
  if (!value) {
    throw new TclkConfigError(
      "TECHNOCORE_URL is not configured. This environment has no default Technocore venue; set TECHNOCORE_URL explicitly before using TCLK raw-room or PaperRail paths.",
    );
  }
  return canonicalizeVenueUrl(value);
}

export function resolveTclkMcpUrl(): string {
  const value = process.env.TCLK_MCP_URL?.trim();
  if (!value) {
    throw new TclkConfigError(
      "TCLK_MCP_URL is not configured. This environment has no default TCLK MCP endpoint; set TCLK_MCP_URL explicitly before using TCLK MCP-backed paths.",
    );
  }
  return value;
}
