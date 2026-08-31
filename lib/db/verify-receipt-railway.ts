import { generateKeyPairSync, randomUUID, sign as cryptoSign } from "node:crypto";
import { issueEd25519SignatureChallenge } from "../challenges/issuance-service.js";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { sha256 } from "../crypto/sha256.js";
import { verifyPassReceiptSignature, type AttestationSigner } from "../receipts/receipt.js";
import { acceptTrial1SignedSubmission } from "../submissions/submission-service.js";
import { CANONICALIZATION_ID, SUBMISSION_VERSION, TRIAL_ID, TRIAL_VERSION } from "../trials/ed25519-signature-verification/constants.js";
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
    keyId: `railway-test-${randomUUID()}`,
    algorithm: "Ed25519",
    publicKeyEncoding: "base64url",
    publicKey: jwk.x,
    sign(bytes: Uint8Array): string {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(bytes), privateKey)));
    },
  };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const pool = createPgPool(connectionString);
  const challengeRepository = new PgChallengeRepository(pool);
  const submissionRepository = new PgSubmissionRepository(pool);
  const finalizationRepository = new PgPassFinalizationRepository(pool);
  const agent = createIdentity();
  const signer = createSigner();
  let challengeId: string | null = null;

  try {
    const migrations = await runMigrations(pool);
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
      reason_code: expectedValid ? "SIGNATURE_VALID" as const : "SIGNATURE_INVALID" as const,
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
    if (finalized.verdict !== "PASS") {
      throw new Error(`expected PASS finalization, got ${finalized.verdict}`);
    }
    if (!verifyPassReceiptSignature(finalized.receipt, signer.publicKey)) {
      throw new Error("persisted receipt signature did not verify");
    }
    const tampered = { ...finalized.receipt, result_hash: sha256(new TextEncoder().encode("tampered")) };
    if (verifyPassReceiptSignature(tampered, signer.publicKey)) {
      throw new Error("tampered receipt unexpectedly verified");
    }

    const persisted = await pool.query<{
      state: string;
      receipt_count: string;
      run_count: string;
      passed_trials: number;
      stored_signature: string;
      public_key: string;
    }>(
      `SELECT ci.state,
         (SELECT count(*)::text FROM receipts r WHERE r.challenge_id = ci.id) AS receipt_count,
         (SELECT count(*)::text FROM verification_runs vr WHERE vr.challenge_id = ci.id) AS run_count,
         cr.passed_trials,
         r.server_signature AS stored_signature,
         sk.public_key
       FROM challenge_instances ci
       JOIN receipts r ON r.challenge_id = ci.id
       JOIN server_signing_keys sk ON sk.key_id = r.server_key_id
       JOIN capability_records cr ON cr.agent_id = ci.agent_id AND cr.capability_id = $2
       WHERE ci.id = $1`,
      [issued.id, "cryptography.signature-verification"],
    );
    const row = persisted.rows[0];
    if (!row || row.state !== "PASS" || Number(row.receipt_count) !== 1 || Number(row.run_count) !== 1) {
      throw new Error("atomic PASS persistence invariant failed");
    }
    if (row.passed_trials !== 1 || row.stored_signature !== finalized.receipt.server_signature || row.public_key !== signer.publicKey) {
      throw new Error("receipt/key/capability record persistence invariant failed");
    }

    process.stdout.write(JSON.stringify({
      migrations,
      atomicPassFinalization: "PASS",
      verificationRunPersisted: "PASS",
      exactlyOneReceipt: "PASS",
      capabilityRecordUpdated: "PASS",
      receiptSignature: "VALID",
      receiptTamperDetection: "PASS",
      serverPrivateKeyPersisted: "NO",
      receiptId: finalized.receipt.receipt_id,
    }, null, 2) + "\n");
  } finally {
    try {
      if (challengeId) {
        await pool.query("DELETE FROM capability_records WHERE agent_id IN (SELECT agent_id FROM challenge_instances WHERE id = $1)", [challengeId]);
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
  process.stderr.write(`Railway receipt verification failed: ${message}\n`);
  process.exitCode = 1;
});
