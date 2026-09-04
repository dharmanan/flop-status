import { resolveTclkMcpUrl } from "./tclk-env.js";

export const TCLK_MCP_EXPECTED_VERSION = "0.1.0";

export type TclkToolName =
  | "tclk_make_offer"
  | "tclk_accept_offer"
  | "tclk_make_lock"
  | "tclk_make_reveal"
  | "tclk_make_refund"
  | "tclk_make_cancel"
  | "tclk_make_receipt"
  | "tclk_post_frame"
  | "tclk_read_room"
  | "tclk_decode"
  | "tclk_apply_transcript"
  | "tclk_verify_secret"
  | "tclk_whoami";

export const ALLOWED_TOOLS = new Set<TclkToolName>([
  "tclk_make_offer",
  "tclk_accept_offer",
  "tclk_make_lock",
  "tclk_make_reveal",
  "tclk_make_refund",
  "tclk_make_cancel",
  "tclk_make_receipt",
  "tclk_post_frame",
  "tclk_read_room",
  "tclk_decode",
  "tclk_apply_transcript",
  "tclk_verify_secret",
  "tclk_whoami",
]);

export type TclkMcpErrorCode =
  | "TCLK_MCP_UNAVAILABLE"
  | "TCLK_MCP_PROTOCOL_ERROR"
  | "TCLK_MCP_VERSION_MISMATCH"
  | "TCLK_TOOL_REJECTED";

export class TclkMcpError extends Error {
  constructor(readonly code: TclkMcpErrorCode, message: string) {
    super(message);
    this.name = "TclkMcpError";
  }
}

export interface TclkMcpClientLike {
  call<T = unknown>(tool: TclkToolName, args: Record<string, unknown>): Promise<T>;
}

type FetchLike = typeof fetch;

type RpcBody = {
  jsonrpc?: unknown;
  id?: unknown;
  result?: unknown;
  error?: { code?: unknown; message?: unknown };
};

function rpcError(body: RpcBody): never {
  throw new TclkMcpError(
    "TCLK_MCP_PROTOCOL_ERROR",
    typeof body.error?.message === "string" ? body.error.message : "TCLK MCP returned a JSON-RPC error",
  );
}

function parseToolResult(body: RpcBody): unknown {
  if (body.error) rpcError(body);
  const result = body.result as {
    content?: Array<{ type?: unknown; text?: unknown }>;
    isError?: unknown;
  } | undefined;
  const first = result?.content?.find((item) => item?.type === "text" && typeof item.text === "string");
  if (!first || typeof first.text !== "string") {
    throw new TclkMcpError("TCLK_MCP_PROTOCOL_ERROR", "TCLK MCP response did not contain a text tool result");
  }
  if (result?.isError === true) throw new TclkMcpError("TCLK_TOOL_REJECTED", first.text);
  try {
    return JSON.parse(first.text);
  } catch {
    throw new TclkMcpError("TCLK_MCP_PROTOCOL_ERROR", "TCLK MCP tool result was not JSON");
  }
}

export class TclkMcpClient implements TclkMcpClientLike {
  private nextId = 1;
  private compatibility: Promise<void> | null = null;

  constructor(
    private readonly endpoint = resolveTclkMcpUrl(),
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 12_000,
  ) {
    const url = new URL(this.endpoint);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new Error("TCLK_MCP_URL must use HTTPS outside localhost");
    }
  }

  async call<T = unknown>(tool: TclkToolName, args: Record<string, unknown>): Promise<T> {
    if (!ALLOWED_TOOLS.has(tool)) throw new TclkMcpError("TCLK_TOOL_REJECTED", `TCLK tool is not allowed: ${tool}`);
    await this.ensureCompatible();
    const body = await this.rpc("tools/call", { name: tool, arguments: args });
    return parseToolResult(body) as T;
  }

  private ensureCompatible(): Promise<void> {
    this.compatibility ??= this.initialize();
    return this.compatibility;
  }

  private async initialize(): Promise<void> {
    const body = await this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "flop-status", version: "0.1.0" },
    });
    if (body.error) rpcError(body);
    const result = body.result as { serverInfo?: { name?: unknown; version?: unknown } } | undefined;
    const name = result?.serverInfo?.name;
    const version = result?.serverInfo?.version;
    if (name !== "tclk-mcp" || version !== TCLK_MCP_EXPECTED_VERSION) {
      throw new TclkMcpError(
        "TCLK_MCP_VERSION_MISMATCH",
        `Expected tclk-mcp ${TCLK_MCP_EXPECTED_VERSION}, received ${String(name)} ${String(version)}`,
      );
    }
  }

  private async rpc(method: string, params: Record<string, unknown>): Promise<RpcBody> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TclkMcpError("TCLK_MCP_UNAVAILABLE", `TCLK MCP request failed: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new TclkMcpError("TCLK_MCP_UNAVAILABLE", `TCLK MCP HTTP ${response.status}`);
    try {
      return await response.json() as RpcBody;
    } catch {
      throw new TclkMcpError("TCLK_MCP_PROTOCOL_ERROR", "TCLK MCP response was not JSON");
    }
  }
}
