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

async function expectJson(response: Response, expectedStatus: number): Promise<any> {
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`HTTP ${response.status}, expected ${expectedStatus}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`response was not JSON: ${text}`);
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const keyId = process.env.FLOP_ATTESTATION_KEY_ID;
  const privateKeySecret = process.env.FLOP_ATTESTATION_PRIVATE_KEY_PKCS8_B64URL;
  if (!keyId || !privateKeySecret) throw new Error("attestation signer env is required");

  const port = Number(process.env.PORT ?? "3000");
  const base = `http://127.0.0.1:${port}`;
  const pool = createPgPool(connectionString);
  const agent = createAgent();
  let challengeId: string | null = null;

  try {
    const createResponse = await fetch(`${base}/api/v1/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_did: agent.did, trial_id: TRIAL_ID }),
    });
    const created = await expectJson(createResponse, 201) as {
      challenge: {
        challenge_id: string;
        case: { public_key: string; message: string; signature: string };
      };
      challenge_hash: string;
    };
    challengeId = created.challenge.challenge_id;

    const issuedState = await expectJson(await fetch(`${base}/api/v1/challenges/${challengeId}`), 200);
    if (issuedState.state !== "ISSUED" || issuedState.receipt_id !== null) {
      throw new Error("challenge recovery did not report ISSUED before submission");
    }

    const message = decodeBase64Url(created.challenge.case.message);
    const valid = verifyEd25519Signature(
      decodeBase64Url(created.challenge.case.public_key),
      message,
      decodeBase64Url(created.challenge.case.signature),
    );
    const result = {
      valid,
      reason_code: valid ? "SIGNATURE_VALID" as const : "SIGNATURE_INVALID" as const,
      message_hash: sha256(message),
    };
    const payload = {
      submission_version: SUBMISSION_VERSION,
      canonicalization: CANONICALIZATION_ID,
      challenge_id: challengeId,
      challenge_hash: created.challenge_hash,
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

    const submit = await expectJson(
      await fetch(`${base}/api/v1/challenges/${challengeId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      }),
      200,
    ) as { state: string; verdict: string; receipt_id: string | null };
    if (submit.state !== "PASS" || submit.verdict !== "PASS" || !submit.receipt_id) {
      throw new Error(`expected HTTP PASS with receipt, got ${JSON.stringify(submit)}`);
    }

    const recovered = await expectJson(await fetch(`${base}/api/v1/challenges/${challengeId}`), 200);
    if (recovered.state !== "PASS" || recovered.receipt_id !== submit.receipt_id) {
      throw new Error("challenge recovery did not expose durable PASS receipt id");
    }

    const receiptResponse = await fetch(`${base}/api/v1/receipts/${submit.receipt_id}`);
    const receiptText = await receiptResponse.text();
    if (receiptResponse.status !== 200) throw new Error(`receipt API failed: ${receiptText}`);
    const receiptBody = JSON.parse(receiptText) as { receipt: { server_key_id: string } };
    if (receiptBody.receipt.server_key_id !== keyId) {
      throw new Error("receipt was not signed by configured persistent Railway key id");
    }

    const verificationResponse = await fetch(`${base}/api/v1/verification/${submit.receipt_id}`);
    const verificationText = await verificationResponse.text();
    if (verificationResponse.status !== 200) {
      throw new Error(`verification API failed: ${verificationText}`);
    }
    const verification = JSON.parse(verificationText) as {
      signature_status: string;
      server_key: { key_id: string };
    };
    if (verification.signature_status !== "VALID" || verification.server_key.key_id !== keyId) {
      throw new Error("public verification did not validate configured persistent signer receipt");
    }

    const keysResponse = await fetch(`${base}/api/v1/server-keys`);
    const keysText = await keysResponse.text();
    if (keysResponse.status !== 200) throw new Error(`server keys API failed: ${keysText}`);
    const keys = JSON.parse(keysText) as { keys: Array<{ key_id: string }> };
    if (!keys.keys.some((key) => key.key_id === keyId)) {
      throw new Error("configured persistent signer public key is not published");
    }

    const allPublicText = `${receiptText}\n${verificationText}\n${keysText}`;
    if (allPublicText.includes(privateKeySecret)) {
      throw new Error("private attestation key leaked into a public response");
    }

    process.stdout.write(JSON.stringify({
      challengeCreateHttp: "PASS",
      challengeRecoveryBeforeSubmission: "PASS",
      signedSubmissionHttp: "PASS",
      deterministicPassHttp: "PASS",
      durableChallengeRecoveryAfterPass: "PASS",
      persistentRailwaySignerUsed: "PASS",
      publicReceiptSignature: "VALID",
      persistentPublicKeyPublished: "PASS",
      privateKeyLeak: "NO",
      receiptId: submit.receipt_id,
    }, null, 2) + "\n");
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
      await pool.query("DELETE FROM agents WHERE did = $1", [agent.did]);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Railway write HTTP verification failed: ${message}\n`);
  process.exitCode = 1;
});
