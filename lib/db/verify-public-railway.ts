import { generateKeyPairSync, randomUUID, sign as cryptoSign } from "node:crypto";
import { issueEd25519SignatureChallenge } from "../challenges/issuance-service.js";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { sha256 } from "../crypto/sha256.js";
import type { AttestationSigner } from "../receipts/receipt.js";
import { acceptTrial1SignedSubmission } from "../submissions/submission-service.js";
import {
  CANONICALIZATION_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../trials/ed25519-signature-verification/constants.js";
import { finalizeTrial1Verification } from "../verification/finalization-service.js";
import { PgPassFinalizationRepository } from "./finalization-repository.js";
import { runMigrations } from "./migration-runner.js";
import { createPgPool, PgChallengeRepository, PgSubmissionRepository } from "./pg-adapter.js";

function createIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const raw = decodeBase64Url(jwk.x);
  const prefixed = new Uint8Array(raw.length + 2);
  prefixed.set([0xed, 0x01]);
  prefixed.set(raw, 2);
  return {
    did: `did:key:z${encodeBase58btc(prefixed)}`,
    sign(bytes: Uint8Array): string {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(bytes), privateKey)));
    },
  };
}

function createSigner(): AttestationSigner {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  return {
    keyId: `railway-public-test-${randomUUID()}`,
    algorithm: "Ed25519",
    publicKeyEncoding: "base64url",
    publicKey: jwk.x,
    sign(bytes: Uint8Array): string {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(bytes), privateKey)));
    },
  };
}

async function expectJson(url: string): Promise<{ status: number; body: unknown; text: string }> {
  const response = await fetch(url);
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`expected JSON from ${url}, got status ${response.status}`);
  }
  return { status: response.status, body, text };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must identify the running Railway service");
  }

  const pool = createPgPool(connectionString);
  const challengeRepository = new PgChallengeRepository(pool);
  const submissionRepository = new PgSubmissionRepository(pool);
  const finalizationRepository = new PgPassFinalizationRepository(pool);
  const agent = createIdentity();
  const signer = createSigner();
  let challengeId: string | null = null;

  try {
    await runMigrations(pool);
    const issued = await issueEd25519SignatureChallenge(
      { agentDid: agent.did },
      { repository: challengeRepository },
    );
    challengeId = issued.id;

    const message = decodeBase64Url(issued.publicPayload.case.message);
    const expectedValid = verifyEd25519Signature(
      decodeBase64Url(issued.publicPayload.case.public_key),
      message,
      decodeBase64Url(issued.publicPayload.case.signature),
    );
    const result = {
      valid: expectedValid,
      reason_code: expectedValid ? ("SIGNATURE_VALID" as const) : ("SIGNATURE_INVALID" as const),
      message_hash: sha256(message),
    };
    const payload = {
      submission_version: SUBMISSION_VERSION,
      canonicalization: CANONICALIZATION_ID,
      challenge_id: issued.id,
      challenge_hash: issued.challengeHash,
      agent_did: agent.did,
      trial_id: TRIAL_ID,
      trial_version: TRIAL_VERSION,
      result,
      submitted_at: new Date().toISOString(),
    };
    const envelope = {
      payload,
      signature: {
        algorithm: "Ed25519" as const,
        encoding: "base64url" as const,
        value: agent.sign(canonicalizeJsonToBytes(payload)),
      },
    };

    await acceptTrial1SignedSubmission(
      {
        challengeId: issued.id,
        envelope,
        bodyByteLength: Buffer.byteLength(JSON.stringify(envelope), "utf8"),
      },
      { repository: submissionRepository },
    );

    const finalized = await finalizeTrial1Verification(issued.id, {
      repository: finalizationRepository,
      signer,
    });
    if (finalized.verdict !== "PASS") throw new Error("public test requires PASS receipt");

    const receiptId = finalized.receipt.receipt_id;
    const base = `http://127.0.0.1:${port}`;
    const receiptResponse = await expectJson(`${base}/api/v1/receipts/${receiptId}`);
    const verificationResponse = await expectJson(`${base}/api/v1/verification/${receiptId}`);
    const keysResponse = await expectJson(`${base}/api/v1/server-keys`);
    const pageResponse = await fetch(`${base}/verify/${receiptId}`);
    const pageHtml = await pageResponse.text();

    if (receiptResponse.status !== 200) throw new Error("receipt endpoint did not return 200");
    if (verificationResponse.status !== 200) throw new Error("verification endpoint did not return 200");
    if (keysResponse.status !== 200) throw new Error("server keys endpoint did not return 200");
    if (pageResponse.status !== 200) throw new Error("public verification page did not return 200");

    const verification = verificationResponse.body as {
      receipt?: { receipt_id?: string; server_key_id?: string };
      server_key?: { key_id?: string; public_key?: string };
      signature_status?: string;
    };
    if (verification.signature_status !== "VALID") {
      throw new Error(`expected VALID public verification, got ${verification.signature_status}`);
    }
    if (verification.receipt?.receipt_id !== receiptId) throw new Error("receipt id mismatch");
    if (verification.receipt?.server_key_id !== signer.keyId) throw new Error("receipt key id mismatch");
    if (verification.server_key?.key_id !== signer.keyId) throw new Error("public key id mismatch");
    if (verification.server_key?.public_key !== signer.publicKey) throw new Error("public key mismatch");

    const serializedPublicResponses = receiptResponse.text + verificationResponse.text + keysResponse.text + pageHtml;
    if (serializedPublicResponses.includes("private_key")) {
      throw new Error("public verification surface exposed private_key material");
    }
    if (!pageHtml.includes("Receipt signature:") || !pageHtml.includes("CHECKING")) {
      throw new Error("verification page is missing browser verification status surface");
    }
    const csp = pageResponse.headers.get("content-security-policy") ?? "";
    if (!csp.includes("script-src 'self'") || !csp.includes("default-src 'none'")) {
      throw new Error("verification page CSP is not strict enough");
    }

    process.stdout.write(
      JSON.stringify(
        {
          receiptApi: "PASS",
          publicVerificationApi: "PASS",
          serverKeysApi: "PASS",
          receiptSignatureStatus: "VALID",
          publicVerificationPage: "PASS",
          strictCsp: "PASS",
          privateKeyLeak: "NO",
          receiptId,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    try {
      if (challengeId) {
        await pool.query(
          "DELETE FROM capability_records WHERE agent_id IN (SELECT agent_id FROM challenge_instances WHERE id = $1)",
          [challengeId],
        );
        await pool.query("DELETE FROM receipts WHERE challenge_id = $1", [challengeId]);
        await pool.query("DELETE FROM verification_runs WHERE challenge_id = $1", [challengeId]);
        await pool.query("DELETE FROM submissions WHERE challenge_id = $1", [challengeId]);
        await pool.query("DELETE FROM challenge_instances WHERE id = $1", [challengeId]);
      }
      await pool.query("DELETE FROM server_signing_keys WHERE key_id = $1", [signer.keyId]);
      await pool.query("DELETE FROM agents WHERE did = $1", [agent.did]);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Railway public verification failed: ${message}\n`);
  process.exitCode = 1;
});
