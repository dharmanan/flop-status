import { describe, expect, it } from "vitest";
import { simulateFailureRecovery } from "../../lib/trials/failure-recovery-idempotency/simulate.js";

const RETRY_POLICY = { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] as const };

describe("failure recovery & idempotency engine", () => {
  it("commits on the first successful attempt", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_1", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result).toEqual({
      reason_code: "RECOVERY_SUCCESS",
      result: {
        status: "COMMITTED",
        final_state: { balance: 125 },
        applied_count: 1,
        idempotency_key: "op_1",
        attempts: [{ attempt: 1, status: "APPLIED" }],
      },
    });
  });

  it("retries past a transient failure and then commits exactly once", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_2", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [
        { attempt: 1, outcome: "TRANSIENT_FAILURE" },
        { attempt: 2, outcome: "SUCCESS" },
      ],
      retry_policy: RETRY_POLICY,
    });
    expect(result.reason_code).toBe("RECOVERY_SUCCESS");
    expect(result.result?.status).toBe("COMMITTED");
    expect(result.result?.final_state).toEqual({ balance: 125 });
    expect(result.result?.applied_count).toBe(1);
    expect(result.result?.attempts).toEqual([
      { attempt: 1, status: "RETRYABLE_FAILURE" },
      { attempt: 2, status: "APPLIED" },
    ]);
  });

  it("absorbs a duplicate delivery after commit without mutating state twice — the core invariant", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_3", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [
        { attempt: 1, outcome: "SUCCESS" },
        { attempt: 2, outcome: "DUPLICATE_DELIVERY" },
        { attempt: 3, outcome: "DUPLICATE_DELIVERY" },
      ],
      retry_policy: RETRY_POLICY,
    });
    expect(result.reason_code).toBe("IDEMPOTENT_REPLAY");
    expect(result.result?.status).toBe("COMMITTED");
    expect(result.result?.final_state).toEqual({ balance: 125 });
    expect(result.result?.applied_count).toBe(1);
    expect(result.result?.attempts).toEqual([
      { attempt: 1, status: "APPLIED" },
      { attempt: 2, status: "DUPLICATE_REPLAY" },
      { attempt: 3, status: "DUPLICATE_REPLAY" },
    ]);
  });

  it("never reaches 150 or 175 across repeated duplicate deliveries of a +25 operation on balance 100", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_4", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [
        { attempt: 1, outcome: "TRANSIENT_FAILURE" },
        { attempt: 2, outcome: "SUCCESS" },
        { attempt: 3, outcome: "DUPLICATE_DELIVERY" },
      ],
      retry_policy: RETRY_POLICY,
    });
    expect(result.result?.final_state).toEqual({ balance: 125 });
    expect(result.result?.final_state).not.toEqual({ balance: 150 });
    expect(result.result?.final_state).not.toEqual({ balance: 175 });
  });

  it("stops with RETRY_LIMIT_EXCEEDED once the attempt plan exceeds max_attempts without a commit", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_5", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [
        { attempt: 1, outcome: "TRANSIENT_FAILURE" },
        { attempt: 2, outcome: "TRANSIENT_FAILURE" },
        { attempt: 3, outcome: "TRANSIENT_FAILURE" },
      ],
      retry_policy: { max_attempts: 2, retry_on: ["TRANSIENT_FAILURE"] },
    });
    expect(result.reason_code).toBe("RETRY_LIMIT_EXCEEDED");
    expect(result.result?.status).toBe("FAILED");
    expect(result.result?.applied_count).toBe(0);
    expect(result.result?.final_state).toEqual({ balance: 100 });
    expect(result.result?.attempts).toEqual([
      { attempt: 1, status: "RETRYABLE_FAILURE" },
      { attempt: 2, status: "RETRYABLE_FAILURE" },
    ]);
  });

  it("stops with RETRY_LIMIT_EXCEEDED when every allowed attempt is transient and none commits", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_5b", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [
        { attempt: 1, outcome: "TRANSIENT_FAILURE" },
        { attempt: 2, outcome: "TRANSIENT_FAILURE" },
      ],
      retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
    });
    expect(result.reason_code).toBe("RETRY_LIMIT_EXCEEDED");
    expect(result.result?.status).toBe("FAILED");
    expect(result.result?.applied_count).toBe(0);
  });

  it("stops immediately on a permanent failure and never commits", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_6", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [{ attempt: 1, outcome: "PERMANENT_FAILURE" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result).toEqual({
      reason_code: "PERMANENT_FAILURE",
      result: {
        status: "FAILED",
        final_state: { balance: 100 },
        applied_count: 0,
        idempotency_key: "op_6",
        attempts: [{ attempt: 1, status: "PERMANENT_FAILURE" }],
      },
    });
  });

  it("treats a transient failure outside the retry policy's retry_on as terminal", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_7", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [{ attempt: 1, outcome: "TRANSIENT_FAILURE" }],
      retry_policy: { max_attempts: 3, retry_on: ["PERMANENT_FAILURE"] },
    });
    expect(result.reason_code).toBe("PERMANENT_FAILURE");
    expect(result.result?.status).toBe("FAILED");
  });

  it("returns IDEMPOTENCY_VIOLATION for a duplicate delivery scripted before any commit", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_8", type: "increment", path: "balance", amount: 25 },
      initial_state: { balance: 100 },
      attempt_plan: [{ attempt: 1, outcome: "DUPLICATE_DELIVERY" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result).toEqual({ reason_code: "IDEMPOTENCY_VIOLATION", result: null });
  });

  it("applies a set operation, replacing the target path unconditionally", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_9", type: "set", path: "status", value: "active" },
      initial_state: { status: "pending" },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result.result?.final_state).toEqual({ status: "active" });
  });

  it("applies append_unique, adding a new item once and never duplicating on replay", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_10", type: "append_unique", path: "tags", value: "vip" },
      initial_state: { tags: ["new"] },
      attempt_plan: [
        { attempt: 1, outcome: "SUCCESS" },
        { attempt: 2, outcome: "DUPLICATE_DELIVERY" },
      ],
      retry_policy: RETRY_POLICY,
    });
    expect(result.result?.final_state).toEqual({ tags: ["new", "vip"] });
  });

  it("append_unique on a missing path starts from an empty array", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_11", type: "append_unique", path: "tags", value: "vip" },
      initial_state: {},
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result.result?.final_state).toEqual({ tags: ["vip"] });
  });

  it("increment on a missing path starts from 0", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_12", type: "increment", path: "counter", amount: 3 },
      initial_state: {},
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result.result?.final_state).toEqual({ counter: 3 });
  });

  it("returns IDEMPOTENCY_VIOLATION for increment against a non-numeric target", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_13", type: "increment", path: "balance", amount: 5 },
      initial_state: { balance: "not-a-number" },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result).toEqual({ reason_code: "IDEMPOTENCY_VIOLATION", result: null });
  });

  it("returns IDEMPOTENCY_VIOLATION for append_unique against a non-array target", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_14", type: "append_unique", path: "tags", value: "vip" },
      initial_state: { tags: "not-an-array" },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result).toEqual({ reason_code: "IDEMPOTENCY_VIOLATION", result: null });
  });

  it("returns IDEMPOTENCY_VIOLATION for an unsupported operation type", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_15", type: "delete", path: "balance" },
      initial_state: { balance: 100 },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result).toEqual({ reason_code: "IDEMPOTENCY_VIOLATION", result: null });
  });

  it("returns INVALID_ATTEMPT_PLAN for a malformed scenario shape", () => {
    expect(simulateFailureRecovery(null).reason_code).toBe("INVALID_ATTEMPT_PLAN");
    expect(
      simulateFailureRecovery({
        operation: { idempotency_key: "op_16", type: "increment", path: "balance", amount: 5 },
        initial_state: {},
        attempt_plan: [],
        retry_policy: RETRY_POLICY,
      }).reason_code,
    ).toBe("INVALID_ATTEMPT_PLAN");
  });

  it("returns INVALID_ATTEMPT_PLAN when attempt numbers are not sequential starting at 1", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_17", type: "increment", path: "balance", amount: 5 },
      initial_state: {},
      attempt_plan: [{ attempt: 2, outcome: "SUCCESS" }],
      retry_policy: RETRY_POLICY,
    });
    expect(result.reason_code).toBe("INVALID_ATTEMPT_PLAN");
  });

  it("returns INVALID_RETRY_POLICY for a malformed retry policy", () => {
    const result = simulateFailureRecovery({
      operation: { idempotency_key: "op_18", type: "increment", path: "balance", amount: 5 },
      initial_state: {},
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" }],
      retry_policy: { max_attempts: 0, retry_on: [] },
    });
    expect(result.reason_code).toBe("INVALID_RETRY_POLICY");
  });

  it("keeps two different idempotency keys as fully independent logical operations", () => {
    const scenarioA = {
      operation: { idempotency_key: "op_a", type: "increment" as const, path: "balance", amount: 10 },
      initial_state: { balance: 0 },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" as const }],
      retry_policy: RETRY_POLICY,
    };
    const scenarioB = {
      operation: { idempotency_key: "op_b", type: "increment" as const, path: "balance", amount: 20 },
      initial_state: { balance: 0 },
      attempt_plan: [{ attempt: 1, outcome: "SUCCESS" as const }],
      retry_policy: RETRY_POLICY,
    };
    expect(simulateFailureRecovery(scenarioA).result?.final_state).toEqual({ balance: 10 });
    expect(simulateFailureRecovery(scenarioB).result?.final_state).toEqual({ balance: 20 });
  });
});
