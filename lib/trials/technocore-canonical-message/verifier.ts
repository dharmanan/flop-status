import { VERIFIER_ID, VERIFIER_VERSION } from "./constants.js";
import { buildCanonicalTechnocoreMessage } from "./protocol.js";
import {
  trial3ChallengePayloadSchema,
  trial3HiddenVerifierContextSchema,
  trial3ResultSchema,
  type Trial3ChallengePayload,
  type Trial3HiddenVerifierContext,
  type Trial3Result,
} from "./schema.js";

export type Trial3VerificationReasonCode =
  | "EXPECTED_RESULT_MATCH"
  | "CLEANED_TEXT_MISMATCH"
  | "CANONICAL_MESSAGE_MISMATCH";

export interface Trial3VerificationResult {
  verdict: "PASS" | "FAIL";
  reason_code: Trial3VerificationReasonCode;
  verifier_id: typeof VERIFIER_ID;
  verifier_version: typeof VERIFIER_VERSION;
}

export class Trial3VerifierInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Trial3VerifierInputError";
  }
}

export function verifyTrial3Result(input: {
  publicPayload: Trial3ChallengePayload | unknown;
  hiddenContext: Trial3HiddenVerifierContext | unknown;
  result: Trial3Result | unknown;
}): Trial3VerificationResult {
  let challenge: Trial3ChallengePayload;
  let hidden: Trial3HiddenVerifierContext;
  let result: Trial3Result;
  try {
    challenge = trial3ChallengePayloadSchema.parse(input.publicPayload);
    hidden = trial3HiddenVerifierContextSchema.parse(input.hiddenContext);
    result = trial3ResultSchema.parse(input.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Trial3VerifierInputError(`persisted verifier input is invalid: ${message}`);
  }

  const recomputed = buildCanonicalTechnocoreMessage(
    challenge.case.room,
    challenge.case.nonce,
    challenge.case.text,
  );

  if (
    hidden.expected_cleaned_text !== recomputed.cleanedText ||
    hidden.expected_canonical_message !== recomputed.canonicalMessage
  ) {
    throw new Trial3VerifierInputError("persisted hidden verifier context disagrees with public challenge");
  }

  if (result.cleaned_text !== recomputed.cleanedText) {
    return verdict("FAIL", "CLEANED_TEXT_MISMATCH");
  }
  if (result.canonical_message !== recomputed.canonicalMessage) {
    return verdict("FAIL", "CANONICAL_MESSAGE_MISMATCH");
  }
  return verdict("PASS", "EXPECTED_RESULT_MATCH");
}

function verdict(
  value: "PASS" | "FAIL",
  reasonCode: Trial3VerificationReasonCode,
): Trial3VerificationResult {
  return {
    verdict: value,
    reason_code: reasonCode,
    verifier_id: VERIFIER_ID,
    verifier_version: VERIFIER_VERSION,
  };
}
