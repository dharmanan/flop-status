/**
 * Deterministic Failure Recovery & Idempotency engine (Capability 7).
 *
 * A bounded simulation of one logical operation, identified by an
 * idempotency key, delivered through a fixed attempt plan with a fixed
 * retry policy. No real time, no real network, no randomness — every
 * attempt outcome is scripted in the challenge itself so the whole run is
 * reproducible byte-for-byte by an independent verifier. No eval, no
 * Function constructor, no arbitrary code execution.
 */

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

export class RecoveryError extends Error {
  constructor(readonly reasonCode: "IDEMPOTENCY_VIOLATION", message: string) {
    super(message);
    this.name = "RecoveryError";
  }
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

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
  final_state: JsonValue;
  applied_count: number;
  idempotency_key: string;
  attempts: AttemptRecord[];
}

export interface RecoveryEvaluationResult {
  reason_code: RecoveryReasonCode;
  result: RecoveryResult | null;
}

const OUTCOMES = new Set<AttemptOutcome>(["SUCCESS", "TRANSIENT_FAILURE", "PERMANENT_FAILURE", "DUPLICATE_DELIVERY"]);
const PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function canonicalEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function splitPath(path: string): string[] | null {
  if (typeof path !== "string" || path.length === 0) return null;
  const segments = path.split(".");
  for (const segment of segments) {
    if (!PATH_SEGMENT_PATTERN.test(segment)) return null;
  }
  return segments;
}

