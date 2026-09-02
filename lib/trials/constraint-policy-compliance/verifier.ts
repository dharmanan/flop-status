import { canonicalizeJson } from "../../crypto/canonical-json.js";
import { evaluatePolicy, type PolicySpec } from "./evaluate.js";
import { VERIFIER_ID, VERIFIER_VERSION } from "./constants.js";
import {
  trial6ChallengePayloadSchema,
  trial6HiddenVerifierContextSchema,
  trial6ResultSchema,
  type Trial6ChallengePayload,
  type Trial6HiddenVerifierContext,
  type Trial6Result,
} from "./schema.js";

export type Trial6VerificationReasonCode = "EXPECTED_RESULT_MATCH" | "COMPLIANCE_RESULT_MISMATCH";

export interface Trial6VerificationResult {
  verdict: "PASS" | "FAIL";
  reason_code: Trial6VerificationReasonCode;
  verifier_id: typeof VERIFIER_ID;
  verifier_version: typeof VERIFIER_VERSION;
}

export class Trial6VerifierInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Trial6VerifierInputError";
  }
}

export interface VerifyTrial6Input {
  publicPayload: Trial6ChallengePayload | unknown;
  hiddenContext: Trial6HiddenVerifierContext | unknown;
  result: Trial6Result | unknown;
}

/**
 * FLOP recomputes the expected policy evaluation independently — using its
 * own copy of the deterministic engine, not the persisted hidden context
 * alone — then requires that recomputation to agree with what was stored at
 * challenge-issuance time. Only then is the agent's submitted result
 * compared.
 */
export function verifyTrial6Result(input: VerifyTrial6Input): Trial6VerificationResult {
  let challenge: Trial6ChallengePayload;
  let hidden: Trial6HiddenVerifierContext;
  let result: Trial6Result;

  try {
    challenge = trial6ChallengePayloadSchema.parse(input.publicPayload);
    hidden = trial6HiddenVerifierContextSchema.parse(input.hiddenContext);
    result = trial6ResultSchema.parse(input.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Trial6VerifierInputError(`persisted verifier input is invalid: ${message}`);
  }

  const recomputed = evaluatePolicy(challenge.case.document, challenge.case.policy as PolicySpec);

  if (
    hidden.expected_reason_code !== recomputed.reason_code ||
    canonicalizeJson(hidden.expected_result) !== canonicalizeJson(recomputed.result)
  ) {
    throw new Trial6VerifierInputError("persisted hidden verifier context disagrees with challenge case");
  }

  if (
    result.reason_code === recomputed.reason_code &&
    canonicalizeJson(result.result) === canonicalizeJson(recomputed.result)
  ) {
    return verdict("PASS", "EXPECTED_RESULT_MATCH");
  }
  return verdict("FAIL", "COMPLIANCE_RESULT_MISMATCH");
}

function verdict(value: "PASS" | "FAIL", reasonCode: Trial6VerificationReasonCode): Trial6VerificationResult {
  return {
    verdict: value,
    reason_code: reasonCode,
    verifier_id: VERIFIER_ID,
    verifier_version: VERIFIER_VERSION,
  };
}
