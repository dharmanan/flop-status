import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJson, canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { sha256 } from "../crypto/sha256.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../trials/canonical-json-sha256/constants.js";

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

async function json(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status} returned non-JSON: ${text}`);
  }
}

async function expectStatus(response: Response, expected: number): Promise<any> {
  const body = await json(response);
  if (response.status !== expected) {
    throw new Error(`HTTP ${response.status}, expected ${expected}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main(): Promise<void> {
  const base = (process.env.FLOP_DEPLOYED_API_BASE ?? "https://flop-status-production.up.railway.app").replace(/\/$/, "");
  const agent = createAgent();

  const created = await expectStatus(
    await fetch(`${base}/api/v1/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_did: agent.did, trial_id: TRIAL_ID }),
    }),
    201,
  ) as {
    challenge: {
      challenge_id: string;
      trial_id: string;
      capability_id: string;
      case: { document: unknown };
    };
    challenge_hash: string;
  };

  if (created.challenge.trial_id !== TRIAL_ID || created.challenge.capability_id !== CAPABILITY_ID) {
    throw new Error(`wrong Trial 2 challenge metadata: ${JSON.stringify(created.challenge)}`);
  }

  const canonicalJson = canonicalizeJson(created.challenge.case.document);
  const result = {
    canonical_json: canonicalJson,
    sha256: sha256(new TextEncoder().encode(canonicalJson)),
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
  const envelope = {
    payload,
    signature: {
      algorithm: "Ed25519" as const,
      encoding: "base64url" as const,
      value: agent.sign(canonicalizeJsonToBytes(payload)),
    },
  };

  const submitted = await expectStatus(
    await fetch(`${base}/api/v1/challenges/${created.challenge.challenge_id}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    }),
    200,
  ) as { state: string; verdict: string; receipt_id: string | null };

  if (submitted.state !== "PASS" || submitted.verdict !== "PASS" || !submitted.receipt_id) {
    throw new Error(`Trial 2 did not produce PASS receipt: ${JSON.stringify(submitted)}`);
  }

  const verification = await expectStatus(
    await fetch(`${base}/api/v1/verification/${submitted.receipt_id}`),
    200,
  ) as { signature_status: string; receipt?: { capability_id?: string; trial_id?: string } };
  if (verification.signature_status !== "VALID") {
    throw new Error(`Trial 2 receipt signature is not VALID: ${JSON.stringify(verification)}`);
  }

  const agentState = await expectStatus(
    await fetch(`${base}/api/v1/agents/${encodeURIComponent(agent.did)}`),
    200,
  );
  const capability = agentState.agent?.capabilities?.find(
    (item: { capability_id?: string }) => item.capability_id === CAPABILITY_ID,
  );
  if (!capability || capability.evidence_type !== "DETERMINISTICALLY_VERIFIED") {
    throw new Error(`Trial 2 capability evidence missing: ${JSON.stringify(agentState)}`);
  }

  process.stdout.write(JSON.stringify({
    deployedTrial2: "PASS",
    capabilityId: CAPABILITY_ID,
    trialId: TRIAL_ID,
    deterministicVerification: "PASS",
    publicReceiptSignature: "VALID",
    durableCapabilityEvidence: "PASS",
    agentDid: agent.did,
    receiptId: submitted.receipt_id,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Deployed Trial 2 acceptance failed: ${message}\n`);
  process.exitCode = 1;
});
