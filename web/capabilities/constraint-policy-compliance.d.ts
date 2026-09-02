export declare const CAPABILITY_ID: string;
export declare const PRODUCTION_TRIAL_ID: string;
export declare const TRIAL_VERSION: string;

export type PolicyReasonCode = "POLICY_COMPLIANT" | "POLICY_VIOLATION" | "INVALID_POLICY" | "UNSUPPORTED_RULE";
export type ViolationReasonCode =
  | "REQUIRED_VALUE_MISSING"
  | "VALUE_MISMATCH"
  | "VALUE_NOT_ALLOWED"
  | "NUMBER_MIN_VIOLATION"
  | "NUMBER_MAX_VIOLATION"
  | "STRING_LENGTH_VIOLATION"
  | "ARRAY_SIZE_VIOLATION"
  | "PATH_EXISTENCE_VIOLATION";

export interface PolicyViolation {
  rule_id: string;
  reason: ViolationReasonCode;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: PolicyViolation[];
  evaluated_rules: string[];
}

export interface ConstraintPolicyComplianceInput {
  document: unknown;
  policy: unknown;
}

export interface ConstraintPolicyComplianceResult {
  reason_code: PolicyReasonCode;
  result: ComplianceResult | null;
}

export interface ConstraintPolicyCompliancePracticeFixture {
  input: ConstraintPolicyComplianceInput;
  expected: ConstraintPolicyComplianceResult;
}

export declare function evaluatePolicy(document: unknown, spec: unknown): ConstraintPolicyComplianceResult;
export declare function executeConstraintPolicyCompliance(
  input: ConstraintPolicyComplianceInput,
): Promise<ConstraintPolicyComplianceResult>;
export declare function createPracticeFixture(): ConstraintPolicyCompliancePracticeFixture;
export declare function evaluatePractice(
  result: ConstraintPolicyComplianceResult,
  fixture: ConstraintPolicyCompliancePracticeFixture,
): Promise<boolean>;