function readPath(source: unknown, segments: string[]): { found: boolean; value: unknown } {
  let cursor: unknown = source;
  for (const segment of segments) {
    if (!isPlainObject(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return { found: false, value: undefined };
    }
    cursor = cursor[segment];
  }
  return { found: true, value: cursor };
}

/** Writes (creating or replacing) a value at a dot-path, on a fresh clone of the tree. */
function writePathReplace(root: unknown, segments: string[], value: unknown): JsonValue {
  const clone = isPlainObject(root) ? deepClone(root) : {};
  let cursor: Record<string, unknown> = clone as Record<string, unknown>;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    if (!isPlainObject(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]!] = deepClone(value) as JsonValue;
  return clone as JsonValue;
}

/**
 * Applies the operation exactly once against the current state.
 *
 * `increment` on a path that does not yet exist starts from 0; `append_unique`
 * on a path that does not yet exist starts from an empty array. Neither
 * behavior is disambiguated by the task spec — both are documented design
 * decisions chosen so a fresh idempotency key always has a well-defined
 * first application, mirroring how Capability 5's engine defines behavior
 * for every edge case the spec leaves open.
 */
function applyOperation(state: unknown, operation: RecoveryOperation, segments: string[]): JsonValue {
  if (operation.type === "set") {
    return writePathReplace(state, segments, operation.value ?? null);
  }
  if (operation.type === "increment") {
    if (typeof operation.amount !== "number" || !Number.isFinite(operation.amount)) {
      throw new RecoveryError("IDEMPOTENCY_VIOLATION", "increment requires a finite numeric amount");
    }
    const { found, value } = readPath(state, segments);
    const current = found ? value : 0;
    if (typeof current !== "number") {
      throw new RecoveryError("IDEMPOTENCY_VIOLATION", "increment target is not numeric");
    }
    return writePathReplace(state, segments, current + operation.amount);
  }
  if (operation.type !== "append_unique") {
    throw new RecoveryError("IDEMPOTENCY_VIOLATION", `unsupported operation type: ${String(operation.type)}`);
  }
  const { found, value } = readPath(state, segments);
  const current = found ? value : [];
  if (!Array.isArray(current)) {
    throw new RecoveryError("IDEMPOTENCY_VIOLATION", "append_unique target is not an array");
  }
  const exists = current.some((item) => canonicalEquals(item, operation.value));
  const next = exists ? current : [...current, deepClone(operation.value ?? null)];
  return writePathReplace(state, segments, next);
}

/**
 * `type` is intentionally checked only for "is a non-empty string", not
 * membership in `OPERATION_TYPES` — an unrecognized operation type must
 * surface as the runtime IDEMPOTENCY_VIOLATION thrown by `applyOperation`,
 * not as a structural INVALID_ATTEMPT_PLAN, mirroring how Capability 5 keeps
 * an unsupported `op.op` a data-dependent failure rather than a schema/shape
 * rejection.
 */
function isValidOperation(operation: unknown): operation is RecoveryOperation {
  if (!isPlainObject(operation)) return false;
  if (typeof operation.idempotency_key !== "string" || operation.idempotency_key.length === 0) return false;
  if (typeof operation.type !== "string" || operation.type.length === 0) return false;
  if (typeof operation.path !== "string" || splitPath(operation.path) === null) return false;
  return true;
}

function isValidAttemptPlan(plan: unknown): plan is AttemptPlanEntry[] {
  if (!Array.isArray(plan) || plan.length === 0) return false;
  return plan.every((entry, index) => {
    if (!isPlainObject(entry)) return false;
    if (entry.attempt !== index + 1) return false;
    return typeof entry.outcome === "string" && OUTCOMES.has(entry.outcome as AttemptOutcome);
  });
}

function isValidRetryPolicy(policy: unknown): policy is RetryPolicy {
  if (!isPlainObject(policy)) return false;
  if (!Number.isInteger(policy.max_attempts) || (policy.max_attempts as number) < 1) return false;
  if (!Array.isArray(policy.retry_on) || policy.retry_on.length === 0) return false;
  return policy.retry_on.every((item) => typeof item === "string" && OUTCOMES.has(item as AttemptOutcome));
}

/**
 * Runs the deterministic simulation described by `scenario`. Structural
 * problems abort with a null result, exactly like Capabilities 5 and 6:
 * a malformed operation or attempt plan is INVALID_ATTEMPT_PLAN, a
 * malformed retry policy is INVALID_RETRY_POLICY, and a scenario that could
 * only be applied unsafely (an unsupported operation branch, a duplicate
 * delivery scripted before any commit exists) is IDEMPOTENCY_VIOLATION.
 *
 * The `reason_code` distinguishes the two properties Capability 7 must
 * demonstrate: RECOVERY_SUCCESS means the operation committed via its own
 * successful attempt (possibly after retries); IDEMPOTENT_REPLAY means the
 * scenario's last processed attempt was itself a replay of an
 * already-committed operation, proving the replay was absorbed without a
 * second mutation.
 */
export function simulateFailureRecovery(scenario: unknown): RecoveryEvaluationResult {
  if (!isPlainObject(scenario) || !isValidOperation(scenario.operation) || !isValidAttemptPlan(scenario.attempt_plan)) {
    return { reason_code: "INVALID_ATTEMPT_PLAN", result: null };
  }
  if (!isValidRetryPolicy(scenario.retry_policy)) {
    return { reason_code: "INVALID_RETRY_POLICY", result: null };
  }

  const operation = scenario.operation;
  const attemptPlan = scenario.attempt_plan;
  const retryPolicy = scenario.retry_policy;
  const segments = splitPath(operation.path)!;

  let state: JsonValue = isPlainObject(scenario.initial_state) ? deepClone(scenario.initial_state as JsonValue) : ({} as JsonValue);
  let committed = false;
  let appliedCount = 0;
  let lastWasReplay = false;
  const attempts: AttemptRecord[] = [];
  let finalStatus: FinalStatus | null = null;
  let reasonCode: RecoveryReasonCode | null = null;

  for (const entry of attemptPlan) {
    if (entry.attempt > retryPolicy.max_attempts) {
      finalStatus = "FAILED";
      reasonCode = "RETRY_LIMIT_EXCEEDED";
      break;
    }

    if (entry.outcome === "SUCCESS") {
      if (committed) {
        attempts.push({ attempt: entry.attempt, status: "DUPLICATE_REPLAY" });
        lastWasReplay = true;
        continue;
      }
      try {
        state = applyOperation(state, operation, segments);
      } catch (error) {
        if (error instanceof RecoveryError) return { reason_code: error.reasonCode, result: null };
        throw error;
      }
      committed = true;
      appliedCount += 1;
      attempts.push({ attempt: entry.attempt, status: "APPLIED" });
      lastWasReplay = false;
      continue;
    }

    if (entry.outcome === "DUPLICATE_DELIVERY") {
      if (!committed) {
        return { reason_code: "IDEMPOTENCY_VIOLATION", result: null };
      }
      attempts.push({ attempt: entry.attempt, status: "DUPLICATE_REPLAY" });
      lastWasReplay = true;
      continue;
    }

    if (entry.outcome === "TRANSIENT_FAILURE") {
      if (!retryPolicy.retry_on.includes("TRANSIENT_FAILURE")) {
        attempts.push({ attempt: entry.attempt, status: "PERMANENT_FAILURE" });
        finalStatus = "FAILED";
        reasonCode = "PERMANENT_FAILURE";
        break;
      }
      attempts.push({ attempt: entry.attempt, status: "RETRYABLE_FAILURE" });
      continue;
    }

    // PERMANENT_FAILURE
    attempts.push({ attempt: entry.attempt, status: "PERMANENT_FAILURE" });
    finalStatus = "FAILED";
    reasonCode = "PERMANENT_FAILURE";
    break;
  }

  if (finalStatus === null || reasonCode === null) {
    finalStatus = committed ? "COMMITTED" : "FAILED";
    reasonCode = committed ? (lastWasReplay ? "IDEMPOTENT_REPLAY" : "RECOVERY_SUCCESS") : "RETRY_LIMIT_EXCEEDED";
  }

  return {
    reason_code: reasonCode,
    result: {
      status: finalStatus,
      final_state: state,
      applied_count: appliedCount,
      idempotency_key: operation.idempotency_key,
      attempts,
    },
  };
}
