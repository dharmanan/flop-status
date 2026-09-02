export declare const CAPABILITY_ID: string;
export declare const PRODUCTION_TRIAL_ID: string;
export declare const TRIAL_VERSION: string;

export type OperationType = "set" | "increment" | "append_unique";
export type AttemptOutcome = "SUCCESS" | "TRANSIENT_FAILURE" | "PERMANENT_FAILURE" | "DUPLICATE_DELIVERY";
export type AttemptStatus = "APPLIED" | "RETRYABLE_FAILURE" | "PERMANENT_FAILURE" | "DUPLICATE_REPLAY";
export type FinalStatus = "COMMITTED" | "FAILED";
export type RecoveryReasonCode =
  | "RECOVERY_SUCCESS"
  | "IDEMPOTENT_REPLAY"
  | "RETRY_LIMIT_EXCEEDED"
  | "PERMANENT_FAILURE"
  | "INVALID_ATTEMPT_PLAN"
  | "INVALID_RETRY_POLICY"
  | "IDEMPOTENCY_VIOLATION";

export interface RecoveryOperation {
  idempotency_key: string;
  type: OperationType;
  path: string;
  value?: unknown;
  amount?: number;
}

export interface AttemptPlanEntry {
  attempt: number;
  outcome: AttemptOutcome;
}

export interface RetryPolicy {
  max_attempts: number;
  retry_on: AttemptOutcome[];
}

export interface RecoveryScenario {
  operation: RecoveryOperation;
  initial_state: unknown;
  attempt_plan: AttemptPlanEntry[];
  retry_policy: RetryPolicy;
}

export interface AttemptRecord {
  attempt: number;
  status: AttemptStatus;
}

export interface RecoveryResult {
  status: FinalStatus;
  final_state: unknown;
  applied_count: number;
  idempotency_key: string;
  attempts: AttemptRecord[];
}

export interface RecoveryEvaluationResult {
  reason_code: RecoveryReasonCode;
  result: RecoveryResult | null;
}

export interface FailureRecoveryIdempotencyPracticeFixture {
  input: RecoveryScenario;
  expected: RecoveryEvaluationResult;
}

export declare function simulateFailureRecovery(scenario: unknown): RecoveryEvaluationResult;
export declare function executeFailureRecoveryIdempotency(input: RecoveryScenario): Promise<RecoveryEvaluationResult>;
export declare function createPracticeFixture(): FailureRecoveryIdempotencyPracticeFixture;
export declare function evaluatePractice(
  result: RecoveryEvaluationResult,
  fixture: FailureRecoveryIdempotencyPracticeFixture,
): Promise<boolean>;
