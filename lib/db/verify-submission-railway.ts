import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { issueEd25519SignatureChallenge } from "../challenges/issuance-service.js";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { sha256 } from "../crypto/sha256.js";
import { acceptTrial1SignedSubmission, SubmissionAcceptanceError } from "../submissions/submission-service.js";
import { SUBMISSION_VERSION, CANONICALIZATION_ID, TRIAL_ID, TRIAL_VERSION } from "../trials/ed25519-signature-verification/constants.js";
import { verifyTrial1Result } from "../trials/ed25519-signature-verification/verifier.js";
import { runMigrations } from "./migration-runner.js";
import { createPgPool, PgChallengeRepository, PgSubmissionRepository } from "./pg-adapter.js";

function createAgentIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const rawPublicKey = decodeBase64Url(jwk.x);
  const prefixed = new Uint8Array(2 + rawPublicKey.length);
  prefixed.set([0xed, 0x01], 0);
  prefixed.set(rawPublicKey, 2);
  return {
    did: `did:key:z${encodeBase58btc(prefixed)}`,
    sign(bytes: Uint8Array): string {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(bytes), privateKey)));
    },
  };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPgPool(connectionString);
  const challengeRepository = new PgChallengeRepository(pool);
  const submissionRepository = new PgSubmissionRepository(pool);
  const agent = createAgentIdentity();
  let challengeId: string | null = null;

  try {
    const migrations = await runMigrations(pool);
    const issued = await issueEd25519SignatureChallenge(
      { agentDid: agent.did },
      { repository: challengeRepository },
    );
    challengeId = issued.id;

    const testCase = issued.publicPayload.case;
    const message = decodeBase64Url(testCase.message);
    const expectedValid = verifyEd25519Signature(
      decodeBase64Url(testCase.public_key),
      message,
      decodeBase64Url(testCase.signature),
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

    const accepted = await acceptTrial1SignedSubmission(
      {
        challengeId: issued.id,
        envelope,
        bodyByteLength: Buffer.byteLength(JSON.stringify(envelope), "utf8"),
      },
      { repository: submissionRepository },
    );

    let replayProtected = false;
    try {
      await acceptTrial1SignedSubmission(
        {
          challengeId: issued.id,
          envelope,
          bodyByteLength: Buffer.byteLength(JSON.stringify(envelope), "utf8"),
        },
        { repository: submissionRepository },
      );
    } catch (error) {
      replayProtected =
        error instanceof SubmissionAcceptanceError &&
        error.code === "CHALLENGE_ALREADY_CONSUMED";
    }
    if (!replayProtected) {
      throw new Error("sequential replay was not rejected as already consumed");
    }

    const persisted = await pool.query<{
      state: string;
      public_payload: unknown;
      hidden_context: unknown;
      result_payload: unknown;
      submission_count: string;
    }>(
      `SELECT ci.state, ci.public_payload, ci.hidden_context, s.result_payload,
        (SELECT count(*)::text FROM submissions sx WHERE sx.challenge_id = ci.id) AS submission_count
       FROM challenge_instances ci
       JOIN submissions s ON s.challenge_id = ci.id
       WHERE ci.id = $1`,
      [issued.id],
    );
    const row = persisted.rows[0];
    if (!row || row.state !== "SUBMITTED" || Number(row.submission_count) !== 1) {
      throw new Error("submission persistence invariant failed");
    }

    const verification = verifyTrial1Result({
      publicPayload: row.public_payload,
      hiddenContext: row.hidden_context,
      result: row.result_payload,
    });
    if (verification.verdict !== "PASS") {
      throw new Error(`expected deterministic PASS, got ${verification.verdict}`);
    }

    process.stdout.write(
      JSON.stringify(
        {
          migrations,
          signedSubmissionAcceptance: "PASS",
          oneSubmissionPerChallenge: "PASS",
          sequentialReplayProtection: "PASS",
          challengeStateAfterAcceptance: "SUBMITTED",
          deterministicVerifier: verification,
          acceptedSubmissionId: accepted.id,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    try {
      if (challengeId) {
        await pool.query("DELETE FROM submissions WHERE challenge_id = $1", [challengeId]);
        await pool.query("DELETE FROM challenge_instances WHERE id = $1", [challengeId]);
      }
      await pool.query("DELETE FROM agents WHERE did = $1", [agent.did]);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Railway submission verification failed: ${message}\n`);
  process.exitCode = 1;
});
