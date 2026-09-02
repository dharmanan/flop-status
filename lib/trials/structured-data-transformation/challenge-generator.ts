import { randomBytes as nodeRandomBytes } from "node:crypto";
import { encodeBase64Url } from "../../crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { parseEd25519DidKey } from "../../identity/did-key.js";
import { applyTransformation, type TransformSpec } from "./transform.js";
import { CAPABILITY_ID, CHALLENGE_VERSION, TRIAL_ID, TRIAL_VERSION } from "./constants.js";
import {
  trial5ChallengePayloadSchema,
  trial5HiddenVerifierContextSchema,
  type Trial5CaseClass,
  type Trial5ChallengePayload,
  type Trial5HiddenVerifierContext,
  type Trial5Id,
} from "./schema.js";

export type ClockFn = () => Date;
export type RandomBytesFn = (length: number) => Uint8Array;

export interface Trial5ChallengeGeneratorDependencies {
  now?: ClockFn;
  randomBytes?: RandomBytesFn;
}

export interface GenerateStructuredDataTransformationChallengeInput {
  agentDid: string;
  trialId?: Trial5Id;
  caseClass?: Trial5CaseClass;
}

export interface GenerateStructuredDataTransformationChallengeResult {
  publicPayload: Trial5ChallengePayload;
  hiddenContext: Trial5HiddenVerifierContext;
  challengeHash: string;
}

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_ID_ENTROPY_LENGTH = 16;
const NONCE_LENGTH = 16;

const defaultClock: ClockFn = () => new Date();
const defaultRandomBytes: RandomBytesFn = (length) => new Uint8Array(nodeRandomBytes(length));

const CASE_CLASSES: readonly Trial5CaseClass[] = [
  "VALID",
  "SOURCE_PATH_MISSING",
  "INVALID_TYPE_COERCION",
  "UNSUPPORTED_OPERATION",
  "TARGET_PATH_CONFLICT",
];

const COUNTRIES = ["TR", "DE", "US", "FR"];
const SKUS = ["A12", "B07", "C99", "D41"];

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

function buildSourceDocument(randomBytes: RandomBytesFn): { source: unknown; skuA: string; skuB: string } {
  const skuA = pick(SKUS, randomBytes);
  const skuB = pick(SKUS.filter((sku) => sku !== skuA), randomBytes);
  return {
    source: {
      customer: {
        name: `Customer-${Buffer.from(randomBytes(3)).toString("hex")}`,
        country: pick(COUNTRIES, randomBytes),
        vip: (randomBytes(1)[0]! % 2) === 0,
      },
      items: [
        { sku: skuA, qty: String(1 + (randomBytes(1)[0]! % 5)), price: 100 + (randomBytes(1)[0]! % 900) / 10 },
        { sku: skuB, qty: String(1 + (randomBytes(1)[0]! % 5)), price: 50 + (randomBytes(1)[0]! % 500) / 10 },
      ],
      internal_note: "do not export",
    },
    skuA,
    skuB,
  };
}

function buildCase(caseClass: Trial5CaseClass, randomBytes: RandomBytesFn): { source: unknown; spec: TransformSpec } {
  const { source } = buildSourceDocument(randomBytes);

  if (caseClass === "VALID") {
    return {
      source,
      spec: {
        version: "1",
        operations: [
          { op: "rename", from: "customer.name", to: "buyer.full_name" },
          { op: "copy", from: "customer.country", to: "buyer.country" },
          { op: "set", to: "buyer.channel", value: "online" },
          {
            op: "map_array",
            from: "items",
            to: "lines",
            fields: {
              sku: { from: "sku", type: "string" },
              quantity: { from: "qty", type: "integer" },
              unit_price: { from: "price", type: "number" },
            },
          },
        ],
      },
    };
  }

  if (caseClass === "SOURCE_PATH_MISSING") {
    return {
      source,
      spec: {
        version: "1",
        operations: [
          { op: "copy", from: "customer.email", to: "buyer.email" },
        ],
      },
    };
  }

  if (caseClass === "INVALID_TYPE_COERCION") {
    return {
      source,
      spec: {
        version: "1",
        operations: [
          {
            op: "map_array",
            from: "items",
            to: "lines",
            fields: {
              sku: { from: "sku", type: "integer" },
            },
          },
        ],
      },
    };
  }

  if (caseClass === "UNSUPPORTED_OPERATION") {
    return {
      source,
      spec: {
        version: "1",
        operations: [
          { op: "eval", from: "customer.name", to: "buyer.full_name" },
        ],
      },
    };
  }

  // TARGET_PATH_CONFLICT
  return {
    source,
    spec: {
      version: "1",
      operations: [
        { op: "copy", from: "customer.name", to: "buyer.name" },
        { op: "copy", from: "customer.country", to: "buyer.name" },
      ],
    },
  };
}

export function generateStructuredDataTransformationChallenge(
  input: GenerateStructuredDataTransformationChallengeInput,
  deps: Trial5ChallengeGeneratorDependencies = {},
): GenerateStructuredDataTransformationChallengeResult {
  const now = deps.now ?? defaultClock;
  const randomBytes = deps.randomBytes ?? defaultRandomBytes;

  parseEd25519DidKey(input.agentDid);

  const caseClass = input.caseClass ?? CASE_CLASSES[randomBytes(1)[0]! % CASE_CLASSES.length]!;
  const { source, spec } = buildCase(caseClass, randomBytes);
  const expected = applyTransformation(source, spec);

  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

  const publicPayload = trial5ChallengePayloadSchema.parse({
    challenge_version: CHALLENGE_VERSION,
    challenge_id: formatUuidV4(randomBytes(CHALLENGE_ID_ENTROPY_LENGTH)),
    agent_did: input.agentDid,
    capability_id: CAPABILITY_ID,
    trial_id: input.trialId ?? TRIAL_ID,
    trial_version: TRIAL_VERSION,
    nonce: encodeBase64Url(randomBytes(NONCE_LENGTH)),
    case: { source, spec },
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  const hiddenContext = trial5HiddenVerifierContextSchema.parse({
    case_class: caseClass,
    expected_reason_code: expected.reason_code,
    expected_result: expected.result,
  });

  const challengeHash = sha256(canonicalizeJsonToBytes(publicPayload));
  return { publicPayload, hiddenContext, challengeHash };
}
