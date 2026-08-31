import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type {
  PublicReceiptVerification,
  PublicServerKey,
} from "../../lib/verification/public-verification-service.js";
import { createRuntimeRequestHandler } from "../../lib/runtime/router.js";

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
  });
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return `http://127.0.0.1:${port}`;
}

describe("public verification HTTP router", () => {
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
    const keysText = await keysResponse.text();
    expect(keysText).toContain("public_key");
    expect(keysText).not.toContain("private_key");
  });

  it("serves a CSP-protected public page whose script performs browser Ed25519 verification", async () => {
    const base = await start();
    const page = await fetch(`${base}/verify/${receipt.receipt_id}`);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(html).toContain("Receipt signature:");
    expect(html).toContain("CHECKING");
    expect(html).not.toContain("private_key");

    const script = await fetch(`${base}/assets/verify.js`);
    const js = await script.text();
    expect(js).toContain("crypto.subtle.verify");
    expect(js).toContain("Object.keys(receipt).sort()");
  });

  it("uses the documented error envelope for a missing receipt", async () => {
    const base = await start();
    const response = await fetch(`${base}/api/v1/receipts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);
    expect(response.status).toBe(404);
    const body = await response.json() as { error: { code: string; request_id: string } };
    expect(body.error.code).toBe("RECEIPT_NOT_FOUND");
    expect(body.error.request_id).toBeTruthy();
  });
});
