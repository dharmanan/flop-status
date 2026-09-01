export declare const CAPABILITY_ID: string;
export declare const PRODUCTION_TRIAL_ID: string;
export declare const TRIAL_VERSION: string;

export interface CanonicalJsonSha256Input {
  document: unknown;
}

export interface CanonicalJsonSha256Result {
  canonical_json: string;
  sha256: string;
}

export interface CanonicalJsonSha256PracticeFixture {
  input: CanonicalJsonSha256Input;
  expected: CanonicalJsonSha256Result;
}

export declare function executeCanonicalJsonSha256(
  input: CanonicalJsonSha256Input,
): Promise<CanonicalJsonSha256Result>;
export declare function createPracticeFixture(): CanonicalJsonSha256PracticeFixture;
export declare function evaluatePractice(
  result: CanonicalJsonSha256Result,
  fixture: CanonicalJsonSha256PracticeFixture,
): Promise<boolean>;
