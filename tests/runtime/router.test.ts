import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicReceiptVerification, PublicServerKey } from "../../lib/verification/public-verification-service.js";
import { createRuntimeRequestHandler, MAX_CHALLENGE_BODY_BYTES } from "../../lib/runtime/router.js";

const receipt = {
  receipt_version: "1" as const,
  receipt_id: "11111111-1111-4111-8111-111111111111",
  agent_did: "did:key:z6Mkfake",
  capability_id: "cryptography.signature-verification",
  trial_id: "ed25519-signature-verification",
  trial_version: "1",
  challenge_id: "22222222-2222-4222-8222-222222222222",
  challenge_hash: "sha256:abc",
  result_hash: "sha256:def",
  verifier_id: "ed25519-signature-verifier",
  verifier_version: "1",
  verdict: "PASS" as const,
  evidence_type: "DETERMINISTICALLY_VERIFIED" as const,
  issued_at: "2026-08-31T07:00:00.000Z",
  server_key_id: "key-1",
  server_signature: "signature",
};
const key: PublicServerKey = {
  key_id: "key-1",
  algorithm: "Ed25519",
  public_key: "public-key",
  encoding: "base64url",
  status: "ACTIVE",
  valid_from: "2026-08-31T07:00:00.000Z",
  valid_until: null,
};
const verification: PublicReceiptVerification = { receipt, server_key: key, signature_status: "VALID" };
const challengeId = "33333333-3333-4333-8333-333333333333";
const agentDid = "did:key:z6Mkfake";
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function start() {
  const handler = createRuntimeRequestHandler({
    health: [],
    publicVerification: {
      async getReceipt(id) { return id === receipt.receipt_id ? receipt : null; },
      async getVerification(id) { return id === receipt.receipt_id ? verification : null; },
      async getServerKeys() { return [key]; },
    },
    publicAgent: {
      async findAgentByDid(did) {
        return did === agentDid
          ? { did, capabilities: [{ capability_id: receipt.capability_id, evidence_type: receipt.evidence_type, passed_trials: 1, latest_receipt_id: receipt.receipt_id, first_verified_at: receipt.issued_at, last_verified_at: receipt.issued_at }] }
          : null;
      },
    },
    trial1Api: {
      async createChallenge() { return { challenge: { challenge_id: challengeId }, challenge_hash: "sha256:test" }; },
      async getChallenge(id) { return id === challengeId ? { challenge_id: id, state: "ISSUED", expires_at: "2026-08-31T08:10:00.000Z", receipt_id: null } : null; },
      async submitChallenge(id) { return { challenge_id: id, state: "PASS", verdict: "PASS", receipt_id: receipt.receipt_id }; },
    },
  });
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("API-only runtime HTTP router", () => {
  it("serves durable public agent evidence as JSON", async () => {
    const base = await start();
    const agent = await fetch(`${base}/api/v1/agents/${encodeURIComponent(agentDid)}`);
    expect(agent.status).toBe(200);
    expect(agent.headers.get("content-type")).toContain("application/json");
    const body = await agent.json() as { agent: { did: string; capabilities: Array<{ latest_receipt_id: string }> } };
    expect(body.agent.did).toBe(agentDid);
    expect(body.agent.capabilities[0]?.latest_receipt_id).toBe(receipt.receipt_id);
  });

  it("serves receipt, verification and public key JSON without private material", async () => {
    const base = await start();
    const [receiptResponse, verificationResponse, keysResponse] = await Promise.all([
      fetch(`${base}/api/v1/receipts/${receipt.receipt_id}`),
      fetch(`${base}/api/v1/verification/${receipt.receipt_id}`),
      fetch(`${base}/api/v1/server-keys`),
    ]);
    expect(receiptResponse.status).toBe(200);
    expect(verificationResponse.status).toBe(200);
    expect(keysResponse.status).toBe(200);
    expect(await receiptResponse.json()).toEqual({ receipt });
    expect((await verificationResponse.json() as { signature_status: string }).signature_status).toBe("VALID");
    expect(await keysResponse.text()).not.toContain("private_key");
  });

  it("serves challenge creation, recovery and submission routes", async () => {
    const base = await start();
    const created = await fetch(`${base}/api/v1/challenges`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent_did: agentDid, trial_id: "ed25519-signature-verification" }) });
    expect(created.status).toBe(201);
    const recovered = await fetch(`${base}/api/v1/challenges/${challengeId}`);
    expect(recovered.status).toBe(200);
    const submitted = await fetch(`${base}/api/v1/challenges/${challengeId}/submissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: {}, signature: {} }) });
    expect(submitted.status).toBe(200);
  });

  it("does not serve frontend pages from Railway runtime", async () => {
    const base = await start();
    for (const path of ["/", "/agent", `/verify/${receipt.receipt_id}`, "/assets/agent.js", "/assets/verify.js"]) {
      const response = await fetch(base + path);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect((await response.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
    }
  });

  it("rejects oversized challenge request bodies with 413", async () => {
    const base = await start();
    const response = await fetch(`${base}/api/v1/challenges`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(MAX_CHALLENGE_BODY_BYTES) }) });
    expect(response.status).toBe(413);
  });

  it("supports CORS preflight", async () => {
    const base = await start();
    const response = await fetch(`${base}/api/v1/challenges`, { method: "OPTIONS" });
    expect(response.status).toBe(204);
  });
});
