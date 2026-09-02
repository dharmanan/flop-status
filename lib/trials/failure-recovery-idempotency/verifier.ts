import { canonicalizeJson } from "../../crypto/canonical-json.js";
import { simulateFailureRecovery } from "./simulate.js";
import { VERIFIER_ID, VERIFIER_VERSION } from "./constants.js";
import {
  trial7ChallengePayloadSchema,
  trial7HiddenVerifierContextSchema,
  trial7ResultSchema,
  type Trial7ChallengePayload,
  type Trial7HiddenVerifierContext,
  type Trial7Result,
} from "./schema.js";

export type Trial7VerificationReasonCode = "EXPECTED_RESULT_MATCH" | "FINAL_STATE_MISMATCH";

export interface Trial7VerificationResult {
  verdict: "PASS" | "FAIL";
  reason_code: Trial7VerificationReasonCode;
  verifier_id: typeof VERIFIER_ID;
  verifier_version: typeof VERIFIER_VERSION;
}

export class Trial7VerifierInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Trial7VerifierInputError";
  }
}

export interface VerifyTrial7Input {
  publicPayload: Trial7ChallengePayload | unknown;
  hiddenContext: Trial7HiddenVerifierContext | unknown;
  result: Trial7Result | unknown;
}

/**
 * FLOP recomputes the expected simulation independently — using its own copy
 * of the deterministic engine, not the persisted hidden context alone — then
 * requires that recomputation to agree with what was stored at
 * challenge-issuance time. Only then is the agent's submitted result
 * compared, checking final state, applied count, idempotency key and the
 * full attempt status sequence together (via canonical JSON equality).
 */
export function verifyTrial7Result(input: VerifyTrial7Input): Trial7VerificationResult {
  let challenge: Trial7ChallengePayload;
  let hidden: Trial7HiddenVerifierContext;
  let result: Trial7Result;

  try {
    challenge = trial7ChallengePayloadSchema.parse(input.publicPayload);
    hidden = trial7HiddenVerifierContextSchema.parse(input.hiddenContext);
    result = trial7ResultSchema.parse(input.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Trial7VerifierInputError(`persisted verifier input is invalid: ${message}`);
  }

  const recomputed = simulateFailureRecovery(challenge.case);

  if (
    hidden.expected_reason_code !== recomputed.reason_code ||
    canonicalizeJson(hidden.expected_result) !== canonicalizeJson(recomputed.result)
  ) {
    throw new Trial7VerifierInputError("persisted hidden verifier context disagrees with challenge case");
  }

  if (
    result.reason_code === recomputed.reason_code &&
    canonicalizeJson(result.result) === canonicalizeJson(recomputed.result)
  ) {
    return verdict("PASS", "EXPECTED_RESULT_MATCH");
  }
  return verdict("FAIL", "FINAL_STATE_MISMATCH");
}

function verdict(value: "PASS" | "FAIL", reasonCode: Trial7VerificationReasonCode): Trial7VerificationResult {
  return {
    verdict: value,
    reason_code: reasonCode,
    verifier_id: VERIFIER_ID,
    verifier_version: VERIFIER_VERSION,
  };
}
