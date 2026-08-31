import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { sha256 } from "../crypto/sha256.js";
import {
  CANONICALIZATION_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../trials/ed25519-signature-verification/constants.js";

type AgentSigner = {
  did: string;
  sign(bytes: Uint8Array): string;
};

function createAgent(): AgentSigner {
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

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status} returned non-JSON: ${text}`);
  }
  return body;
}

async function expectStatus(response: Response, expected: number): Promise<any> {
  const body = await readJson(response);
  if (response.status !== expected) {
    throw new Error(`HTTP ${response.status}, expected ${expected}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main(): Promise<void> {
  const base = (process.env.FLOP_DEPLOYED_API_BASE ?? "https://flop-status-production.up.railway.app").replace(/\/$/, "");
  const agent = createAgent();
  const wrongSigner = createAgent();

  const createBody = { agent_did: agent.did, trial_id: TRIAL_ID };
  const created = await expectStatus(
    await fetch(`${base}/api/v1/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createBody),
    }),
    201,
  ) as {
    challenge: {
      challenge_id: string;
      case: { public_key: string; message: string; signature: string };
    };
    challenge_hash: string;
  };

  const challengeId = created.challenge.challenge_id;

  const declaredOnly = await expectStatus(await fetch(`${base}/api/v1/agents/${encodeURIComponent(agent.did)}`), 200);
  if (!declaredOnly.agent || declaredOnly.agent.did !== agent.did) {
    throw new Error("declared DID was not recoverable after challenge creation");
  }
  if (!Array.isArray(declaredOnly.agent.capabilities) || declaredOnly.agent.capabilities.length !== 0) {
    throw new Error("declaring a DID/challenge unexpectedly created verified capability evidence");
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
  const canonicalPayload = canonicalizeJsonToBytes(payload);

  const wrongEnvelope = {
    payload,
    signature: {
      algorithm: "Ed25519" as const,
      encoding: "base64url" as const,
      value: wrongSigner.sign(canonicalPayload),
    },
  };
  const wrongResponse = await fetch(`${base}/api/v1/challenges/${challengeId}/submissions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(wrongEnvelope),
  });
  const wrongBody = await readJson(wrongResponse);
  if (wrongResponse.ok || wrongBody?.error?.code !== "INVALID_AGENT_SIGNATURE") {
    throw new Error(`wrong signer was not rejected correctly: HTTP ${wrongResponse.status} ${JSON.stringify(wrongBody)}`);
  }

  const validEnvelope = {
    payload,
    signature: {
      algorithm: "Ed25519" as const,
      encoding: "base64url" as const,
      value: agent.sign(canonicalPayload),
    },
  };
  const submitted = await expectStatus(
    await fetch(`${base}/api/v1/challenges/${challengeId}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validEnvelope),
    }),
    200,
  ) as { state: string; verdict: string; receipt_id: string | null };

  if (submitted.state !== "PASS" || submitted.verdict !== "PASS" || !submitted.receipt_id) {
    throw new Error(`external agent did not produce PASS receipt: ${JSON.stringify(submitted)}`);
  }

  const verification = await expectStatus(
    await fetch(`${base}/api/v1/verification/${submitted.receipt_id}`),
    200,
  ) as { signature_status: string };
  if (verification.signature_status !== "VALID") {
    throw new Error(`public receipt verification was not VALID: ${JSON.stringify(verification)}`);
  }

  const agentAfter = await expectStatus(await fetch(`${base}/api/v1/agents/${encodeURIComponent(agent.did)}`), 200);
  const capability = agentAfter.agent?.capabilities?.find(
    (item: { capability_id?: string }) => item.capability_id === "cryptography.signature-verification",
  );
  if (!capability || capability.evidence_type !== "DETERMINISTICALLY_VERIFIED") {
    throw new Error("external agent PASS did not create durable verified capability evidence");
  }

  process.stdout.write(JSON.stringify({
    deployedExternalAgentApi: "PASS",
    didDeclarationAloneCreatesVerifiedEvidence: "NO",
    wrongSignerRejected: "PASS",
    correctExternalSignerAccepted: "PASS",
    deterministicTrial: "PASS",
    publicReceiptSignature: "VALID",
    agentDid: agent.did,
    receiptId: submitted.receipt_id,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Deployed external Agent API acceptance failed: ${message}\n`);
  process.exitCode = 1;
});
