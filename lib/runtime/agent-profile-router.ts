import type { IncomingMessage, ServerResponse } from "node:http";
import { AgentProfileError, type AgentProfileService } from "./agent-profile-service.js";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, HEADERS);
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 16_384) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createAgentProfileAwareHandler(
  fallback: (request: IncomingMessage, response: ServerResponse) => void,
  profiles: AgentProfileService,
) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://runtime.local");
      try {
        if (request.method === "OPTIONS" && url.pathname.startsWith("/api/v1/agent-profiles")) {
          response.writeHead(204, HEADERS); response.end(); return;
        }
        if (request.method === "POST" && url.pathname === "/api/v1/agent-profiles") {
          json(response, 200, await profiles.upsert(await body(request))); return;
        }
        if (request.method === "GET" && url.pathname === "/api/v1/agent-profiles/search") {
          json(response, 200, await profiles.search(url.searchParams.get("q") ?? "")); return;
        }
        const match = url.pathname.match(/^\/api\/v1\/agent-profiles\/(.+)$/);
        if (request.method === "GET" && match) {
          json(response, 200, await profiles.getByDid(decodeURIComponent(match[1] ?? ""))); return;
        }
        fallback(request, response);
      } catch (error) {
        if (error instanceof AgentProfileError) {
          const status = error.code === "INVALID_AGENT_PROFILE_SIGNATURE" ? 401
            : error.code === "AGENT_PROFILE_REPLAY" || error.code === "AGENT_HANDLE_TAKEN" ? 409
            : error.code === "AGENT_PROFILE_ACTION_EXPIRED" ? 410 : 400;
          json(response, status, { error: { code: error.code, message: error.message } }); return;
        }
        json(response, 400, { error: { code: error instanceof Error ? error.message : "INVALID_REQUEST" } });
      }
    })();
  };
}
