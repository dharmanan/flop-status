import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalizeVenueUrl, resolveTechnocoreUrl, resolveTclkMcpUrl, TclkConfigError } from "../../lib/runtime/tclk-env.js";

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
    expect(canonicalizeVenueUrl("https://FLOP-TECHNOCORE-PRODUCTION.UP.RAILWAY.APP/")).toBe("https://flop-technocore-production.up.railway.app");
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
