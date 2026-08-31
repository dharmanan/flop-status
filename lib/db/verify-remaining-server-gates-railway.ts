import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { sha256 } from "../crypto/sha256.js";
import { CANONICALIZATION_ID, SUBMISSION_VERSION, TRIAL_ID, TRIAL_VERSION } from "../trials/ed25519-signature-verification/constants.js";
import { createPgPool } from "./pg-adapter.js";

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

async function json(response: Response): Promise<any> {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`non-JSON response ${response.status}: ${text}`); }
}

async function createChallenge(base: string, did: string) {
  const response = await fetch(`${base}/api/v1/challenges`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_did: did, trial_id: TRIAL_ID }),
  });
  const body = await json(response);
  if (response.status !== 201) throw new Error(`challenge create failed: ${response.status} ${JSON.stringify(body)}`);
  return body as { challenge: { challenge_id: string; case: { public_key: string; message: string; signature: string } }; challenge_hash: string };
}

function correctResult(created: Awaited<ReturnType<typeof createChallenge>>) {
  const message = decodeBase64Url(created.challenge.case.message);
  const valid = verifyEd25519Signature(
    decodeBase64Url(created.challenge.case.public_key),
    message,
    decodeBase64Url(created.challenge.case.signature),
  );
  return {
    valid,
    reason_code: valid ? "SIGNATURE_VALID" as const : "SIGNATURE_INVALID" as const,
    message_hash: sha256(message),
  };
}

