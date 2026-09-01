export declare const CAPABILITY_ID: string;
export declare const CAPABILITY_VERSION: string;
export declare const MODULE_ID: string;
export declare const MODULE_VERSION: string;
export declare const PRODUCTION_TRIAL_ID: string;
export declare const TRIAL_VERSION: string;

export interface Ed25519SignatureVerificationInput {
  public_key: string;
  message: string;
  signature: string;
}

export interface Ed25519SignatureVerificationResult {
  valid: boolean;
  reason_code: "SIGNATURE_VALID" | "SIGNATURE_INVALID";
  message_hash: string;
}

export interface Ed25519SignatureVerificationPracticeFixture {
  input: Ed25519SignatureVerificationInput;
  expected_valid: boolean;
}

export declare function executeEd25519SignatureVerification(
  input: Ed25519SignatureVerificationInput,
): Promise<Ed25519SignatureVerificationResult>;
export declare function textMessageToBase64Url(text: string): string;
export declare function createPracticeFixture(): Promise<Ed25519SignatureVerificationPracticeFixture>;
export declare function evaluatePractice(
  result: Ed25519SignatureVerificationResult,
  fixture: Ed25519SignatureVerificationPracticeFixture,
): Promise<boolean>;
