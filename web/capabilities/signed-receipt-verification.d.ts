export declare const CAPABILITY_ID: string;
export declare const PRODUCTION_TRIAL_ID: string;
export declare const TRIAL_VERSION: string;

export interface SignedReceiptServerKey {
  key_id: string;
  algorithm: "Ed25519";
  encoding: "base64url";
  public_key: string;
}

export interface SignedReceiptVerificationInput {
  receipt: Record<string, unknown>;
  server_keys: SignedReceiptServerKey[];
}

export interface SignedReceiptVerificationResult {
  status: "VALID" | "INVALID" | "UNKNOWN";
  reason_code: "SIGNATURE_VALID" | "SIGNATURE_INVALID" | "KEY_ID_MISMATCH" | "SERVER_KEY_NOT_FOUND";
  key_id: string | null;
}

export interface SignedReceiptVerificationPracticeFixture {
  input: SignedReceiptVerificationInput;
  expected: SignedReceiptVerificationResult;
}

export declare function executeSignedReceiptVerification(
  input: SignedReceiptVerificationInput,
): Promise<SignedReceiptVerificationResult>;
export declare function createPracticeFixture(): Promise<SignedReceiptVerificationPracticeFixture>;
export declare function evaluatePractice(
  result: SignedReceiptVerificationResult,
  fixture: SignedReceiptVerificationPracticeFixture,
): Promise<boolean>;
