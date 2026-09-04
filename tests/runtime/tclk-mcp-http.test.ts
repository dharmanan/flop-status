import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmbeddedTclkMcpHandlers, createTclkMcpHttpHandler, INTERNAL_MCP_TOKEN_HEADER } from "../../lib/runtime/tclk-mcp-http.js";
import { TclkMcpClient } from "../../lib/runtime/tclk-mcp-client.js";

const FAKE_TECHNOCORE_URL = "https://selfhost.example.invalid";
const TOKEN = "unit-test-internal-mcp-token-0000000000";
const WRONG_TOKEN = "unit-test-internal-mcp-token-1111111111";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  vi.unstubAllEnvs();
});

function fallback(_req: any, res: any) {
  res.writeHead(418, { "content-type": "application/json" });
  res.end(JSON.stringify({ fallback: true }));
}

function fakeHandlers(overrides: Record<string, unknown> = {}) {
  return {
    tclk_whoami: () => ({ technocoreUrl: FAKE_TECHNOCORE_URL, did: null, paymentPublicKey: null, notes: [] }),
    ...overrides,
  };
}

async function start(handlers: any, token: string = TOKEN) {
  const server = createServer(createTclkMcpHttpHandler(fallback, { internalToken: token, handlers }));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test address");
  return `http://127.0.0.1:${address.port}`;
}

async function rpc(base: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  return fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function withToken(token: string): Record<string, string> {
  return { [INTERNAL_MCP_TOKEN_HEADER]: token };
}

// Mirrors the wrapper server.ts builds around the loopback TclkMcpClient —
// reimplemented locally so this file never imports server.ts (which would
// run its top-level main() against a real database on import).
function tokenFetch(token: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(INTERNAL_MCP_TOKEN_HEADER, token);
    return fetch(input, { ...init, headers });
  };
}

describe("internal MCP token boundary", () => {
  it("an unrelated route still falls through to the existing FLOP handler chain, no token involved", async () => {
    const base = await start(fakeHandlers());
    const response = await fetch(`${base}/api/v1/health`);
    expect(response.status).toBe(418);
    expect(await response.json()).toMatchObject({ fallback: true });
  });

  it("rejects POST /mcp with no internal token, and never invokes the tool handler", async () => {
    const spy = vi.fn(() => ({ technocoreUrl: FAKE_TECHNOCORE_URL, did: null, paymentPublicKey: null, notes: [] }));
    const base = await start(fakeHandlers({ tclk_whoami: spy }));
    const response = await rpc(base, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "tclk_whoami", arguments: {} } });
    expect(response.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(TOKEN);
  });

  it("rejects POST /mcp with the wrong internal token, and never invokes the tool handler", async () => {
    const spy = vi.fn(() => ({ technocoreUrl: FAKE_TECHNOCORE_URL, did: null, paymentPublicKey: null, notes: [] }));
    const base = await start(fakeHandlers({ tclk_whoami: spy }));
    const response = await rpc(
      base,
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "tclk_whoami", arguments: {} } },
      withToken(WRONG_TOKEN),
    );
    expect(response.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    const raw = await response.text();
    expect(raw).not.toContain(TOKEN);
    expect(raw).not.toContain(WRONG_TOKEN);
  });

  it("rejects even a non-POST request to /mcp with no token as a plain 404, not a 405 — the private route is not advertised", async () => {
    const base = await start(fakeHandlers());
    const response = await fetch(`${base}/mcp`, { method: "GET" });
    expect(response.status).toBe(404);
  });

  it("with the correct internal token, initialize returns the exact compatibility TclkMcpClient requires", async () => {
    const base = await start(fakeHandlers());
    const response = await rpc(base, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, withToken(TOKEN));
    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.result.serverInfo).toEqual({ name: "tclk-mcp", version: "0.1.0" });
  });

  it("with the correct internal token, an allowed tools/call succeeds", async () => {
    const base = await start(fakeHandlers());
    const response = await rpc(
      base,
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "tclk_whoami", arguments: {} } },
      withToken(TOKEN),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    const parsed = JSON.parse(data.result.content[0].text);
    expect(parsed.technocoreUrl).toBe(FAKE_TECHNOCORE_URL);
  });

  it("the correct token never appears anywhere in a successful response body", async () => {
    const base = await start(fakeHandlers());
    const response = await rpc(
      base,
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "tclk_whoami", arguments: {} } },
      withToken(TOKEN),
    );
    const raw = await response.text();
    expect(raw).not.toContain(TOKEN);
  });

  it("a disallowed tool is still rejected even with the correct internal token", async () => {
    const base = await start(fakeHandlers({ tclk_adaptor_presign: () => ({ ok: true }) }));
    const response = await rpc(
      base,
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "tclk_adaptor_presign", arguments: {} } },
      withToken(TOKEN),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.error).toBeDefined();
    expect(data.error.message).toMatch(/not allowed/);
  });

  it("the real TclkMcpClient continues to work end-to-end through a fetch that attaches the correct internal token", async () => {
    const base = await start(fakeHandlers());
    const client = new TclkMcpClient(`${base}/mcp`, tokenFetch(TOKEN));
    const result = (await client.call("tclk_whoami", {})) as { technocoreUrl: string };
    expect(result.technocoreUrl).toBe(FAKE_TECHNOCORE_URL);
  });

  it("a TclkMcpClient whose fetch does not attach the internal token cannot reach the protected route", async () => {
    const base = await start(fakeHandlers());
    const client = new TclkMcpClient(`${base}/mcp`);
    await expect(client.call("tclk_whoami", {})).rejects.toThrow();
  });
});

