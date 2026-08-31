import { generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../trials/signed-receipt-verification/constants.js";

type AgentSigner = { did: string; sign(bytes: Uint8Array): string };
type Trial4Result = {
  status: "VALID" | "INVALID" | "UNKNOWN";
  reason_code: "SIGNATURE_VALID" | "SIGNATURE_INVALID" | "KEY_ID_MISMATCH" | "SERVER_KEY_NOT_FOUND";
  key_id: string | null;
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
  try { return JSON.parse(text); } catch { throw new Error(`HTTP ${response.status} returned non-JSON: ${text}`); }
}

async function expectStatus(response: Response, expected: number): Promise<any> {
  const body = await json(response);
  if (response.status !== expected) throw new Error(`HTTP ${response.status}, expected ${expected}: ${JSON.stringify(body)}`);
  return body;
}

function verifyReceipt(receipt: any, key: any): boolean {
  const { server_signature, ...unsigned } = receipt;
  const publicKey = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(decodeBase64Url(key.public_key)),
  ]);
  return cryptoVerify(
    null,
    Buffer.from(canonicalizeJsonToBytes(unsigned)),
    { key: publicKey, format: "der", type: "spki" },
    Buffer.from(decodeBase64Url(server_signature)),
  );
}

function solve(challenge: any): Trial4Result {
  const receipt = challenge.case.receipt;
  const keys = challenge.case.server_keys;
  const declared = keys.find((key: any) => key.key_id === receipt.server_key_id);
  if (!declared) return { status: "UNKNOWN", reason_code: "SERVER_KEY_NOT_FOUND", key_id: null };
  if (verifyReceipt(receipt, declared)) return { status: "VALID", reason_code: "SIGNATURE_VALID", key_id: declared.key_id };
  const actual = keys.find((key: any) => key.key_id !== declared.key_id && verifyReceipt(receipt, key));
  if (actual) return { status: "INVALID", reason_code: "KEY_ID_MISMATCH", key_id: actual.key_id };
  return { status: "INVALID", reason_code: "SIGNATURE_INVALID", key_id: declared.key_id };
}

async function issue(base: string, agent: AgentSigner) {
  return expectStatus(await fetch(`${base}/api/v1/challenges`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_did: agent.did, trial_id: TRIAL_ID }),
  }), 201);
}

function envelope(agent: AgentSigner, created: any, result: Trial4Result) {
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

async function submit(base: string, created: any, body: any) {
  return expectStatus(await fetch(`${base}/api/v1/challenges/${created.challenge.challenge_id}/submissions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), 200);
}

async function main(): Promise<void> {
  const base = (process.env.FLOP_DEPLOYED_API_BASE ?? "https://flop-status-production.up.railway.app").replace(/\/$/, "");
  const agent = createAgent();

  const passChallenge = await issue(base, agent);
  if (passChallenge.challenge.trial_id !== TRIAL_ID || passChallenge.challenge.capability_id !== CAPABILITY_ID) {
    throw new Error(`wrong Trial 4 challenge metadata: ${JSON.stringify(passChallenge.challenge)}`);
  }
  const correct = solve(passChallenge.challenge);
  const passed = await submit(base, passChallenge, envelope(agent, passChallenge, correct));
  if (passed.verdict !== "PASS" || !passed.receipt_id) throw new Error(`Trial 4 correct result did not PASS: ${JSON.stringify(passed)}`);

  const verification = await expectStatus(await fetch(`${base}/api/v1/verification/${passed.receipt_id}`), 200);
  if (verification.signature_status !== "VALID") throw new Error(`Trial 4 receipt not independently VALID: ${JSON.stringify(verification)}`);

  const failChallenge = await issue(base, agent);
  const expected = solve(failChallenge.challenge);
  const wrong: Trial4Result = {
    ...expected,
    status: expected.status === "VALID" ? "INVALID" : "VALID",
  };
  const failed = await submit(base, failChallenge, envelope(agent, failChallenge, wrong));
  if (failed.verdict !== "FAIL" || failed.receipt_id !== null) throw new Error(`Trial 4 wrong result did not FAIL without receipt: ${JSON.stringify(failed)}`);

  const agentState = await expectStatus(await fetch(`${base}/api/v1/agents/${encodeURIComponent(agent.did)}`), 200);
  const capability = agentState.agent?.capabilities?.find((item: any) => item.capability_id === CAPABILITY_ID);
  if (!capability || capability.evidence_type !== "DETERMINISTICALLY_VERIFIED" || capability.passed_trials !== 1) {
    throw new Error(`Trial 4 durable capability evidence incorrect: ${JSON.stringify(agentState)}`);
  }

  process.stdout.write(JSON.stringify({
    deployedTrial4: "PASS",
    capabilityId: CAPABILITY_ID,
    deterministicCorrectResult: "PASS",
    deterministicWrongResult: "FAIL_WITHOUT_RECEIPT",
    publicReceiptSignature: "VALID",
    durableCapabilityEvidence: "PASS_COUNT_1",
    observedChallengeStatus: correct.status,
    observedChallengeReason: correct.reason_code,
    receiptId: passed.receipt_id,
    agentDid: agent.did,
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`Deployed Trial 4 acceptance failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
