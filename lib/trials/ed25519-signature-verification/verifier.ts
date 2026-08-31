import { decodeBase64Url } from "../../crypto/base64url.js";
import { verifyEd25519Signature } from "../../crypto/ed25519.js";
import { sha256 } from "../../crypto/sha256.js";
import { VERIFIER_ID, VERIFIER_VERSION } from "./constants.js";
import {
  trial1ChallengePayloadSchema,
  trial1HiddenVerifierContextSchema,
  trial1ResultSchema,
  type Trial1ChallengePayload,
  type Trial1HiddenVerifierContext,
  type Trial1Result,
} from "./schema.js";

export type Trial1VerificationReasonCode =
  | "EXPECTED_RESULT_MATCH"
  | "RESULT_VALIDITY_MISMATCH"
  | "REASON_CODE_MISMATCH"
  | "MESSAGE_HASH_MISMATCH";

export interface Trial1VerificationResult {
  verdict: "PASS" | "FAIL";
  reason_code: Trial1VerificationReasonCode;
  verifier_id: typeof VERIFIER_ID;
  verifier_version: typeof VERIFIER_VERSION;
}

export class Trial1VerifierInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Trial1VerifierInputError";
  }
}

export interface VerifyTrial1Input {
  publicPayload: Trial1ChallengePayload | unknown;
  hiddenContext: Trial1HiddenVerifierContext | unknown;
  result: Trial1Result | unknown;
}

export function verifyTrial1Result(input: VerifyTrial1Input): Trial1VerificationResult {
  let challenge: Trial1ChallengePayload;
  let hidden: Trial1HiddenVerifierContext;
  let result: Trial1Result;
  try {
    challenge = trial1ChallengePayloadSchema.parse(input.publicPayload);
    hidden = trial1HiddenVerifierContextSchema.parse(input.hiddenContext);
    result = trial1ResultSchema.parse(input.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Trial1VerifierInputError(`persisted verifier input is invalid: ${message}`);
  }

  const publicKey = decodeBase64Url(challenge.case.public_key);
  const message = decodeBase64Url(challenge.case.message);
  const signature = decodeBase64Url(challenge.case.signature);
  const actualSignatureValidity = verifyEd25519Signature(publicKey, message, signature);
  const expectedClass = hidden.expected_valid ? "VALID_SIGNATURE" : "INVALID_SIGNATURE";

  if (actualSignatureValidity !== hidden.expected_valid || hidden.case_class !== expectedClass) {
    throw new Trial1VerifierInputError("persisted hidden verifier context disagrees with challenge case");
  }

  if (result.valid !== hidden.expected_valid) {
    return verdict("FAIL", "RESULT_VALIDITY_MISMATCH");
  }

  const expectedReasonCode = result.valid ? "SIGNATURE_VALID" : "SIGNATURE_INVALID";
  if (result.reason_code !== expectedReasonCode) {
    return verdict("FAIL", "REASON_CODE_MISMATCH");
  }

  if (result.message_hash !== sha256(message)) {
    return verdict("FAIL", "MESSAGE_HASH_MISMATCH");
  }

  return verdict("PASS", "EXPECTED_RESULT_MATCH");
}

function verdict(
  value: "PASS" | "FAIL",
  reasonCode: Trial1VerificationReasonCode,
): Trial1VerificationResult {
  return {
    verdict: value,
    reason_code: reasonCode,
    verifier_id: VERIFIER_ID,
    verifier_version: VERIFIER_VERSION,
  };
}
