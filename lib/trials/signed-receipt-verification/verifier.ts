import { verifyPassReceiptSignature, type SignedPassReceipt } from "../../receipts/receipt.js";
import { VERIFIER_ID, VERIFIER_VERSION } from "./constants.js";
import {
  trial4ChallengePayloadSchema,
  trial4HiddenVerifierContextSchema,
  trial4ResultSchema,
  type Trial4ChallengePayload,
  type Trial4HiddenVerifierContext,
  type Trial4Result,
} from "./schema.js";

export type Trial4VerificationReasonCode =
  | "EXPECTED_RESULT_MATCH"
  | "STATUS_MISMATCH"
  | "REASON_CODE_MISMATCH"
  | "KEY_ID_MISMATCH";

export interface Trial4VerificationResult {
  verdict: "PASS" | "FAIL";
  reason_code: Trial4VerificationReasonCode;
  verifier_id: typeof VERIFIER_ID;
  verifier_version: typeof VERIFIER_VERSION;
}

export class Trial4VerifierInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Trial4VerifierInputError";
  }
}

function evaluate(challenge: Trial4ChallengePayload): Trial4Result {
  const receipt = challenge.case.receipt as SignedPassReceipt;
  const declared = challenge.case.server_keys.find((key) => key.key_id === receipt.server_key_id);
  if (!declared) {
    return { status: "UNKNOWN", reason_code: "SERVER_KEY_NOT_FOUND", key_id: null };
  }

  if (verifyPassReceiptSignature(receipt, declared.public_key)) {
    return { status: "VALID", reason_code: "SIGNATURE_VALID", key_id: declared.key_id };
  }

  const actual = challenge.case.server_keys.find(
    (key) => key.key_id !== declared.key_id && verifyPassReceiptSignature(receipt, key.public_key),
  );
  if (actual) {
    return { status: "INVALID", reason_code: "KEY_ID_MISMATCH", key_id: actual.key_id };
  }

  return { status: "INVALID", reason_code: "SIGNATURE_INVALID", key_id: declared.key_id };
}

export function verifyTrial4Result(input: {
  publicPayload: Trial4ChallengePayload | unknown;
  hiddenContext: Trial4HiddenVerifierContext | unknown;
  result: Trial4Result | unknown;
}): Trial4VerificationResult {
  let challenge: Trial4ChallengePayload;
  let hidden: Trial4HiddenVerifierContext;
  let result: Trial4Result;
  try {
    challenge = trial4ChallengePayloadSchema.parse(input.publicPayload);
    hidden = trial4HiddenVerifierContextSchema.parse(input.hiddenContext);
    result = trial4ResultSchema.parse(input.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Trial4VerifierInputError(`persisted verifier input is invalid: ${message}`);
  }

  const expected = evaluate(challenge);
  if (
    hidden.expected_status !== expected.status ||
    hidden.expected_reason_code !== expected.reason_code ||
    hidden.expected_key_id !== expected.key_id
  ) {
    throw new Trial4VerifierInputError("persisted hidden verifier context disagrees with public challenge");
  }

  if (result.status !== expected.status) return verdict("FAIL", "STATUS_MISMATCH");
  if (result.reason_code !== expected.reason_code) return verdict("FAIL", "REASON_CODE_MISMATCH");
  if (result.key_id !== expected.key_id) return verdict("FAIL", "KEY_ID_MISMATCH");
  return verdict("PASS", "EXPECTED_RESULT_MATCH");
}

function verdict(value: "PASS" | "FAIL", reasonCode: Trial4VerificationReasonCode): Trial4VerificationResult {
  return {
    verdict: value,
    reason_code: reasonCode,
    verifier_id: VERIFIER_ID,
    verifier_version: VERIFIER_VERSION,
  };
}
