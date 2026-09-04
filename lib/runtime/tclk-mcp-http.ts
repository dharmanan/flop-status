import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createHandlers } from "@flop-labs/tclk-mcp";
import { readJson } from "./tclk-router.js";
import { ALLOWED_TOOLS, TCLK_MCP_EXPECTED_VERSION, type TclkToolName } from "./tclk-mcp-client.js";
import { resolveTechnocoreUrl } from "./tclk-env.js";

type FetchLike = typeof fetch;
type TclkHandlers = ReturnType<typeof createHandlers>;
type ToolHandler = (args: Record<string, unknown>) => unknown;

const MCP_SERVER_INFO = { name: "tclk-mcp", version: TCLK_MCP_EXPECTED_VERSION } as const;

// /mcp is mounted on the same public listener as the rest of the FLOP API
// (see server.ts), so it cannot rely on network placement for protection.
// Every caller — including the in-process loopback TclkMcpClient — must
// present this header with the per-process token generated at startup.
export const INTERNAL_MCP_TOKEN_HEADER = "x-flop-internal-mcp-token";

export interface TclkMcpHttpHandlerOptions {
  /** Per-process random token; never sourced from env, never logged, never persisted. */
  internalToken: string;
  handlers?: TclkHandlers;
}

function hasValidInternalToken(request: IncomingMessage, expectedToken: Buffer): boolean {
  const supplied = request.headers[INTERNAL_MCP_TOKEN_HEADER];
  if (typeof supplied !== "string" || supplied.length === 0) return false;
  const suppliedToken = Buffer.from(supplied, "utf8");
  // timingSafeEqual throws on a length mismatch rather than returning false,
  // so the length check must run first. The token has a fixed, publicly
  // known length (32 random bytes, base64url), so this leaks nothing beyond
  // what the design already discloses.
  if (suppliedToken.length !== expectedToken.length) return false;
  return timingSafeEqual(suppliedToken, expectedToken);
}

// The upstream package silently defaults TECHNOCORE_URL to https://technocore.chat
// if its env option omits it. This backend must never reach that default, so
// resolveTechnocoreUrl() (fail-closed, no default) runs before createHandlers is
// ever constructed, and only TECHNOCORE_URL is ever placed in the object handed
// to it — never process.env itself, so TECHNOCORE_SIGNING_KEY/TCLK_PAYMENT_KEY
// can never reach the upstream package even structurally.
function assertNonCustodial(): void {
  if (process.env.TECHNOCORE_SIGNING_KEY?.trim()) {
    throw new Error("TECHNOCORE_SIGNING_KEY must not be configured: the embedded TCLK MCP handler is non-custodial.");
  }
  if (process.env.TCLK_PAYMENT_KEY?.trim()) {
    throw new Error("TCLK_PAYMENT_KEY must not be configured: the embedded TCLK MCP handler is non-custodial.");
  }
}

export function createEmbeddedTclkMcpHandlers(fetchImpl: FetchLike = fetch): TclkHandlers {
  assertNonCustodial();
  const technocoreUrl = resolveTechnocoreUrl();
  return createHandlers({ env: { TECHNOCORE_URL: technocoreUrl }, fetch: fetchImpl });
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function writeRpcError(response: ServerResponse, id: unknown, code: number, message: string, httpStatus = 200): void {
  writeJson(response, httpStatus, { jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export function createTclkMcpHttpHandler(
  fallback: (request: IncomingMessage, response: ServerResponse) => void,
  options: TclkMcpHttpHandlerOptions,
) {
  const { internalToken, handlers = createEmbeddedTclkMcpHandlers() } = options;
  const expectedToken = Buffer.from(internalToken, "utf8");

  return (request: IncomingMessage, response: ServerResponse): void => {
    const url = new URL(request.url ?? "/", "http://runtime.local");
    if (url.pathname !== "/mcp") {
      fallback(request, response);
      return;
    }
    if (!hasValidInternalToken(request, expectedToken)) {
      // 404, not 401/403: an unauthenticated caller — including any external
      // caller reaching this route through the public Railway domain — must
      // not learn that a private /mcp path exists here at all. No handler or
      // tool is invoked, and the response never echoes the supplied token.
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }
    if (request.method !== "POST") {
      writeJson(response, 405, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Only POST is supported on /mcp" } });
      return;
    }
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      writeJson(response, 415, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Content-Type must be application/json" } });
      return;
    }

    void (async () => {
      let body: Record<string, unknown>;
      try {
        // readJson() already caps the body at 1 MiB and rejects malformed JSON
        // and top-level arrays (which covers JSON-RPC batch requests) in one pass.
        body = await readJson(request);
      } catch (error) {
        const typed = error as { status?: number; message?: string };
        writeJson(response, typed.status ?? 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: typed.message ?? "Parse error" } });
        return;
      }

      const id = (body.id ?? null) as unknown;
      if (body.jsonrpc !== "2.0") {
        writeRpcError(response, id, -32600, 'jsonrpc must be "2.0"');
        return;
      }

      const method = body.method;
      if (method === "initialize") {
        writeJson(response, 200, {
          jsonrpc: "2.0",
          id,
          result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: MCP_SERVER_INFO },
        });
        return;
      }
      if (method === "ping") {
        writeJson(response, 200, { jsonrpc: "2.0", id, result: {} });
        return;
      }
      if (method === "tools/call") {
        const params = (body.params ?? {}) as { name?: unknown; arguments?: unknown };
        const toolName = params.name;
        if (typeof toolName !== "string" || !ALLOWED_TOOLS.has(toolName as TclkToolName)) {
          writeRpcError(response, id, -32601, `TCLK tool is not allowed: ${String(toolName)}`);
          return;
        }
        const handler = (handlers as unknown as Record<string, ToolHandler | undefined>)[toolName];
        if (typeof handler !== "function") {
          writeRpcError(response, id, -32601, `TCLK tool is not implemented: ${toolName}`);
          return;
        }
        const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
        try {
          const result = await handler(args);
          writeJson(response, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
        } catch (error) {
          // Fail closed without leaking a stack or the raw error object — only its
          // message, which the upstream package documents as never echoing secrets.
          const message = error instanceof Error ? error.message : String(error);
          writeJson(response, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: message }], isError: true } });
        }
        return;
      }

      writeRpcError(response, id, -32601, `Method not found: ${String(method)}`);
    })();
  };
}
