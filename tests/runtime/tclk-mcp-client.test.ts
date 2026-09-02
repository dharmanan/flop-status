import { describe, expect, it, vi } from "vitest";
import { TclkMcpClient, TclkMcpError } from "../../lib/runtime/tclk-mcp-client.js";

function rpcResult(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function initializeResponse(version = "0.1.0"): Response {
  return rpcResult({
    protocolVersion: "2024-11-05",
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "tclk-mcp", version },
  });
}

function toolResponse(value: unknown, isError = false): Response {
  return rpcResult({
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  });
}

describe("TclkMcpClient", () => {
  it("pins the official hosted MCP version and then calls tools without custody headers", async () => {
    const calls: any[] = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has("authorization")).toBe(false);
      expect(headers.has("x-api-key")).toBe(false);
      const body = JSON.parse(String(init?.body));
      calls.push(body);
      if (body.method === "initialize") return initializeResponse();
      expect(body.method).toBe("tools/call");
      expect(body.params).toEqual({ name: "tclk_make_offer", arguments: { from: "did:key:z6Mkexample" } });
      return toolResponse({ frame: { type: "offer" }, line: "tclk1 {}" });
    });
    const client = new TclkMcpClient("https://tclk.technocore.chat/mcp", fetchMock as typeof fetch);
    await expect(client.call("tclk_make_offer", { from: "did:key:z6Mkexample" })).resolves.toEqual({
      frame: { type: "offer" },
      line: "tclk1 {}",
    });
    expect(calls.map((call) => call.method)).toEqual(["initialize", "tools/call"]);
  });

  it("fails closed when the hosted MCP version drifts", async () => {
    const client = new TclkMcpClient(
      "https://tclk.technocore.chat/mcp",
      (async () => initializeResponse("0.2.0")) as typeof fetch,
    );
    await expect(client.call("tclk_whoami", {})).rejects.toMatchObject({
      name: "TclkMcpError",
      code: "TCLK_MCP_VERSION_MISMATCH",
    });
  });

  it("fails closed when the official tool reports a rejection", async () => {
    let count = 0;
    const client = new TclkMcpClient(
      "https://tclk.technocore.chat/mcp",
      (async () => ++count === 1 ? initializeResponse() : toolResponse("tclk: malformed frame", true)) as typeof fetch,
    );
    await expect(client.call("tclk_decode", { line: "bad" })).rejects.toMatchObject({
      name: "TclkMcpError",
      code: "TCLK_TOOL_REJECTED",
    });
  });

  it("requires HTTPS outside localhost", () => {
    expect(() => new TclkMcpClient("http://example.com/mcp")).toThrow(/HTTPS/);
    expect(() => new TclkMcpClient("http://localhost:8787/mcp")).not.toThrow();
  });

  it("maps transport failures to TCLK_MCP_UNAVAILABLE", async () => {
    const client = new TclkMcpClient(
      "https://tclk.technocore.chat/mcp",
      (async () => { throw new Error("offline"); }) as typeof fetch,
    );
    await expect(client.call("tclk_whoami", {})).rejects.toBeInstanceOf(TclkMcpError);
    await expect(client.call("tclk_whoami", {})).rejects.toMatchObject({ code: "TCLK_MCP_UNAVAILABLE" });
  });
});
