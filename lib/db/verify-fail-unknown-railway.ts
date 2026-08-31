import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { sha256 } from "../crypto/sha256.js";
import { PgTrial1FinalizationRepository } from "./finalization-recovery-repository.js";
import { createPgPool, PgSubmissionRepository } from "./pg-adapter.js";
import { loadAttestationSignerFromEnv } from "../receipts/attestation-signer.js";
import { acceptTrial1SignedSubmission } from "../submissions/submission-service.js";
import {
  CANONICALIZATION_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../trials/ed25519-signature-verification/constants.js";
import {
  FinalizationUnknownError,
  finalizeTrial1WithUnknownRecovery,
} from "../verification/finalization-unknown-recovery.js";

function createAgent() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const raw = decodeBase64Url(jwk.x);
  const prefixed = new Uint8Array(raw.length + 2);
  prefixed.set([0xed, 0x01], 0);
  prefixed.set(raw, 2);
  return {
    did: `did:key:z${encodeBase58btc(prefixed)}`,
    sign(bytes: Uint8Array): string {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(bytes), privateKey)));
    },
  };
}

async function expectJson(response: Response, expectedStatus: number): Promise<any> {
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`HTTP ${response.status}, expected ${expectedStatus}: ${text}`);
  }
  return JSON.parse(text);
}

