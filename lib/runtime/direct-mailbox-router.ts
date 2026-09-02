import type { IncomingMessage, ServerResponse } from "node:http";
import { DirectMailboxError, type DirectMailboxService } from "./direct-mailbox-service.js";

const MAX_MAILBOX_BODY_BYTES = 16_384;
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

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MAILBOX_BODY_BYTES) {
    request.resume();
    throw Object.assign(new Error("mailbox request body too large"), { code: "PAYLOAD_TOO_LARGE", status: 413 });
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_MAILBOX_BODY_BYTES) throw Object.assign(new Error("mailbox request body too large"), { code: "PAYLOAD_TOO_LARGE", status: 413 });
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("request body must be valid JSON"), { code: "INVALID_JSON", status: 400 });
  }
}

export function createDirectMailboxAwareHandler(
  fallback: (request: IncomingMessage, response: ServerResponse) => void,
  mailbox: DirectMailboxService,
) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    void (async () => {
      const path = new URL(request.url ?? "/", "http://runtime.local").pathname;
      if (!path.startsWith("/api/v1/communication/mailbox")) {
        fallback(request, response);
        return;
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204, HEADERS);
        response.end();
        return;
      }
      try {
        const body = await readJsonBody(request);
        if (request.method === "POST" && path === "/api/v1/communication/mailbox/send") {
          json(response, 201, await mailbox.send(body));
          return;
        }
        if (request.method === "POST" && path === "/api/v1/communication/mailbox/inbox") {
          json(response, 200, await mailbox.inbox(body));
          return;
        }
        if (request.method === "POST" && path === "/api/v1/communication/mailbox/sent") {
          json(response, 200, await mailbox.sent(body));
          return;
        }
        json(response, 404, { error: { code: "NOT_FOUND", message: "Mailbox route not found." } });
      } catch (error) {
        if (error instanceof DirectMailboxError) {
          const statusByCode: Record<string, number> = {
            INVALID_MAILBOX_REQUEST: 400,
            INVALID_MAILBOX_SIGNATURE: 401,
            MAILBOX_ACTION_EXPIRED: 410,
            MAILBOX_REPLAY: 409,
            MAILBOX_SELF_SEND: 400,
          };
          json(response, statusByCode[error.code] ?? 400, { error: { code: error.code, message: error.message } });
          return;
        }
        const typed = error as { code?: string; status?: number; message?: string };
        json(response, typed.status ?? 500, { error: { code: typed.code ?? "INTERNAL_ERROR", message: typed.message ?? "Request could not be completed." } });
      }
    })();
  };
}
