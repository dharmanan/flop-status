import { randomBytes as nodeRandomBytes } from "node:crypto";
import { encodeBase64Url } from "../../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { simulateFailureRecovery, type RecoveryScenario } from "./simulate.js";
import { CAPABILITY_ID, CHALLENGE_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";
import {
  trial7ChallengePayloadSchema,
  trial7HiddenVerifierContextSchema,
  type Trial7CaseClass,
  type Trial7ChallengePayload,
  type Trial7HiddenVerifierContext,
  type Trial7Id,
} from "./schema.js";

export type ClockFn = () => Date;
export type RandomBytesFn = (length: number) => Uint8Array;

export interface Trial7ChallengeGeneratorDependencies {
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface GenerateFailureRecoveryIdempotencyChallengeInput {
  agentDid: string;
  trialId?: Trial7Id;
  caseClass?: Trial7CaseClass;
}

export interface GenerateFailureRecoveryIdempotencyChallengeResult {
  publicPayload: Trial7ChallengePayload;
  hiddenContext: Trial7HiddenVerifierContext;
  challengeHash: string;
}

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_ID_ENTROPY_LENGTH = 16;
const NONCE_LENGTH = 16;

const defaultClock: ClockFn = () => new Date();
const defaultRandomBytes: RandomBytesFn = (length) => new Uint8Array(nodeRandomBytes(length));

const CASE_CLASSES: readonly Trial7CaseClass[] = [
  "SUCCESS_FIRST_ATTEMPT",
  "RECOVER_THEN_SUCCEED",
  "DUPLICATE_AFTER_SUCCESS",
  "RETRY_LIMIT_EXCEEDED",
  "PERMANENT_FAILURE",
];

function buildCase(caseClass: Trial7CaseClass, randomBytes: RandomBytesFn): { scenario: RecoveryScenario } {
  const idempotencyKey = `op_${Buffer.from(randomBytes(8)).toString("hex")}`;
  const initialBalance = 50 + (randomBytes(1)[0]! % 450);
  const amount = 5 + (randomBytes(1)[0]! % 95);
  const operation = { idempotency_key: idempotencyKey, type: "increment" as const, path: "balance", amount };
  const initialState = { balance: initialBalance };
  const standardRetryPolicy = { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE" as const] };

  if (caseClass === "SUCCESS_FIRST_ATTEMPT") {
    return {
      scenario: {
        operation,
        initial_state: initialState,
        attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
        retry_policy: standardRetryPolicy,
      },
    };
  }

  if (caseClass === "RECOVER_THEN_SUCCEED") {
    return {
      scenario: {
        operation,
        initial_state: initialState,
        attempt_plan: [
          { attempt: 1, outcome: "TRANSIENT_FAILURE" },
          { attempt: 2, outcome: "SUCCESS" },
        ],
        retry_policy: standardRetryPolicy,
      },
    };
  }

  if (caseClass === "DUPLICATE_AFTER_SUCCESS") {
    return {
      scenario: {
        operation,
        initial_state: initialState,
        attempt_plan: [
          { attempt: 1, outcome: "SUCCESS" },
          { attempt: 2, outcome: "DUPLICATE_DELIVERY" },
          { attempt: 3, outcome: "DUPLICATE_DELIVERY" },
        ],
        retry_policy: standardRetryPolicy,
      },
    };
  }

  if (caseClass === "RETRY_LIMIT_EXCEEDED") {
    return {
      scenario: {
        operation,
        initial_state: initialState,
        attempt_plan: [
          { attempt: 1, outcome: "TRANSIENT_FAILURE" },
          { attempt: 2, outcome: "TRANSIENT_FAILURE" },
          { attempt: 3, outcome: "TRANSIENT_FAILURE" },
        ],
        retry_policy: { max_attempts: 2, retry_on: ["TRANSIENT_FAILURE"] },
      },
    };
  }

  // PERMANENT_FAILURE
  return {
    scenario: {
      operation,
      initial_state: initialState,
      attempt_plan: [{ attempt: 1, outcome: "PERMANENT_FAILURE" }],
      retry_policy: standardRetryPolicy,
    },
  };
}

export function generateFailureRecoveryIdempotencyChallenge(
  input: GenerateFailureRecoveryIdempotencyChallengeInput,
  deps: Trial7ChallengeGeneratorDependencies = {},
): GenerateFailureRecoveryIdempotencyChallengeResult {
  const now = deps.now ?? defaultClock;
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;

  parseEd25519DidKey(input.agentDid);

  const caseClass = input.caseClass ?? CASE_CLASSES[randomBytes(1)[0]! % CASE_CLASSES.length]!;
  const { scenario } = buildCase(caseClass, randomBytes);
  const expected = simulateFailureRecovery(scenario);

  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

  const publicPayload = trial7ChallengePayloadSchema.parse({
    challenge_version: CHALLENGE_VERSION,
    challenge_id: formatUuidV4(randomBytes(CHALLENGE_ID_ENTROPY_LENGTH)),
    agent_did: input.agentDid,
    capability_id: CAPABILITY_ID,
    trial_id: input.trialId ?? TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(randomBytes(NONCE_LENGTH)),
    case: scenario,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  const hiddenContext = trial7HiddenVerifierContextSchema.parse({
    case_class: caseClass,
    expected_reason_code: expected.reason_code,
    expected_result: expected.result,
  });

  const challengeHash = sha256(canonicalizeJsonToBytes(publicPayload));
  return { publicPayload, hiddenContext, challengeHash };
}

function formatUuidV4(entropy: Uint8Array): string {
  const bytes = Uint8Array.from(entropy);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
