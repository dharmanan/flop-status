import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ActiveChallengeExistsError,
  TrialDefinitionNotFoundError,
} from "../challenges/issuance-service.js";
import {
  MalformedDidError,
  UnsupportedDidMethodError,
  UnsupportedKeyTypeError,
} from "../identity/did-key.js";
import { MAX_SUBMISSION_BODY_BYTES, SubmissionAcceptanceError } from "../submissions/submission-service.js";
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
import {
  Trial1ApiRequestError,
  Trial1VerificationUnknownError,
} from "./trial1-api-service.js";

export const MAX_CHALLENGE_BODY_BYTES = 8_192;

export interface PublicVerificationReader {
  getReceipt(receiptId: string): Promise<PublicReceiptVerification["receipt"] | null>;
  getVerification(receiptId: string): Promise<PublicReceiptVerification | null>;
  getServerKeys(): Promise<PublicServerKey[]>;
}

export interface Trial1ApiWriter {
  createChallenge(body: unknown): Promise<unknown>;
  getChallenge(challengeId: string): Promise<unknown | null>;
  submitChallenge(challengeId: string, envelope: unknown, bodyByteLength: number): Promise<unknown>;
}

export interface RuntimeRouterDependencies {
  publicVerification: PublicVerificationReader;
  trial1Api: Trial1ApiWriter;
  health: unknown;
}

const API_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
} as const;

class RequestBodyError extends Error {
  constructor(
    readonly code: "INVALID_JSON" | "PAYLOAD_TOO_LARGE",
    readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

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

async function readJsonBody(request: IncomingMessage, maxBytes: number): Promise<{ value: unknown; bytes: number }> {
  const declaredLength = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    request.resume();
    throw new RequestBodyError("PAYLOAD_TOO_LARGE", 413, `request body exceeds ${maxBytes} bytes`);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new RequestBodyError("PAYLOAD_TOO_LARGE", 413, `request body exceeds ${maxBytes} bytes`);
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return { value: JSON.parse(text), bytes: total };
  } catch {
    throw new RequestBodyError("INVALID_JSON", 400, "request body must be valid JSON");
  }
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

    if (request.method === "OPTIONS" && path.startsWith("/api/")) {
      response.writeHead(204, API_HEADERS);
      response.end();
      return;
    }

    if (request.method === "GET" && path === "/healthz") {
      json(response, 200, { status: "ok", database: "ready", migrations: deps.health });
      return;
    }

    if (request.method === "GET" && path === "/assets/verify.js") {
      response.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "x-content-type-options": "nosniff",
      });
      response.end(PUBLIC_VERIFICATION_SCRIPT);
      return;
    }

    if (request.method === "GET" && path === "/assets/verify.css") {
      response.writeHead(200, {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "x-content-type-options": "nosniff",
      });
      response.end(PUBLIC_VERIFICATION_CSS);
      return;
    }

    if (request.method === "GET" && path === "/api/v1/server-keys") {
      json(response, 200, { keys: await deps.publicVerification.getServerKeys() });
      return;
    }

    if (request.method === "POST" && path === "/api/v1/challenges") {
      const body = await readJsonBody(request, MAX_CHALLENGE_BODY_BYTES);
      json(response, 201, await deps.trial1Api.createChallenge(body.value));
      return;
    }

    const challengeMatch = path.match(/^\/api\/v1\/challenges\/([^/]+)$/);
    if (request.method === "GET" && challengeMatch) {
      const state = await deps.trial1Api.getChallenge(challengeMatch[1] ?? "");
      if (!state) {
        apiError(response, 404, "CHALLENGE_NOT_FOUND", "Challenge not found.", requestId);
        return;
      }
      json(response, 200, state);
      return;
    }

    const submissionMatch = path.match(/^\/api\/v1\/challenges\/([^/]+)\/submissions$/);
    if (request.method === "POST" && submissionMatch) {
      const body = await readJsonBody(request, MAX_SUBMISSION_BODY_BYTES);
      json(
        response,
        200,
        await deps.trial1Api.submitChallenge(submissionMatch[1] ?? "", body.value, body.bytes),
      );
      return;
    }

    const receiptMatch = path.match(/^\/api\/v1\/receipts\/([^/]+)$/);
    if (request.method === "GET" && receiptMatch) {
      const receipt = await deps.publicVerification.getReceipt(receiptMatch[1] ?? "");
      if (!receipt) {
        apiError(response, 404, "RECEIPT_NOT_FOUND", "Receipt not found.", requestId);
        return;
      }
      json(response, 200, { receipt });
      return;
    }

    const verificationMatch = path.match(/^\/api\/v1\/verification\/([^/]+)$/);
    if (request.method === "GET" && verificationMatch) {
      const verification = await deps.publicVerification.getVerification(verificationMatch[1] ?? "");
      if (!verification) {
        apiError(response, 404, "RECEIPT_NOT_FOUND", "Receipt not found.", requestId);
        return;
      }
      json(response, 200, verification);
      return;
    }

    const pageMatch = path.match(/^\/verify\/([^/]+)$/);
    if (request.method === "GET" && pageMatch) {
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
    if (error instanceof RequestBodyError) {
      apiError(response, error.status, error.code, error.message, requestId);
      return;
    }
    if (error instanceof Trial1ApiRequestError) {
      apiError(response, 400, error.code, error.message, requestId);
      return;
    }
    if (error instanceof MalformedDidError) {
      apiError(response, 400, "INVALID_DID", error.message, requestId);
      return;
    }
    if (error instanceof UnsupportedDidMethodError || error instanceof UnsupportedKeyTypeError) {
      apiError(response, 400, "UNSUPPORTED_DID", error.message, requestId);
      return;
    }
    if (error instanceof TrialDefinitionNotFoundError) {
      apiError(response, 404, "TRIAL_NOT_FOUND", error.message, requestId);
      return;
    }
    if (error instanceof ActiveChallengeExistsError) {
      apiError(response, 409, "ACTIVE_CHALLENGE_EXISTS", error.message, requestId);
      return;
    }
    if (error instanceof SubmissionAcceptanceError) {
      const statusByCode: Record<string, number> = {
        INVALID_SUBMISSION_SCHEMA: 400,
        CHALLENGE_NOT_FOUND: 404,
        CHALLENGE_EXPIRED: 410,
        CHALLENGE_ALREADY_CONSUMED: 409,
        CHALLENGE_BINDING_MISMATCH: 409,
        INVALID_AGENT_SIGNATURE: 401,
        UNSUPPORTED_DID: 400,
        INVALID_DID: 400,
      };
      apiError(response, statusByCode[error.code] ?? 400, error.code, error.message, requestId);
      return;
    }
    if (error instanceof Trial1VerificationUnknownError) {
      apiError(response, 503, "VERIFICATION_UNKNOWN", error.message, requestId);
      return;
    }
    const code = error instanceof PublicVerificationIntegrityError ? error.code : "INTERNAL_ERROR";
    apiError(response, 500, code, "Request could not be completed.", requestId);
  }
}