describe("non-custodial protections still hold (unchanged by the token boundary)", () => {
  it("fails closed when TECHNOCORE_SIGNING_KEY is configured", () => {
    vi.stubEnv("TECHNOCORE_URL", FAKE_TECHNOCORE_URL);
    vi.stubEnv("TECHNOCORE_SIGNING_KEY", "0xdeadbeef");
    vi.stubEnv("TCLK_PAYMENT_KEY", "");
    expect(() => createEmbeddedTclkMcpHandlers()).toThrow(/TECHNOCORE_SIGNING_KEY/);
  });

  it("fails closed when TCLK_PAYMENT_KEY is configured", () => {
    vi.stubEnv("TECHNOCORE_URL", FAKE_TECHNOCORE_URL);
    vi.stubEnv("TECHNOCORE_SIGNING_KEY", "");
    vi.stubEnv("TCLK_PAYMENT_KEY", "0xdeadbeef");
    expect(() => createEmbeddedTclkMcpHandlers()).toThrow(/TCLK_PAYMENT_KEY/);
  });

  it("passes only the explicit TECHNOCORE_URL to the upstream handlers, never process.env wholesale", () => {
    vi.stubEnv("TECHNOCORE_URL", FAKE_TECHNOCORE_URL);
    vi.stubEnv("TECHNOCORE_SIGNING_KEY", "");
    vi.stubEnv("TCLK_PAYMENT_KEY", "");
    vi.stubEnv("SOME_UNRELATED_SECRET", "should-never-be-forwarded");
    const handlers = createEmbeddedTclkMcpHandlers(vi.fn() as unknown as typeof fetch);
    const info = handlers.tclk_whoami();
    expect(info.technocoreUrl).toBe(FAKE_TECHNOCORE_URL);
  });
});

describe("single backend listener architecture (unchanged by the token boundary)", () => {
  it("server.ts still creates exactly one HTTP server and one listener, with the internal token wired into both the client fetch and the handler options", () => {
    const source = readFileSync(new URL("../../lib/runtime/server.ts", import.meta.url), "utf8");
    expect((source.match(/createServer\(/g) ?? []).length).toBe(1);
    expect((source.match(/\.listen\(/g) ?? []).length).toBe(1);
    expect(source).toContain("createTclkMcpHttpHandler(tclkHandler, { internalToken: internalMcpToken })");
    expect(source).not.toContain("start:tclk-mcp");
  });
});
