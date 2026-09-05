import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalizeVenueUrl, createTechnocoreFetch, resolveTechnocoreIngressOrigin, resolveTechnocoreIngressToken, resolveTechnocoreUrl, resolveTclkMcpUrl, TECHNOCORE_INGRESS_HEADER, TclkConfigError } from "../../lib/runtime/tclk-env.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("canonicalizeVenueUrl", () => {
  it("strips a trailing slash", () => {
    expect(canonicalizeVenueUrl("https://technocore.chat/")).toBe("https://technocore.chat");
  });

  it("is a no-op on an already-canonical origin", () => {
    expect(canonicalizeVenueUrl("https://technocore.chat")).toBe("https://technocore.chat");
  });

  it("lowercases a mixed-case host", () => {
    expect(canonicalizeVenueUrl("https://SELFHOST.EXAMPLE.INVALID/")).toBe("https://selfhost.example.invalid");
  });

  it("trims surrounding whitespace", () => {
    expect(canonicalizeVenueUrl("  https://technocore.chat  ")).toBe("https://technocore.chat");
  });

  it("strips a redundant default port", () => {
    expect(canonicalizeVenueUrl("https://technocore.chat:443/")).toBe("https://technocore.chat");
  });

  it("rejects a non-https scheme", () => {
    expect(() => canonicalizeVenueUrl("http://technocore.chat")).toThrow(TclkConfigError);
  });

  it("rejects a malformed URL", () => {
    expect(() => canonicalizeVenueUrl("not a url")).toThrow(TclkConfigError);
  });

  it("rejects embedded credentials", () => {
    expect(() => canonicalizeVenueUrl("https://user:pass@technocore.chat")).toThrow(TclkConfigError);
  });

  it("rejects a query string", () => {
    expect(() => canonicalizeVenueUrl("https://technocore.chat?x=1")).toThrow(TclkConfigError);
  });

  it("rejects a fragment", () => {
    expect(() => canonicalizeVenueUrl("https://technocore.chat#frag")).toThrow(TclkConfigError);
  });

  it("rejects a non-root path — a venue is an origin, not a sub-path", () => {
    expect(() => canonicalizeVenueUrl("https://technocore.chat/api/v2")).toThrow(TclkConfigError);
  });
});

describe("resolveTechnocoreUrl", () => {
  it("throws when TECHNOCORE_URL is unset — no default venue", () => {
    vi.stubEnv("TECHNOCORE_URL", "");
    expect(() => resolveTechnocoreUrl()).toThrow(TclkConfigError);
  });

  it("canonicalizes the configured value", () => {
    vi.stubEnv("TECHNOCORE_URL", "https://technocore.chat/");
    expect(resolveTechnocoreUrl()).toBe("https://technocore.chat");
  });

  it("rejects a configured non-https value rather than silently accepting it", () => {
    vi.stubEnv("TECHNOCORE_URL", "http://technocore.chat");
    expect(() => resolveTechnocoreUrl()).toThrow(TclkConfigError);
  });
});

describe("resolveTclkMcpUrl", () => {
  it("throws when TCLK_MCP_URL is unset — no default endpoint", () => {
    vi.stubEnv("TCLK_MCP_URL", "");
    expect(() => resolveTclkMcpUrl()).toThrow(TclkConfigError);
  });

  it("returns the configured value trimmed, unchanged otherwise (not a venue origin — a loopback or hosted MCP endpoint path)", () => {
    vi.stubEnv("TCLK_MCP_URL", "  http://127.0.0.1:3000/mcp  ");
    expect(resolveTclkMcpUrl()).toBe("http://127.0.0.1:3000/mcp");
  });
});


describe("Technocore private ingress fetch", () => {
  it("adds the ingress token only to the configured self-hosted venue", async () => {
    vi.stubEnv("TECHNOCORE_URL", "https://selfhost.example.invalid");
    vi.stubEnv("TECHNOCORE_INGRESS_TOKEN", "a".repeat(32));
    const seen: Array<{ url: string; token: string | null }> = [];
    const fake = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      seen.push({ url, token: new Headers(init?.headers).get(TECHNOCORE_INGRESS_HEADER) });
      return new Response("ok");
    }) as typeof fetch;

    const guarded = createTechnocoreFetch(fake);
    await guarded("https://selfhost.example.invalid/r/tclk-offers");
    await guarded("https://example.invalid/not-technocore");

    expect(seen).toEqual([
      { url: "https://selfhost.example.invalid/r/tclk-offers", token: "a".repeat(32) },
      { url: "https://example.invalid/not-technocore", token: null },
    ]);
  });

  it("never sends a configured ingress token to the official hosted venue", async () => {
    vi.stubEnv("TECHNOCORE_URL", "https://technocore.chat");
    vi.stubEnv("TECHNOCORE_INGRESS_TOKEN", "b".repeat(32));
    let token: string | null = null;
    const fake = (async (_input: string | URL | Request, init?: RequestInit) => {
      token = new Headers(init?.headers).get(TECHNOCORE_INGRESS_HEADER);
      return new Response("ok");
    }) as typeof fetch;

    await createTechnocoreFetch(fake)("https://technocore.chat/r/tclk-offers");
    expect(token).toBeNull();
    expect(resolveTechnocoreIngressOrigin()).toBeNull();
  });

  it("can keep authenticated maintenance access to an old self-hosted venue after switching live traffic back to hosted", async () => {
    vi.stubEnv("TECHNOCORE_URL", "https://technocore.chat");
    vi.stubEnv("TECHNOCORE_INGRESS_TOKEN", "c".repeat(32));
    vi.stubEnv("TECHNOCORE_INGRESS_ORIGIN", "https://old-selfhost.example.invalid/");
    const seen: Array<{ url: string; token: string | null }> = [];
    const fake = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      seen.push({ url, token: new Headers(init?.headers).get(TECHNOCORE_INGRESS_HEADER) });
      return new Response("ok");
    }) as typeof fetch;

    const guarded = createTechnocoreFetch(fake);
    await guarded("https://old-selfhost.example.invalid/r/tclk-offers/export");
    await guarded("https://technocore.chat/r/tclk-offers/export");

    expect(seen).toEqual([
      { url: "https://old-selfhost.example.invalid/r/tclk-offers/export", token: "c".repeat(32) },
      { url: "https://technocore.chat/r/tclk-offers/export", token: null },
    ]);
  });

  it("refuses to designate the official hosted venue as a protected ingress origin", () => {
    vi.stubEnv("TECHNOCORE_URL", "https://technocore.chat");
    vi.stubEnv("TECHNOCORE_INGRESS_TOKEN", "d".repeat(32));
    vi.stubEnv("TECHNOCORE_INGRESS_ORIGIN", "https://technocore.chat");
    expect(() => resolveTechnocoreIngressOrigin()).toThrow(TclkConfigError);
  });

  it("rejects a weak configured ingress token", () => {
    vi.stubEnv("TECHNOCORE_INGRESS_TOKEN", "short");
    expect(() => resolveTechnocoreIngressToken()).toThrow(TclkConfigError);
  });
});
