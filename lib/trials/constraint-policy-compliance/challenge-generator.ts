import { randomBytes as nodeRandomBytes } from "node:crypto";
import { encodeBase64Url } from "../../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { evaluatePolicy, type PolicySpec } from "./evaluate.js";
import { CAPABILITY_ID, CHALLENGE_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";
import {
  trial6ChallengePayloadSchema,
  trial6HiddenVerifierContextSchema,
  type Trial6CaseClass,
  type Trial6ChallengePayload,
  type Trial6HiddenVerifierContext,
  type Trial6Id,
} from "./schema.js";

export type ClockFn = () => Date;
export type RandomBytesFn = (length: number) => Uint8Array;

export interface Trial6ChallengeGeneratorDependencies {
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface GenerateConstraintPolicyComplianceChallengeInput {
  agentDid: string;
  trialId?: Trial6Id;
  caseClass?: Trial6CaseClass;
}

export interface GenerateConstraintPolicyComplianceChallengeResult {
  publicPayload: Trial6ChallengePayload;
  hiddenContext: Trial6HiddenVerifierContext;
  challengeHash: string;
}

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_ID_ENTROPY_LENGTH = 16;
const NONCE_LENGTH = 16;

const defaultClock: ClockFn = () => new Date();
const defaultRandomBytes: RandomBytesFn = (length) => new Uint8Array(nodeRandomBytes(length));

const CASE_CLASSES: readonly Trial6CaseClass[] = [
  "COMPLIANT",
  "SINGLE_VIOLATION",
  "MULTIPLE_VIOLATIONS",
  "UNSUPPORTED_RULE",
  "INVALID_POLICY",
];

const COUNTRIES = ["TR", "DE", "US", "FR"];
const CUSTOMER_TYPES = ["individual", "business"];

function formatUuidV4(entropy: Uint8Array): string {
  const bytes = Uint8Array.from(entropy);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function pick<T>(values: readonly T[], randomBytes: RandomBytesFn): T {
  return values[randomBytes(1)[0]! % values.length]!;
}

const BASE_POLICY: PolicySpec = {
  version: "1",
  rules: [
    { id: "currency_by_country", type: "equals", path: "order.currency", value: "TRY" },
    { id: "amount_limit", type: "number_max", path: "order.amount", value: 5000 },
    { id: "customer_type", type: "one_of", path: "order.customer_type", values: ["individual", "business"] },
    { id: "required_country", type: "required", path: "order.country" },
  ],
};

function buildCase(caseClass: Trial6CaseClass, randomBytes: RandomBytesFn): { document: unknown; policy: unknown } {
  const country = pick(COUNTRIES, randomBytes);

  if (caseClass === "COMPLIANT") {
    return {
      document: {
        order: {
          country,
          currency: "TRY",
          amount: 100 + (randomBytes(1)[0]! % 4900),
          customer_type: pick(CUSTOMER_TYPES, randomBytes),
          priority: "standard",
        },
      },
      policy: BASE_POLICY,
    };
  }

  if (caseClass === "SINGLE_VIOLATION") {
    return {
      document: {
        order: {
          country,
          currency: "TRY",
          amount: 5001 + (randomBytes(1)[0]! % 4000),
          customer_type: pick(CUSTOMER_TYPES, randomBytes),
          priority: "standard",
        },
      },
      policy: BASE_POLICY,
    };
  }

  if (caseClass === "MULTIPLE_VIOLATIONS") {
    return {
      document: {
        order: {
          country,
          currency: "USD",
          amount: 5001 + (randomBytes(1)[0]! % 4000),
          customer_type: "vip",
          priority: "standard",
        },
      },
      policy: BASE_POLICY,
    };
  }

  if (caseClass === "UNSUPPORTED_RULE") {
    return {
      document: { order: { country, currency: "TRY", amount: 100, customer_type: "individual", priority: "standard" } },
      policy: {
        version: "1",
        rules: [...BASE_POLICY.rules, { id: "bogus_rule", type: "matches_regex", path: "order.country", value: ".*" }],
      },
    };
  }

  // INVALID_POLICY: a schema-valid rule (values/value are both optional at the
  // schema level) that is nonetheless structurally incomplete for its own
  // rule type — number_min without the numeric `value` it requires.
  return {
    document: { order: { country, currency: "TRY", amount: 100, customer_type: "individual", priority: "standard" } },
    policy: {
      version: "1",
      rules: [{ id: "amount_limit", type: "number_min", path: "order.amount" }],
    },
  };
}

export function generateConstraintPolicyComplianceChallenge(
  input: GenerateConstraintPolicyComplianceChallengeInput,
  deps: Trial6ChallengeGeneratorDependencies = {},
): GenerateConstraintPolicyComplianceChallengeResult {
  const now = deps.now ?? defaultClock;
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;

  parseEd25519DidKey(input.agentDid);

  const caseClass = input.caseClass ?? CASE_CLASSES[randomBytes(1)[0]! % CASE_CLASSES.length]!;
  const { document, policy } = buildCase(caseClass, randomBytes);
  const expected = evaluatePolicy(document, policy as PolicySpec);

  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

  const publicPayload = trial6ChallengePayloadSchema.parse({
    challenge_version: CHALLENGE_VERSION,
    challenge_id: formatUuidV4(randomBytes(CHALLENGE_ID_ENTROPY_LENGTH)),
    agent_did: input.agentDid,
    capability_id: CAPABILITY_ID,
    trial_id: input.trialId ?? TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(randomBytes(NONCE_LENGTH)),
    case: { document, policy },
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  const hiddenContext = trial6HiddenVerifierContextSchema.parse({
    case_class: caseClass,
    expected_reason_code: expected.reason_code,
    expected_result: expected.result,
  });

  const challengeHash = sha256(canonicalizeJsonToBytes(publicPayload));
  return { publicPayload, hiddenContext, challengeHash };
}
