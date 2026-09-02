import type { IncomingMessage, ServerResponse } from "node:http";
import { TclkMcpClient, TclkMcpError, type TclkToolName } from "./tclk-mcp-client.js";
import { TclkPaperRailAdapter } from "./tclk-paper-rail.js";

const MAX_TCLK_BODY_BYTES = 1_048_576;
const TECHNOCORE_URL = process.env.TECHNOCORE_URL?.trim() || "https://technocore.chat";
const TCLK_ROOM_RE = /^(?:tclk-offers|mb-p-tclk-[0-9a-f]{16})$/;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const TOOL_NAMES = new Set<TclkToolName>([
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

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, HEADERS);
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const declared = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > MAX_TCLK_BODY_BYTES) {
    request.resume();
    throw Object.assign(new Error("TCLK request body too large"), { status: 413, code: "PAYLOAD_TOO_LARGE" });
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_TCLK_BODY_BYTES) throw Object.assign(new Error("TCLK request body too large"), { status: 413, code: "PAYLOAD_TOO_LARGE" });
    chunks.push(buffer);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body must be an object");
    return value as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("request body must be valid JSON object"), { status: 400, code: "INVALID_JSON" });
  }
}

async function readRawRoom(room: string): Promise<unknown> {
  if (!TCLK_ROOM_RE.test(room)) {
    throw Object.assign(new Error("raw proxy is limited to official TCLK offer/deal rooms"), { status: 400, code: "INVALID_TCLK_ROOM" });
  }
  const response = await fetch(`${TECHNOCORE_URL}/r/${room}?format=json`, { headers: { accept: "application/json" } });
  if (response.status === 404) return { room, messages: [], last_seq: 0 };
  if (!response.ok) throw Object.assign(new Error(`Technocore room read failed: HTTP ${response.status}`), { status: 502, code: "TECHNOCORE_READ_FAILED" });
  return response.json();
}

export function createTclkAwareHandler(
  fallback: (request: IncomingMessage, response: ServerResponse) => void,
  mcp = new TclkMcpClient(),
  paper = new TclkPaperRailAdapter(mcp),
) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://runtime.local");
      const path = url.pathname;
      if (!path.startsWith("/api/v1/tclk")) {
        fallback(request, response);
        return;
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204, HEADERS);
        response.end();
        return;
      }
      try {
        if (request.method === "GET" && path === "/api/v1/tclk/status") {
          const upstream = await mcp.call("tclk_whoami", {});
          json(response, 200, { protocol: "tclk/1", mode: "alpha-paper-only", real_value: false, mcp: upstream });
          return;
        }

        const rawRoomMatch = path.match(/^\/api\/v1\/tclk\/rooms\/([a-z0-9_-]+)$/);
        if (request.method === "GET" && rawRoomMatch) {
          json(response, 200, { room: await readRawRoom(rawRoomMatch[1] ?? "") });
          return;
        }

        const toolMatch = path.match(/^\/api\/v1\/tclk\/tools\/([a-z0-9_]+)$/);
        if (request.method === "POST" && toolMatch) {
          const tool = toolMatch[1] as TclkToolName;
          if (!TOOL_NAMES.has(tool)) {
            json(response, 404, { error: { code: "TCLK_TOOL_NOT_ALLOWED", message: "TCLK tool is not exposed by FLOP." } });
            return;
          }
          const body = await readJson(request);
          json(response, 200, { result: await mcp.call(tool, body) });
          return;
        }

        if (request.method === "POST" && path === "/api/v1/tclk/paper/lock") {
          const body = await readJson(request);
          json(response, 200, {
            paper: await paper.lock({
              contract: String(body.contract ?? ""),
              statement: String(body.statement ?? ""),
              refundAfterMs: Number(body.refundAfterMs),
            }),
            warning: "PaperRail holds no value. This record is rehearsal evidence only.",
          });
          return;
        }

        if (request.method === "POST" && path === "/api/v1/tclk/paper/claim") {
          const body = await readJson(request);
          json(response, 200, {
            paper: await paper.claim(String(body.contract ?? ""), String(body.secret ?? "")),
            warning: "PaperRail holds no value. This record is rehearsal evidence only.",
          });
          return;
        }

        if (request.method === "POST" && path === "/api/v1/tclk/paper/refund") {
          const body = await readJson(request);
          json(response, 200, {
            paper: await paper.refund(String(body.contract ?? "")),
            warning: "PaperRail holds no value. This record is rehearsal evidence only.",
          });
          return;
        }

        if (request.method === "GET" && path.startsWith("/api/v1/tclk/paper/")) {
          const contract = decodeURIComponent(path.slice("/api/v1/tclk/paper/".length));
          json(response, 200, { paper: await paper.read(contract) });
          return;
        }

        json(response, 404, { error: { code: "NOT_FOUND", message: "TCLK route not found." } });
      } catch (error) {
        if (error instanceof TclkMcpError) {
          const status = error.code === "TCLK_MCP_UNAVAILABLE" ? 503 : 400;
          json(response, status, { error: { code: error.code, message: error.message } });
          return;
        }
        const typed = error as { status?: number; code?: string; message?: string };
        json(response, typed.status ?? 400, { error: { code: typed.code ?? "TCLK_REQUEST_FAILED", message: typed.message ?? "TCLK request failed." } });
      }
    })();
  };
}
