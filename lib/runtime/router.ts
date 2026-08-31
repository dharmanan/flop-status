import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  PublicVerificationIntegrityError,
  type PublicReceiptVerification,
  type PublicServerKey,
} from "../verification/public-verification-service.js";
import {
  PUBLIC_VERIFICATION_CSS,
  PUBLIC_VERIFICATION_SCRIPT,
  renderPublicVerificationPage,
} from "./public-verification-page.js";

export interface PublicVerificationReader {
  getReceipt(receiptId: string): Promise<PublicReceiptVerification["receipt"] | null>;
  getVerification(receiptId: string): Promise<PublicReceiptVerification | null>;
  getServerKeys(): Promise<PublicServerKey[]>;
}

export interface RuntimeRouterDependencies {
  publicVerification: PublicVerificationReader;
  health: unknown;
}

const API_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
} as const;

const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
} as const;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, API_HEADERS);
  response.end(JSON.stringify(body));
}

function apiError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  requestId: string,
): void {
  json(response, status, { error: { code, message, request_id: requestId } });
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, PAGE_HEADERS);
  response.end(body);
}

export function createRuntimeRequestHandler(deps: RuntimeRouterDependencies) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    void handleRequest(request, response, deps);
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  deps: RuntimeRouterDependencies,
): Promise<void> {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url ?? "/", "http://runtime.local");
    const path = url.pathname;

    if (request.method !== "GET") {
      apiError(response, 405, "METHOD_NOT_ALLOWED", "Only GET is available on this public read surface.", requestId);
      return;
    }

    if (path === "/healthz") {
      json(response, 200, { status: "ok", database: "ready", migrations: deps.health });
      return;
    }

    if (path === "/assets/verify.js") {
      response.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "x-content-type-options": "nosniff",
      });
      response.end(PUBLIC_VERIFICATION_SCRIPT);
      return;
    }

    if (path === "/assets/verify.css") {
      response.writeHead(200, {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "x-content-type-options": "nosniff",
      });
      response.end(PUBLIC_VERIFICATION_CSS);
      return;
    }

    if (path === "/api/v1/server-keys") {
      json(response, 200, { keys: await deps.publicVerification.getServerKeys() });
      return;
    }

    const receiptMatch = path.match(/^\/api\/v1\/receipts\/([^/]+)$/);
    if (receiptMatch) {
      const receipt = await deps.publicVerification.getReceipt(receiptMatch[1] ?? "");
      if (!receipt) {
        apiError(response, 404, "RECEIPT_NOT_FOUND", "Receipt not found.", requestId);
        return;
      }
      json(response, 200, { receipt });
      return;
    }

    const verificationMatch = path.match(/^\/api\/v1\/verification\/([^/]+)$/);
    if (verificationMatch) {
      const verification = await deps.publicVerification.getVerification(verificationMatch[1] ?? "");
      if (!verification) {
        apiError(response, 404, "RECEIPT_NOT_FOUND", "Receipt not found.", requestId);
        return;
      }
      json(response, 200, verification);
      return;
    }

    const pageMatch = path.match(/^\/verify\/([^/]+)$/);
    if (pageMatch) {
      const verification = await deps.publicVerification.getVerification(pageMatch[1] ?? "");
      if (!verification) {
        html(response, 404, "<!doctype html><title>Receipt not found</title><p>Receipt not found.</p>");
        return;
      }
      html(response, 200, renderPublicVerificationPage(verification));
      return;
    }

    if (path.startsWith("/api/")) {
      apiError(response, 404, "NOT_FOUND", "Route not found.", requestId);
      return;
    }
    html(response, 404, "<!doctype html><title>Not found</title><p>Not found.</p>");
  } catch (error) {
    const code =
      error instanceof PublicVerificationIntegrityError
        ? error.code
        : "INTERNAL_ERROR";
    apiError(response, 500, code, "Public verification could not be completed.", requestId);
  }
}
