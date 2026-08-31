import { generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../crypto/canonical-json.js";
import { sha256 } from "../crypto/sha256.js";
import {
  CANONICALIZATION_ID,
  CAPABILITY_ID,
  PRODUCTION_TRIAL_ID,
  SUBMISSION_VERSION,
  TRIAL_ID,
  TRIAL_VERSION,
} from "../trials/ed25519-signature-verification/constants.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";

type AgentSigner = { did: string; sign(bytes: Uint8Array): string };
type Trial1Result = { valid: boolean; reason_code: "SIGNATURE_VALID" | "SIGNATURE_INVALID"; message_hash: string };

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

function solve(challenge: any): Trial1Result {
  const message = decodeBase64Url(challenge.case.message);
  const valid = verifyEd25519Signature(
    decodeBase64Url(challenge.case.public_key),
    message,
    decodeBase64Url(challenge.case.signature),
  );
  return {
    valid,
    reason_code: valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID",
    message_hash: sha256(message),
  };
}

async function issue(base: string, agent: AgentSigner, trialId: string, expectedStatus = 201) {
  return expectStatus(await fetch(`${base}/api/v1/challenges`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_did: agent.did, trial_id: trialId }),
  }), expectedStatus);
}

function envelope(agent: AgentSigner, created: any, trialId: string, result: Trial1Result) {
  const payload = {
    submission_version: SUBMISSION_VERSION,
    canonicalization: CANONICALIZATION_ID,
    challenge_id: created.challenge.challenge_id,
    challenge_hash: created.challenge_hash,
    agent_did: agent.did,
    trial_id: trialId,
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

async function certificateState(base: string, did: string) {
  return expectStatus(await fetch(`${base}/api/v1/agents/${encodeURIComponent(did)}/certificates`), 200);
}

async function main(): Promise<void> {
  const base = (process.env.FLOP_DEPLOYED_API_BASE ?? "https://flop-status-production.up.railway.app").replace(/\/$/, "");
  const agent = createAgent();

  // Historical protocol evidence exists for this DID, but must not count as a production certificate.
  const historical = await issue(base, agent, TRIAL_ID);
  const historicalPass = await submit(base, historical, envelope(agent, historical, TRIAL_ID, solve(historical.challenge)));
  if (historicalPass.verdict !== "PASS" || !historicalPass.receipt_id || historicalPass.certificate_id) {
    throw new Error(`historical Trial 1 produced wrong state: ${JSON.stringify(historicalPass)}`);
  }
  const zeroCertificates = await certificateState(base, agent.did);
  if (zeroCertificates.certificate_count !== 0 || zeroCertificates.certificates.length !== 0) {
    throw new Error(`historical evidence leaked into production certificates: ${JSON.stringify(zeroCertificates)}`);
  }

  // Production verification is blocked until the capability is acquired.
  const blocked = await issue(base, agent, PRODUCTION_TRIAL_ID, 409);
  if (blocked.error?.code !== "CAPABILITY_NOT_INSTALLED") {
    throw new Error(`production challenge was not blocked before acquisition: ${JSON.stringify(blocked)}`);
  }

  const capabilityPath = `${base}/api/v1/agents/${encodeURIComponent(agent.did)}/product-capabilities/${encodeURIComponent(CAPABILITY_ID)}`;
  const beforeAcquire = await expectStatus(await fetch(capabilityPath), 200);
  if (beforeAcquire.installation?.status !== "AVAILABLE" || beforeAcquire.certificate !== null) {
    throw new Error(`unexpected pre-acquisition state: ${JSON.stringify(beforeAcquire)}`);
  }

  const acquired = await expectStatus(await fetch(`${capabilityPath}/acquire`, { method: "POST" }), 200);
  if (acquired.installation?.status !== "INSTALLED") {
    throw new Error(`capability acquisition failed: ${JSON.stringify(acquired)}`);
  }

  // A structurally valid but wrong production result fails and creates no certificate.
  const failChallenge = await issue(base, agent, PRODUCTION_TRIAL_ID);
  const correctForFail = solve(failChallenge.challenge);
  const wrong: Trial1Result = {
    ...correctForFail,
    valid: !correctForFail.valid,
    reason_code: correctForFail.valid ? "SIGNATURE_INVALID" : "SIGNATURE_VALID",
  };
  const failed = await submit(base, failChallenge, envelope(agent, failChallenge, PRODUCTION_TRIAL_ID, wrong));
  if (failed.verdict !== "FAIL" || failed.receipt_id !== null || failed.certificate_id !== null) {
    throw new Error(`wrong production result did not FAIL cleanly: ${JSON.stringify(failed)}`);
  }
  const stillZero = await certificateState(base, agent.did);
  if (stillZero.certificate_count !== 0) {
    throw new Error(`FAIL created a production certificate: ${JSON.stringify(stillZero)}`);
  }

  // Fresh production challenge, correct installed-runtime-equivalent result, one certificate.
  const passChallenge = await issue(base, agent, PRODUCTION_TRIAL_ID);
  if (passChallenge.challenge.trial_id !== PRODUCTION_TRIAL_ID || passChallenge.challenge.capability_id !== CAPABILITY_ID) {
    throw new Error(`wrong production challenge metadata: ${JSON.stringify(passChallenge.challenge)}`);
  }
  const passed = await submit(base, passChallenge, envelope(agent, passChallenge, PRODUCTION_TRIAL_ID, solve(passChallenge.challenge)));
  if (passed.verdict !== "PASS" || !passed.receipt_id || !passed.certificate_id) {
    throw new Error(`production Capability 1 did not issue receipt + certificate: ${JSON.stringify(passed)}`);
  }

  const oneCertificate = await certificateState(base, agent.did);
  if (oneCertificate.certificate_count !== 1 || oneCertificate.certificates.length !== 1) {
    throw new Error(`production certificate count is not exactly one: ${JSON.stringify(oneCertificate)}`);
  }
  const certificate = oneCertificate.certificates[0];
  if (certificate.certificate_id !== passed.certificate_id || certificate.receipt_id !== passed.receipt_id) {
    throw new Error(`certificate does not bind PASS receipt: ${JSON.stringify(oneCertificate)}`);
  }

  const proof = await expectStatus(await fetch(`${base}/api/v1/certificates/${passed.certificate_id}`), 200);
  if (proof.certificate?.certificate_id !== passed.certificate_id || proof.receipt_verification?.signature_status !== "VALID") {
    throw new Error(`public certificate proof invalid: ${JSON.stringify(proof)}`);
  }
  if (!verifyReceipt(proof.receipt_verification.receipt, proof.receipt_verification.server_key)) {
    throw new Error("certificate receipt signature failed independent crypto verification");
  }

  process.stdout.write(JSON.stringify({
    productionCapability1: "PASS",
    agentDid: agent.did,
    historicalEvidence: "PASS_BUT_ZERO_CERTIFICATES",
    preAcquireVerification: "BLOCKED_CAPABILITY_NOT_INSTALLED",
    acquisition: "INSTALLED",
    deterministicWrongResult: "FAIL_WITHOUT_CERTIFICATE",
    deterministicCorrectResult: "PASS",
    certificateCount: 1,
    certificateId: passed.certificate_id,
    receiptId: passed.receipt_id,
    publicCertificateProof: "VALID",
    independentReceiptSignature: "VALID",
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`Production Capability 1 deployed acceptance failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