function envelope(agent: ReturnType<typeof createAgent>, created: Awaited<ReturnType<typeof createChallenge>>, result = correctResult(created)) {
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

async function cleanup(pool: ReturnType<typeof createPgPool>, challengeIds: string[], dids: string[]) {
  for (const id of challengeIds) {
    await pool.query("DELETE FROM capability_records WHERE agent_id IN (SELECT agent_id FROM challenge_instances WHERE id = $1)", [id]);
    await pool.query("DELETE FROM receipts WHERE challenge_id = $1", [id]);
    await pool.query("DELETE FROM verification_runs WHERE challenge_id = $1", [id]);
    await pool.query("DELETE FROM submissions WHERE challenge_id = $1", [id]);
    await pool.query("DELETE FROM challenge_instances WHERE id = $1", [id]);
  }
  for (const did of dids) await pool.query("DELETE FROM agents WHERE did = $1", [did]);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const port = Number(process.env.PORT ?? "3000");
  const base = `http://127.0.0.1:${port}`;
  const pool = createPgPool(connectionString);
  const a = createAgent();
  const b = createAgent();
  const challengeIds: string[] = [];

  try {
    // Gate E: mutate a signed field after signing.
    const tamperChallenge = await createChallenge(base, a.did);
    challengeIds.push(tamperChallenge.challenge.challenge_id);
    const signed = envelope(a, tamperChallenge);
    const tampered = { ...signed, payload: { ...signed.payload, result: { ...signed.payload.result, valid: !signed.payload.result.valid } } };
    const tamperResponse = await fetch(`${base}/api/v1/challenges/${tamperChallenge.challenge.challenge_id}/submissions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(tampered),
    });
    const tamperBody = await json(tamperResponse);
    if (tamperResponse.status !== 401 || tamperBody.error?.code !== "INVALID_AGENT_SIGNATURE") throw new Error("tamper rejection failed");
    const tamperDb = await pool.query<{ state: string; submissions: string; runs: string }>(
      `SELECT ci.state::text AS state,
        (SELECT count(*)::text FROM submissions s WHERE s.challenge_id = ci.id) AS submissions,
        (SELECT count(*)::text FROM verification_runs v WHERE v.challenge_id = ci.id) AS runs
       FROM challenge_instances ci WHERE ci.id=$1`, [tamperChallenge.challenge.challenge_id]);
    if (tamperDb.rows[0]?.state !== "ISSUED" || tamperDb.rows[0]?.submissions !== "0" || tamperDb.rows[0]?.runs !== "0") throw new Error("tamper changed capability state");
    await pool.query("UPDATE challenge_instances SET state='EXPIRED', completed_at=now() WHERE id=$1", [tamperChallenge.challenge.challenge_id]);

    // Gate F: DID B signs a payload for Challenge A.
    const didChallenge = await createChallenge(base, a.did);
    challengeIds.push(didChallenge.challenge.challenge_id);
    const resultA = correctResult(didChallenge);
    const payloadB = { ...envelope(a, didChallenge, resultA).payload, agent_did: b.did };
    const envelopeB = { payload: payloadB, signature: { algorithm: "Ed25519" as const, encoding: "base64url" as const, value: b.sign(canonicalizeJsonToBytes(payloadB)) } };
    const didResponse = await fetch(`${base}/api/v1/challenges/${didChallenge.challenge.challenge_id}/submissions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelopeB),
    });
    const didBody = await json(didResponse);
    if (didResponse.status !== 409 || didBody.error?.code !== "CHALLENGE_BINDING_MISMATCH") throw new Error("DID binding rejection failed");
    const didState = await json(await fetch(`${base}/api/v1/challenges/${didChallenge.challenge.challenge_id}`));
    if (didState.state !== "ISSUED") throw new Error("DID binding consumed challenge");
    await pool.query("UPDATE challenge_instances SET state='EXPIRED', completed_at=now() WHERE id=$1", [didChallenge.challenge.challenge_id]);

    // Gate I: use a controlled DB fixture to move the complete ten-minute
    // validity window into the past without violating expires_at > issued_at.
    const expiryChallenge = await createChallenge(base, a.did);
    challengeIds.push(expiryChallenge.challenge.challenge_id);
    await pool.query(
      `UPDATE challenge_instances
       SET issued_at = now() - interval '10 minutes 1 second',
           expires_at = now() - interval '1 second'
       WHERE id=$1`,
      [expiryChallenge.challenge.challenge_id],
    );
    const expiryEnvelope = envelope(a, expiryChallenge);
    const expiryResponse = await fetch(`${base}/api/v1/challenges/${expiryChallenge.challenge.challenge_id}/submissions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(expiryEnvelope),
    });
    const expiryBody = await json(expiryResponse);
    if (expiryResponse.status !== 410 || expiryBody.error?.code !== "CHALLENGE_EXPIRED") throw new Error("expired submission was not rejected");
    const expiredState = await json(await fetch(`${base}/api/v1/challenges/${expiryChallenge.challenge.challenge_id}`));
    if (expiredState.state !== "EXPIRED") throw new Error("expired challenge state not persisted");
    const replacement = await createChallenge(base, a.did);
    challengeIds.push(replacement.challenge.challenge_id);
    await pool.query("UPDATE challenge_instances SET state='EXPIRED', completed_at=now() WHERE id=$1", [replacement.challenge.challenge_id]);

    // Gate J concurrent race: exactly one request consumes the challenge.
    const raceChallenge = await createChallenge(base, a.did);
    challengeIds.push(raceChallenge.challenge.challenge_id);
    const raceEnvelope = envelope(a, raceChallenge);
    const request = () => fetch(`${base}/api/v1/challenges/${raceChallenge.challenge.challenge_id}/submissions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(raceEnvelope),
    });
    const [r1, r2] = await Promise.all([request(), request()]);
    const [b1, b2] = await Promise.all([json(r1), json(r2)]);
    const statuses = [r1.status, r2.status].sort((x, y) => x - y);
    if (statuses[0] !== 200 || statuses[1] !== 409) throw new Error(`concurrent statuses unexpected: ${statuses.join(",")}`);
    const conflict = r1.status === 409 ? b1 : b2;
    if (conflict.error?.code !== "CHALLENGE_ALREADY_CONSUMED") throw new Error("concurrent loser was not replay-protected");
    const raceDb = await pool.query<{ submissions: string; receipts: string; state: string }>(
      `SELECT ci.state::text AS state,
        (SELECT count(*)::text FROM submissions s WHERE s.challenge_id=ci.id) AS submissions,
        (SELECT count(*)::text FROM receipts r WHERE r.challenge_id=ci.id) AS receipts
       FROM challenge_instances ci WHERE ci.id=$1`, [raceChallenge.challenge.challenge_id]);
    if (raceDb.rows[0]?.submissions !== "1" || raceDb.rows[0]?.receipts !== "1" || raceDb.rows[0]?.state !== "PASS") throw new Error("concurrent race persistence invariant failed");

    process.stdout.write(JSON.stringify({
      signedFieldTamperRejected: "PASS",
      tamperProducedCapabilityFail: "NO",
      didBindingRejected: "PASS",
      didBindingChallengeUnconsumed: "PASS",
      expiredSubmissionRejected: "PASS",
      expiredChallengeState: "EXPIRED",
      freshReplacementAfterExpiry: "PASS",
      concurrentSubmissionRace: "PASS",
      exactlyOneAcceptedSubmission: "PASS",
      exactlyOneReceiptAfterRace: "PASS",
    }, null, 2) + "\n");
  } finally {
    try { await cleanup(pool, challengeIds, [a.did, b.did]); } finally { await pool.end(); }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Remaining Railway acceptance verification failed: ${message}\n`);
  process.exitCode = 1;
});
