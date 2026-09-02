import { canonicalizeJson } from "../../crypto/canonical-json.js";
import { applyTransformation } from "./transform.js";
import { VERIFIER_ID, VERIFIER_VERSION } from "./constants.js";
import {
  trial5ChallengePayloadSchema,
  trial5HiddenVerifierContextSchema,
  trial5ResultSchema,
  type Trial5ChallengePayload,
  type Trial5HiddenVerifierContext,
  type Trial5Result,
} from "./schema.js";

export type Trial5VerificationReasonCode = "EXPECTED_RESULT_MATCH" | "TRANSFORMATION_MISMATCH";

export interface Trial5VerificationResult {
  verdict: "PASS" | "FAIL";
  reason_code: Trial5VerificationReasonCode;
  verifier_id: typeof VERIFIER_ID;
  verifier_version: typeof VERIFIER_VERSION;
}

export class Trial5VerifierInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Trial5VerifierInputError";
  }
}

export interface VerifyTrial5Input {
  publicPayload: Trial5ChallengePayload | unknown;
  hiddenContext: Trial5HiddenVerifierContext | unknown;
  result: Trial5Result | unknown;
}

/**
 * FLOP recomputes the expected transformation independently — using its own
 * copy of the deterministic engine, not the persisted hidden context alone —
 * then requires that recomputation to agree with what was stored at
 * challenge-issuance time. Only then is the agent's submitted result compared.
 */
export function verifyTrial5Result(input: VerifyTrial5Input): Trial5VerificationResult {
  let challenge: Trial5ChallengePayload;
  let hidden: Trial5HiddenVerifierContext;
  let result: Trial5Result;

  try {
    challenge = trial5ChallengePayloadSchema.parse(input.publicPayload);
    hidden = trial5HiddenVerifierContextSchema.parse(input.hiddenContext);
    result = trial5ResultSchema.parse(input.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Trial5VerifierInputError(`persisted verifier input is invalid: ${message}`);
  }

  const recomputed = applyTransformation(challenge.case.source, challenge.case.spec);

  if (
    hidden.expected_reason_code !== recomputed.reason_code ||
    canonicalizeJson(hidden.expected_result) !== canonicalizeJson(recomputed.result)
  ) {
    throw new Trial5VerifierInputError("persisted hidden verifier context disagrees with challenge case");
  }

  if (
    result.reason_code === recomputed.reason_code &&
    canonicalizeJson(result.result) === canonicalizeJson(recomputed.result)
  ) {
    return verdict("PASS", "EXPECTED_RESULT_MATCH");
  }
  return verdict("FAIL", "TRANSFORMATION_MISMATCH");
}

function verdict(value: "PASS" | "FAIL", reasonCode: Trial5VerificationReasonCode): Trial5VerificationResult {
  return {
    verdict: value,
    reason_code: reasonCode,
    verifier_id: VERIFIER_ID,
    verifier_version: VERIFIER_VERSION,
  };
}
