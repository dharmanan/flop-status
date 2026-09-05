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

export const TECHNOCORE_INGRESS_HEADER = "x-flop-proof-technocore-token";

export function resolveTechnocoreIngressToken(): string | null {
  const value = process.env.TECHNOCORE_INGRESS_TOKEN?.trim();
  if (!value) return null;
  if (value.length < 32) {
    throw new TclkConfigError("TECHNOCORE_INGRESS_TOKEN must be at least 32 characters when configured");
  }
  return value;
}

/**
 * The protected self-hosted origin is normally the current TECHNOCORE_URL.
 * After a future switch back to hosted Technocore, maintenance jobs can keep
 * access to old self-hosted history by setting TECHNOCORE_INGRESS_ORIGIN
 * explicitly. The official hosted origin is never allowed here.
 */
export function resolveTechnocoreIngressOrigin(): string | null {
  const explicit = process.env.TECHNOCORE_INGRESS_ORIGIN?.trim();
  if (explicit) {
    const origin = canonicalizeVenueUrl(explicit);
    if (origin === "https://technocore.chat") {
      throw new TclkConfigError("TECHNOCORE_INGRESS_ORIGIN must not be the official hosted Technocore origin");
    }
    return origin;
  }

  if (!resolveTechnocoreIngressToken()) return null;
  const current = resolveTechnocoreUrl();
  return current === "https://technocore.chat" ? null : current;
}

/**
 * Adds the deployment ingress credential only to the configured protected
 * self-hosted Technocore origin. It can never leak the token to
 * https://technocore.chat or to another historical venue.
 */
export function createTechnocoreFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  const token = resolveTechnocoreIngressToken();
  const protectedOrigin = resolveTechnocoreIngressOrigin();
  if (!token || !protectedOrigin) return fetchImpl;

  return (input, init) => {
    const target = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (target.origin !== protectedOrigin) return fetchImpl(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(TECHNOCORE_INGRESS_HEADER, token);
    return fetchImpl(input, { ...init, headers });
  };
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
