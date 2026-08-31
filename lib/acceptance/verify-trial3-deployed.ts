import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { buildCanonicalTechnocoreMessage } from "../trials/technocore-canonical-message/protocol.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../trials/technocore-canonical-message/constants.js";

type AgentSigner = { did: string; sign(bytes: Uint8Array): string };
type CreatedChallenge = {
  challenge: {
    challenge_id: string;
    trial_id: string;
    capability_id: string;
    case: { room: string; nonce: string; text: string };
  };
  challenge_hash: string;
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
    sign(bytes) {
      return encodeBase64Url(new Uint8Array(cryptoSign(null, Buffer.from(bytes), privateKey)));
    },
  };
}

async function json(response: Response): Promise<any> {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`HTTP ${response.status} returned non-JSON: ${text}`); }
}

async function expectStatus(response: Response, expected: number): Promise<any> {
  const body = await json(response);
  if (response.status !== expected) {
    throw new Error(`HTTP ${response.status}, expected ${expected}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function issue(base: string, agent: AgentSigner): Promise<CreatedChallenge> {
  return expectStatus(
    await fetch(`${base}/api/v1/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_did: agent.did, trial_id: TRIAL_ID }),
    }),
    201,
  );
}

function signedEnvelope(agent: AgentSigner, created: CreatedChallenge, canonicalMessage: string) {
  const expected = buildCanonicalTechnocoreMessage(
    created.challenge.case.room,
    created.challenge.case.nonce,
    created.challenge.case.text,
  );
  const payload = {
    submission_version: SUBMISSION_VERSION,
    canonicalization: CANONICALIZATION_ID,
    challenge_id: created.challenge.challenge_id,
    challenge_hash: created.challenge_hash,
    agent_did: agent.did,
    trial_id: TRIAL_ID,
    trial_version: TRIAL_VERSION,
    result: {
      cleaned_text: expected.cleanedText,
      canonical_message: canonicalMessage,
    },
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

async function submit(base: string, created: CreatedChallenge, envelope: unknown) {
  return expectStatus(
    await fetch(`${base}/api/v1/challenges/${created.challenge.challenge_id}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    }),
    200,
  ) as Promise<{ state: string; verdict: string; receipt_id: string | null }>;
}

async function main(): Promise<void> {
  const base = (process.env.FLOP_DEPLOYED_API_BASE ?? "https://flop-status-production.up.railway.app").replace(/\/$/, "");
  const agent = createAgent();

  const passChallenge = await issue(base, agent);
  if (passChallenge.challenge.trial_id !== TRIAL_ID || passChallenge.challenge.capability_id !== CAPABILITY_ID) {
    throw new Error(`wrong Trial 3 challenge metadata: ${JSON.stringify(passChallenge.challenge)}`);
  }
  const expected = buildCanonicalTechnocoreMessage(
    passChallenge.challenge.case.room,
    passChallenge.challenge.case.nonce,
    passChallenge.challenge.case.text,
  );
  if (expected.canonicalMessage.includes(agent.did)) {
    throw new Error("Technocore canonical string unexpectedly contains the agent DID");
  }

  const passed = await submit(base, passChallenge, signedEnvelope(agent, passChallenge, expected.canonicalMessage));
  if (passed.state !== "PASS" || passed.verdict !== "PASS" || !passed.receipt_id) {
    throw new Error(`Trial 3 did not produce PASS receipt: ${JSON.stringify(passed)}`);
  }

  const verification = await expectStatus(
    await fetch(`${base}/api/v1/verification/${passed.receipt_id}`),
    200,
  ) as { signature_status: string };
  if (verification.signature_status !== "VALID") {
    throw new Error(`Trial 3 receipt signature is not VALID: ${JSON.stringify(verification)}`);
  }

  const failChallenge = await issue(base, agent);
  const failExpected = buildCanonicalTechnocoreMessage(
    failChallenge.challenge.case.room,
    failChallenge.challenge.case.nonce,
    failChallenge.challenge.case.text,
  );
  const failed = await submit(
    base,
    failChallenge,
    signedEnvelope(agent, failChallenge, `${failExpected.canonicalMessage}x`),
  );
  if (failed.state !== "FAIL" || failed.verdict !== "FAIL" || failed.receipt_id !== null) {
    throw new Error(`deterministic Trial 3 mismatch did not produce receipt-less FAIL: ${JSON.stringify(failed)}`);
  }

  const agentState = await expectStatus(
    await fetch(`${base}/api/v1/agents/${encodeURIComponent(agent.did)}`),
    200,
  );
  const capability = agentState.agent?.capabilities?.find(
    (item: { capability_id?: string }) => item.capability_id === CAPABILITY_ID,
  );
  if (
    !capability ||
    capability.evidence_type !== "DETERMINISTICALLY_VERIFIED" ||
    capability.passed_trials !== 1
  ) {
    throw new Error(`Trial 3 capability evidence changed incorrectly after FAIL: ${JSON.stringify(agentState)}`);
  }

  process.stdout.write(JSON.stringify({
    deployedTrial3: "PASS",
    capabilityId: CAPABILITY_ID,
    trialId: TRIAL_ID,
    referenceCanonicalForm: "room|nonce|cleaned text",
    deterministicPass: "PASS",
    deterministicMismatch: "FAIL_WITHOUT_RECEIPT",
    technocoreNetworkDependency: "NONE",
    publicReceiptSignature: "VALID",
    durableCapabilityEvidence: "PASS_COUNT_1",
    agentDid: agent.did,
    receiptId: passed.receipt_id,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Deployed Trial 3 acceptance failed: ${message}\n`);
  process.exitCode = 1;
});
