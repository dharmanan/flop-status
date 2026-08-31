import { canonicalizeJson } from "../../crypto/canonical-json.js";
import { sha256 } from "../../crypto/sha256.js";
import { VERIFIER_ID, VERIFIER_VERSION } from "./constants.js";
import {
  trial2ChallengePayloadSchema,
  trial2HiddenVerifierContextSchema,
  trial2ResultSchema,
  type Trial2ChallengePayload,
  type Trial2HiddenVerifierContext,
  type Trial2Result,
} from "./schema.js";

export type Trial2VerificationReasonCode =
  | "EXPECTED_RESULT_MATCH"
  | "CANONICAL_JSON_MISMATCH"
  | "SHA256_MISMATCH";

export interface Trial2VerificationResult {
  verdict: "PASS" | "FAIL";
  reason_code: Trial2VerificationReasonCode;
  verifier_id: typeof VERIFIER_ID;
  verifier_version: typeof VERIFIER_VERSION;
}

export class Trial2VerifierInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Trial2VerifierInputError";
  }
}

export interface VerifyTrial2Input {
  publicPayload: Trial2ChallengePayload | unknown;
  hiddenContext: Trial2HiddenVerifierContext | unknown;
  result: Trial2Result | unknown;
}

export function verifyTrial2Result(input: VerifyTrial2Input): Trial2VerificationResult {
  let challenge: Trial2ChallengePayload;
  let hidden: Trial2HiddenVerifierContext;
  let result: Trial2Result;

  try {
    challenge = trial2ChallengePayloadSchema.parse(input.publicPayload);
    hidden = trial2HiddenVerifierContextSchema.parse(input.hiddenContext);
    result = trial2ResultSchema.parse(input.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Trial2VerifierInputError(`persisted verifier input is invalid: ${message}`);
  }

  const expectedCanonicalJson = canonicalizeJson(challenge.case.document);
  const expectedSha256 = sha256(new TextEncoder().encode(expectedCanonicalJson));

  if (
    hidden.expected_canonical_json !== expectedCanonicalJson ||
    hidden.expected_sha256 !== expectedSha256
  ) {
    throw new Trial2VerifierInputError("persisted hidden verifier context disagrees with challenge case");
  }

  if (result.canonical_json !== expectedCanonicalJson) {
    return verdict("FAIL", "CANONICAL_JSON_MISMATCH");
  }

  if (result.sha256 !== expectedSha256) {
    return verdict("FAIL", "SHA256_MISMATCH");
  }

  return verdict("PASS", "EXPECTED_RESULT_MATCH");
}

function verdict(
  value: "PASS" | "FAIL",
  reasonCode: Trial2VerificationReasonCode,
): Trial2VerificationResult {
  return {
    verdict: value,
    reason_code: reasonCode,
    verifier_id: VERIFIER_ID,
    verifier_version: VERIFIER_VERSION,
  };
}