async function createChallenge(base: string, agentDid: string) {
  return expectJson(
    await fetch(`${base}/api/v1/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_did: agentDid, trial_id: TRIAL_ID }),
    }),
    201,
  ) as Promise<{
    challenge: {
      challenge_id: string;
      case: { public_key: string; message: string; signature: string };
    };
    challenge_hash: string;
  }>;
}

function buildEnvelope(
  agent: ReturnType<typeof createAgent>,
  created: Awaited<ReturnType<typeof createChallenge>>,
  forceWrong: boolean,
) {
  const message = decodeBase64Url(created.challenge.case.message);
  const expectedValid = verifyEd25519Signature(
    decodeBase64Url(created.challenge.case.public_key),
    message,
    decodeBase64Url(created.challenge.case.signature),
  );
  const submittedValid = forceWrong ? !expectedValid : expectedValid;
  const result = {
    valid: submittedValid,
    reason_code: submittedValid ? "SIGNATURE_VALID" as const : "SIGNATURE_INVALID" as const,
    message_hash: sha256(message),
  };
  const payload = {
    submission_version: SUBMISSION_VERSION,
    canonicalization: CANONICALIZATION_ID,
    challenge_id: created.challenge.challenge_id,
    challenge_hash: created.challenge_hash,
    agent_did: agent.did,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    result,
    submitted_at: new Date().toISOString(),
  };
  return {
    payload,
    signature: {
      algorithm: "Ed25519" as const,
      encoding: "base64url" as const,
      value: agent.sign(canonicalizeJsonToBytes(payload)),
    },
  };
}

async function cleanup(pool: ReturnType<typeof createPgPool>, challengeId: string | null, did: string) {
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
  await pool.query("DELETE FROM agents WHERE did = $1", [did]);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const port = Number(process.env.PORT ?? "3000");
  const base = `http://127.0.0.1:${port}`;
  const pool = createPgPool(connectionString);
  const failAgent = createAgent();
  const unknownAgent = createAgent();
  let failChallengeId: string | null = null;
  let unknownChallengeId: string | null = null;

  try {
    // Gate H: a validly DID-signed but objectively incorrect result must be capability FAIL.
    const failCreated = await createChallenge(base, failAgent.did);
    failChallengeId = failCreated.challenge.challenge_id;
    const wrongEnvelope = buildEnvelope(failAgent, failCreated, true);
    const failResponse = await expectJson(
      await fetch(`${base}/api/v1/challenges/${failChallengeId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wrongEnvelope),
      }),
      200,
    ) as { state: string; verdict: string; receipt_id: string | null };
    if (failResponse.state !== "FAIL" || failResponse.verdict !== "FAIL" || failResponse.receipt_id !== null) {
      throw new Error(`deterministic FAIL HTTP response invariant failed: ${JSON.stringify(failResponse)}`);
    }

    const failDb = await pool.query<{
      state: string;
      verdict: string;
      receipt_count: string;
      capability_count: string;
    }>(
      `SELECT ci.state::text AS state, vr.verdict::text AS verdict,
         (SELECT count(*)::text FROM receipts r WHERE r.challenge_id = ci.id) AS receipt_count,
         (SELECT count(*)::text FROM capability_records cr WHERE cr.agent_id = ci.agent_id) AS capability_count
       FROM challenge_instances ci
       JOIN verification_runs vr ON vr.challenge_id = ci.id
       WHERE ci.id = $1`,
      [failChallengeId],
    );
    const failRow = failDb.rows[0];
    if (!failRow || failRow.state !== "FAIL" || failRow.verdict !== "FAIL") {
      throw new Error("FAIL verification run was not persisted as FAIL");
    }
    if (Number(failRow.receipt_count) !== 0 || Number(failRow.capability_count) !== 0) {
      throw new Error("FAIL incorrectly created public verified evidence");
    }

    // Gate K: accept a valid signed submission, then inject an internal finalizer fault.
    const unknownCreated = await createChallenge(base, unknownAgent.did);
    unknownChallengeId = unknownCreated.challenge.challenge_id;
    const correctEnvelope = buildEnvelope(unknownAgent, unknownCreated, false);
    await acceptTrial1SignedSubmission(
      {
        challengeId: unknownChallengeId,
        envelope: correctEnvelope,
        bodyByteLength: Buffer.byteLength(JSON.stringify(correctEnvelope), "utf8"),
      },
      { repository: new PgSubmissionRepository(pool) },
    );

    let unknownThrown = false;
    try {
      await finalizeTrial1WithUnknownRecovery(unknownChallengeId, {
        repository: new PgTrial1FinalizationRepository(pool),
        signer: loadAttestationSignerFromEnv(),
        finalizer: async () => {
          throw new Error("controlled acceptance fault");
        },
      });
    } catch (error) {
      unknownThrown = error instanceof FinalizationUnknownError;
    }
    if (!unknownThrown) throw new Error("controlled finalization fault did not surface as UNKNOWN");

    const unknownState = await expectJson(
      await fetch(`${base}/api/v1/challenges/${unknownChallengeId}`),
      200,
    ) as { state: string; receipt_id: string | null };
    if (unknownState.state !== "UNKNOWN" || unknownState.receipt_id !== null) {
      throw new Error(`user-facing recovery state was not UNKNOWN: ${JSON.stringify(unknownState)}`);
    }

    const unknownDb = await pool.query<{
      state: string;
      verdict: string;
      reason_code: string;
      receipt_count: string;
      capability_count: string;
      submission_count: string;
    }>(
      `SELECT ci.state::text AS state, vr.verdict::text AS verdict, vr.reason_code,
         (SELECT count(*)::text FROM receipts r WHERE r.challenge_id = ci.id) AS receipt_count,
         (SELECT count(*)::text FROM capability_records cr WHERE cr.agent_id = ci.agent_id) AS capability_count,
         (SELECT count(*)::text FROM submissions s WHERE s.challenge_id = ci.id) AS submission_count
       FROM challenge_instances ci
       JOIN verification_runs vr ON vr.challenge_id = ci.id
       WHERE ci.id = $1`,
      [unknownChallengeId],
    );
    const unknownRow = unknownDb.rows[0];
    if (!unknownRow || unknownRow.state !== "UNKNOWN" || unknownRow.verdict !== "UNKNOWN") {
      throw new Error("UNKNOWN was not persisted distinctly from FAIL");
    }
    if (unknownRow.reason_code !== "INTERNAL_VERIFICATION_ERROR") {
      throw new Error("UNKNOWN reason code was not persisted");
    }
    if (
      Number(unknownRow.receipt_count) !== 0 ||
      Number(unknownRow.capability_count) !== 0 ||
      Number(unknownRow.submission_count) !== 1
    ) {
      throw new Error("UNKNOWN evidence/submission persistence invariant failed");
    }

    process.stdout.write(JSON.stringify({
      deterministicFailSignedSubmission: "PASS",
      failVerificationRunPersisted: "PASS",
      failChallengeState: "FAIL",
      failPublicVerifiedReceiptCreated: "NO",
      failCapabilityRecordIncremented: "NO",
      controlledInternalFault: "PASS",
      unknownChallengeState: "UNKNOWN",
      unknownVerificationRunPersisted: "PASS",
      unknownLabeledFail: "NO",
      unknownPublicVerifiedReceiptCreated: "NO",
      unknownCapabilityRecordIncremented: "NO",
      acceptedUnknownSubmissionRetained: "PASS",
    }, null, 2) + "\n");
  } finally {
    try {
      await cleanup(pool, failChallengeId, failAgent.did);
      await cleanup(pool, unknownChallengeId, unknownAgent.did);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Railway FAIL/UNKNOWN verification failed: ${message}\n`);
  process.exitCode = 1;
});
