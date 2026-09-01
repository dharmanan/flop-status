export declare const CAPABILITY_ID: string;
export declare const PRODUCTION_TRIAL_ID: string;
export declare const TRIAL_VERSION: string;

export interface TechnocoreCanonicalMessageInput {
  room: string;
  nonce: string;
  text: string;
}

export interface TechnocoreCanonicalMessageResult {
  cleaned_text: string;
  canonical_message: string;
}

export interface TechnocoreCanonicalMessagePracticeFixture {
  input: TechnocoreCanonicalMessageInput;
  expected: TechnocoreCanonicalMessageResult;
}

export declare function executeTechnocoreCanonicalMessage(
  input: TechnocoreCanonicalMessageInput,
): Promise<TechnocoreCanonicalMessageResult>;
export declare function createPracticeFixture(): TechnocoreCanonicalMessagePracticeFixture;
export declare function evaluatePractice(
  result: TechnocoreCanonicalMessageResult,
  fixture: TechnocoreCanonicalMessagePracticeFixture,
): Promise<boolean>;
