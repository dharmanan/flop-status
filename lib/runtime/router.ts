import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ActiveChallengeExistsError, TrialDefinitionNotFoundError } from "../challenges/issuance-service.js";
import { MalformedDidError, UnsupportedDidMethodError, UnsupportedKeyTypeError } from "../identity/did-key.js";
import { MAX_SUBMISSION_BODY_BYTES, SubmissionAcceptanceError } from "../submissions/submission-service.js";
import { PublicVerificationIntegrityError, type PublicReceiptVerification, type PublicServerKey } from "../verification/public-verification-service.js";
import { CapabilityProductError, type CapabilityProductService } from "./capability-product-service.js";
import { Trial1ApiRequestError, Trial1VerificationUnknownError } from "./trial1-api-service.js";

export const MAX_CHALLENGE_BODY_BYTES = 8_192;

export interface PublicVerificationReader {
  getReceipt(receiptId: string): Promise<PublicReceiptVerification["receipt"] | null>;
  getVerification(receiptId: string): Promise<PublicReceiptVerification | null>;
  getServerKeys(): Promise<PublicServerKey[]>;
}

export interface PublicAgentReader {
  findAgentByDid(did: string): Promise<{
    did: string;
    capabilities: Array<{
      capability_id: string;
      evidence_type: string;
      passed_trials: number;
      latest_receipt_id: string | null;
      first_verified_at: string | null;
      last_verified_at: string | null;
    }>;
  } | null>;
}

export interface Trial1ApiWriter {
  createChallenge(body: unknown): Promise<unknown>;
  getChallenge(challengeId: string): Promise<unknown | null>;
  submitChallenge(challengeId: string, envelope: unknown, bodyByteLength: number): Promise<unknown>;
}

export interface RuntimeRouterDependencies {
  publicVerification: PublicVerificationReader;
  publicAgent: PublicAgentReader;
  trial1Api: Trial1ApiWriter;
  capabilityProduct?: CapabilityProductService;
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

function apiError(response: ServerResponse, status: number, code: string, message: string, requestId: string): void {
  json(response, status, { error: { code, message, request_id: requestId } });
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
    if (total > maxBytes) throw new RequestBodyError("PAYLOAD_TOO_LARGE", 413, `request body exceeds ${maxBytes} bytes`);
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return { value: JSON.parse(text), bytes: total };
  } catch {
    throw new RequestBodyError("INVALID_JSON", 400, "request body must be valid JSON");
  }
}

function decodedPathValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Trial1ApiRequestError("INVALID_CHALLENGE_SCHEMA", "path identifier is not valid URI encoding");
  }
}

export function createRuntimeRequestHandler(deps: RuntimeRouterDependencies) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    void handleRequest(request, response, deps);
  };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, deps: RuntimeRouterDependencies): Promise<void> {
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
    if (request.method === "GET" && path === "/api/v1/server-keys") {
      json(response, 200, { keys: await deps.publicVerification.getServerKeys() });
      return;
    }

    const certificateMatch = path.match(/^\/api\/v1\/certificates\/([^/]+)$/);
    if (request.method === "GET" && certificateMatch) {
      if (!deps.capabilityProduct) throw new Error("capability product service unavailable");
      const certificate = await deps.capabilityProduct.getCertificate(certificateMatch[1] ?? "");
      if (!certificate) {
        apiError(response, 404, "CERTIFICATE_NOT_FOUND", "Certificate not found.", requestId);
        return;
      }
      const verification = await deps.publicVerification.getVerification(certificate.receiptId);
      if (!verification) throw new PublicVerificationIntegrityError("STORED_RECEIPT_INVALID");
      json(response, 200, {
        certificate: {
          certificate_id: certificate.id,
          certificate_name: certificate.certificateName,
          agent_did: certificate.did,
          capability_id: certificate.capabilityId,
          capability_version: certificate.capabilityVersion,
          program_version: certificate.programVersion,
          trial_id: certificate.trialId,
          trial_version: certificate.trialVersion,
          verifier_id: certificate.verifierId,
          verifier_version: certificate.verifierVersion,
          receipt_id: certificate.receiptId,
          status: certificate.status,
          issued_at: certificate.issuedAt,
        },
        receipt_verification: verification,
      });
      return;
    }

    const certificateListMatch = path.match(/^\/api\/v1\/agents\/(.+)\/certificates$/);
    if (request.method === "GET" && certificateListMatch) {
      if (!deps.capabilityProduct) throw new Error("capability product service unavailable");
      const did = decodedPathValue(certificateListMatch[1] ?? "");
      json(response, 200, await deps.capabilityProduct.listCertificates(did));
      return;
    }

    const productCapabilityMatch = path.match(/^\/api\/v1\/agents\/(.+)\/product-capabilities\/([^/]+)$/);
    if (request.method === "GET" && productCapabilityMatch) {
      if (!deps.capabilityProduct) throw new Error("capability product service unavailable");
      const did = decodedPathValue(productCapabilityMatch[1] ?? "");
      const capabilityId = decodedPathValue(productCapabilityMatch[2] ?? "");
      json(response, 200, await deps.capabilityProduct.getCapabilityState(did, capabilityId));
      return;
    }

    const acquireMatch = path.match(/^\/api\/v1\/agents\/(.+)\/product-capabilities\/([^/]+)\/acquire$/);
    if (request.method === "POST" && acquireMatch) {
      if (!deps.capabilityProduct) throw new Error("capability product service unavailable");
      const did = decodedPathValue(acquireMatch[1] ?? "");
      const capabilityId = decodedPathValue(acquireMatch[2] ?? "");
      json(response, 200, { installation: await deps.capabilityProduct.acquireCapability(did, capabilityId) });
      return;
    }

    const agentCapabilitiesMatch = path.match(/^\/api\/v1\/agents\/(.+)\/capabilities$/);
    if (request.method === "GET" && agentCapabilitiesMatch) {
      const did = decodedPathValue(agentCapabilitiesMatch[1] ?? "");
      const agent = await deps.publicAgent.findAgentByDid(did);
      if (!agent) {
        apiError(response, 404, "AGENT_NOT_FOUND", "Agent not found.", requestId);
        return;
      }
      json(response, 200, { did: agent.did, capabilities: agent.capabilities });
      return;
    }

    const agentMatch = path.match(/^\/api\/v1\/agents\/(.+)$/);
    if (request.method === "GET" && agentMatch) {
      const did = decodedPathValue(agentMatch[1] ?? "");
      const agent = await deps.publicAgent.findAgentByDid(did);
      if (!agent) {
        apiError(response, 404, "AGENT_NOT_FOUND", "Agent not found.", requestId);
        return;
      }
      json(response, 200, { agent });
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
      json(response, 200, await deps.trial1Api.submitChallenge(submissionMatch[1] ?? "", body.value, body.bytes));
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

    apiError(response, 404, "NOT_FOUND", "Route not found.", requestId);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      apiError(response, error.status, error.code, error.message, requestId);
      return;
    }
    if (error instanceof Trial1ApiRequestError) {
      apiError(response, 400, error.code, error.message, requestId);
      return;
    }
    if (error instanceof CapabilityProductError) {
      const status = error.code === "CAPABILITY_NOT_INSTALLED" || error.code === "PREREQUISITE_CERTIFICATE_REQUIRED" ? 409 : 400;
      apiError(response, status, error.code, error.message, requestId);
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
