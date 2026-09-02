export const CAPABILITY_ID = "runtime.failure-recovery-idempotency";
export const PRODUCTION_TRIAL_ID = "failure-recovery-idempotency-certification";
export const TRIAL_VERSION = "1";

/**
 * Deterministic Failure Recovery & Idempotency engine (Capability 7).
 *
 * Mirrors lib/trials/failure-recovery-idempotency/simulate.ts exactly — same
 * bounded operation language (set, increment, append_unique), same attempt
 * outcomes, same reason codes. No eval, no Function constructor, no real
 * time or network. Verified against the server engine in
 * tests/browser/capability-modules.test.ts.
 */

const OUTCOMES = new Set(["SUCCESS", "TRANSIENT_FAILURE", "PERMANENT_FAILURE", "DUPLICATE_DELIVERY"]);
const PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

class RecoveryError extends Error {
  constructor(reasonCode, message) {
    super(message);
    this.name = "RecoveryError";
    this.reasonCode = reasonCode;
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function canonicalEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function splitPath(path) {
  if (typeof path !== "string" || path.length === 0) return null;
  const segments = path.split(".");
  for (const segment of segments) {
    if (!PATH_SEGMENT_PATTERN.test(segment)) return null;
  }
  return segments;
}

function readPath(source, segments) {
  let cursor = source;
  for (const segment of segments) {
    if (!isPlainObject(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return { found: false, value: undefined };
    }
    cursor = cursor[segment];
  }
  return { found: true, value: cursor };
}

function writePathReplace(root, segments, value) {
  const clone = isPlainObject(root) ? deepClone(root) : {};
  let cursor = clone;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!isPlainObject(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = deepClone(value);
  return clone;
}

function applyOperation(state, operation, segments) {
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

function isValidOperation(operation) {
  if (!isPlainObject(operation)) return false;
  if (typeof operation.idempotency_key !== "string" || operation.idempotency_key.length === 0) return false;
  if (typeof operation.type !== "string" || operation.type.length === 0) return false;
  if (typeof operation.path !== "string" || splitPath(operation.path) === null) return false;
  return true;
}

function isValidAttemptPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return false;
  return plan.every((entry, index) => {
    if (!isPlainObject(entry)) return false;
    if (entry.attempt !== index + 1) return false;
    return typeof entry.outcome === "string" && OUTCOMES.has(entry.outcome);
  });
}

function isValidRetryPolicy(policy) {
  if (!isPlainObject(policy)) return false;
  if (!Number.isInteger(policy.max_attempts) || policy.max_attempts < 1) return false;
  if (!Array.isArray(policy.retry_on) || policy.retry_on.length === 0) return false;
  return policy.retry_on.every((item) => typeof item === "string" && OUTCOMES.has(item));
}

export function simulateFailureRecovery(scenario) {
  if (!isPlainObject(scenario) || !isValidOperation(scenario.operation) || !isValidAttemptPlan(scenario.attempt_plan)) {
    return { reason_code: "INVALID_ATTEMPT_PLAN", result: null };
  }
  if (!isValidRetryPolicy(scenario.retry_policy)) {
    return { reason_code: "INVALID_RETRY_POLICY", result: null };
  }

  const { operation, attempt_plan: attemptPlan, retry_policy: retryPolicy } = scenario;
  const segments = splitPath(operation.path);

  let state = isPlainObject(scenario.initial_state) ? deepClone(scenario.initial_state) : {};
  let committed = false;
  let appliedCount = 0;
  let lastWasReplay = false;
  const attempts = [];
  let finalStatus = null;
  let reasonCode = null;

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

/** The single executor used by practice, certification and normal FLOP use. */
export async function executeFailureRecoveryIdempotency(input) {
  return simulateFailureRecovery(input);
}

export function createPracticeFixture() {
  const input = {
    operation: { idempotency_key: "op_practice_1", type: "increment", path: "balance", amount: 25 },
    initial_state: { balance: 100 },
    attempt_plan: [
      { attempt: 1, outcome: "TRANSIENT_FAILURE" },
      { attempt: 2, outcome: "SUCCESS" },
      { attempt: 3, outcome: "DUPLICATE_DELIVERY" },
    ],
    retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
  };
  return {
    input,
    expected: {
      reason_code: "IDEMPOTENT_REPLAY",
      result: {
        status: "COMMITTED",
        final_state: { balance: 125 },
        applied_count: 1,
        idempotency_key: "op_practice_1",
        attempts: [
          { attempt: 1, status: "RETRYABLE_FAILURE" },
          { attempt: 2, status: "APPLIED" },
          { attempt: 3, status: "DUPLICATE_REPLAY" },
        ],
      },
    },
  };
}

export async function evaluatePractice(result, fixture) {
  return (
    result.reason_code === fixture.expected.reason_code &&
    JSON.stringify(result.result) === JSON.stringify(fixture.expected.result)
  );
}
