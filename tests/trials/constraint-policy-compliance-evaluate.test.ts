import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../../lib/trials/constraint-policy-compliance/evaluate.js";

const DOCUMENT = {
  order: { country: "TR", currency: "TRY", amount: 1250, customer_type: "business", priority: "standard", tags: ["a", "b"] },
};

describe("constraint & policy compliance engine", () => {
  it("reports full compliance and every evaluated rule id when no rule is violated", () => {
    const result = evaluatePolicy(DOCUMENT, {
      version: "1",
      rules: [
        { id: "currency_by_country", type: "equals", path: "order.currency", value: "TRY" },
        { id: "amount_limit", type: "number_max", path: "order.amount", value: 5000 },
        { id: "customer_type", type: "one_of", path: "order.customer_type", values: ["individual", "business"] },
        { id: "required_country", type: "required", path: "order.country" },
      ],
    });
    expect(result).toEqual({
      reason_code: "POLICY_COMPLIANT",
      result: {
        compliant: true,
        violations: [],
        evaluated_rules: ["currency_by_country", "amount_limit", "customer_type", "required_country"],
      },
    });
  });

  it("required: fails on a missing path and on an explicit null value", () => {
    const missing = evaluatePolicy({}, { version: "1", rules: [{ id: "r", type: "required", path: "order.country" }] });
    expect(missing.result?.violations).toEqual([{ rule_id: "r", reason: "REQUIRED_VALUE_MISSING" }]);

    const explicitNull = evaluatePolicy(
      { order: { country: null } },
      { version: "1", rules: [{ id: "r", type: "required", path: "order.country" }] },
    );
    expect(explicitNull.result?.violations).toEqual([{ rule_id: "r", reason: "REQUIRED_VALUE_MISSING" }]);
  });

  it("exists / not_exists: pure path presence, explicit null still counts as present", () => {
    const existsMissing = evaluatePolicy({}, { version: "1", rules: [{ id: "r", type: "exists", path: "a.b" }] });
    expect(existsMissing.result?.violations).toEqual([{ rule_id: "r", reason: "PATH_EXISTENCE_VIOLATION" }]);

    const existsPresentNull = evaluatePolicy({ a: { b: null } }, { version: "1", rules: [{ id: "r", type: "exists", path: "a.b" }] });
    expect(existsPresentNull.result?.violations).toEqual([]);

    const notExistsPresent = evaluatePolicy({ a: { b: 1 } }, { version: "1", rules: [{ id: "r", type: "not_exists", path: "a.b" }] });
    expect(notExistsPresent.result?.violations).toEqual([{ rule_id: "r", reason: "PATH_EXISTENCE_VIOLATION" }]);

    const notExistsMissing = evaluatePolicy({}, { version: "1", rules: [{ id: "r", type: "not_exists", path: "a.b" }] });
    expect(notExistsMissing.result?.violations).toEqual([]);
  });

  it("equals / not_equals against a rule value", () => {
    const equalsMismatch = evaluatePolicy(
      { currency: "USD" },
      { version: "1", rules: [{ id: "r", type: "equals", path: "currency", value: "TRY" }] },
    );
    expect(equalsMismatch.result?.violations).toEqual([{ rule_id: "r", reason: "VALUE_MISMATCH" }]);

    const equalsMissing = evaluatePolicy({}, { version: "1", rules: [{ id: "r", type: "equals", path: "currency", value: "TRY" }] });
    expect(equalsMissing.result?.violations).toEqual([{ rule_id: "r", reason: "VALUE_MISMATCH" }]);

    const notEqualsViolation = evaluatePolicy(
      { currency: "TRY" },
      { version: "1", rules: [{ id: "r", type: "not_equals", path: "currency", value: "TRY" }] },
    );
    expect(notEqualsViolation.result?.violations).toEqual([{ rule_id: "r", reason: "VALUE_MISMATCH" }]);

    const notEqualsMissingIsCompliant = evaluatePolicy(
      {},
      { version: "1", rules: [{ id: "r", type: "not_equals", path: "currency", value: "TRY" }] },
    );
    expect(notEqualsMissingIsCompliant.result?.violations).toEqual([]);
  });

  it("one_of / not_one_of against a values array", () => {
    const oneOfViolation = evaluatePolicy(
      { role: "vip" },
      { version: "1", rules: [{ id: "r", type: "one_of", path: "role", values: ["individual", "business"] }] },
    );
    expect(oneOfViolation.result?.violations).toEqual([{ rule_id: "r", reason: "VALUE_NOT_ALLOWED" }]);

    const notOneOfViolation = evaluatePolicy(
      { role: "business" },
      { version: "1", rules: [{ id: "r", type: "not_one_of", path: "role", values: ["business"] }] },
    );
    expect(notOneOfViolation.result?.violations).toEqual([{ rule_id: "r", reason: "VALUE_NOT_ALLOWED" }]);

    const notOneOfMissingIsCompliant = evaluatePolicy(
      {},
      { version: "1", rules: [{ id: "r", type: "not_one_of", path: "role", values: ["business"] }] },
    );
    expect(notOneOfMissingIsCompliant.result?.violations).toEqual([]);
  });

  it("number_min / number_max", () => {
    const minViolation = evaluatePolicy({ amount: 5 }, { version: "1", rules: [{ id: "r", type: "number_min", path: "amount", value: 10 }] });
    expect(minViolation.result?.violations).toEqual([{ rule_id: "r", reason: "NUMBER_MIN_VIOLATION" }]);

    const maxViolation = evaluatePolicy({ amount: 5001 }, { version: "1", rules: [{ id: "r", type: "number_max", path: "amount", value: 5000 }] });
    expect(maxViolation.result?.violations).toEqual([{ rule_id: "r", reason: "NUMBER_MAX_VIOLATION" }]);

    const nonNumeric = evaluatePolicy({ amount: "not a number" }, { version: "1", rules: [{ id: "r", type: "number_max", path: "amount", value: 5000 }] });
    expect(nonNumeric.result?.violations).toEqual([{ rule_id: "r", reason: "NUMBER_MAX_VIOLATION" }]);
  });

  it("string_min_length / string_max_length", () => {
    const tooShort = evaluatePolicy({ name: "ab" }, { version: "1", rules: [{ id: "r", type: "string_min_length", path: "name", value: 3 }] });
    expect(tooShort.result?.violations).toEqual([{ rule_id: "r", reason: "STRING_LENGTH_VIOLATION" }]);

    const tooLong = evaluatePolicy({ name: "abcdef" }, { version: "1", rules: [{ id: "r", type: "string_max_length", path: "name", value: 3 }] });
    expect(tooLong.result?.violations).toEqual([{ rule_id: "r", reason: "STRING_LENGTH_VIOLATION" }]);
  });

  it("array_min_items / array_max_items", () => {
    const tooFew = evaluatePolicy({ tags: ["a"] }, { version: "1", rules: [{ id: "r", type: "array_min_items", path: "tags", value: 2 }] });
    expect(tooFew.result?.violations).toEqual([{ rule_id: "r", reason: "ARRAY_SIZE_VIOLATION" }]);

    const tooMany = evaluatePolicy({ tags: ["a", "b", "c"] }, { version: "1", rules: [{ id: "r", type: "array_max_items", path: "tags", value: 2 }] });
    expect(tooMany.result?.violations).toEqual([{ rule_id: "r", reason: "ARRAY_SIZE_VIOLATION" }]);
  });

  it("records multiple violations in declared rule order, not severity order", () => {
    const result = evaluatePolicy(
      { order: { currency: "USD", amount: 9999, customer_type: "vip" } },
      {
        version: "1",
        rules: [
          { id: "amount_limit", type: "number_max", path: "order.amount", value: 5000 },
          { id: "currency_by_country", type: "equals", path: "order.currency", value: "TRY" },
          { id: "customer_type", type: "one_of", path: "order.customer_type", values: ["individual", "business"] },
        ],
      },
    );
    expect(result.result?.violations).toEqual([
      { rule_id: "amount_limit", reason: "NUMBER_MAX_VIOLATION" },
      { rule_id: "currency_by_country", reason: "VALUE_MISMATCH" },
      { rule_id: "customer_type", reason: "VALUE_NOT_ALLOWED" },
    ]);
    expect(result.reason_code).toBe("POLICY_VIOLATION");
    expect(result.result?.compliant).toBe(false);
  });

  it("returns UNSUPPORTED_RULE for a rule type outside the fixed vocabulary and aborts the whole evaluation", () => {
    const result = evaluatePolicy(
      { a: 1 },
      { version: "1", rules: [{ id: "ok", type: "exists", path: "a" }, { id: "bad", type: "matches_regex", path: "a", value: ".*" }] },
    );
    expect(result).toEqual({ reason_code: "UNSUPPORTED_RULE", result: null });
  });

  it("returns INVALID_POLICY for a malformed policy shape", () => {
    expect(evaluatePolicy({}, { version: "2", rules: [] } as never).reason_code).toBe("INVALID_POLICY");
    expect(evaluatePolicy({}, { version: "1", rules: "not-an-array" } as never).reason_code).toBe("INVALID_POLICY");
    expect(evaluatePolicy({}, { version: "1", rules: [{ id: "x" }] } as never).reason_code).toBe("INVALID_POLICY");
  });

  it("returns INVALID_POLICY when a rule is missing the field its own type requires", () => {
    const missingValue = evaluatePolicy({ amount: 10 }, { version: "1", rules: [{ id: "r", type: "number_min", path: "amount" }] });
    expect(missingValue.reason_code).toBe("INVALID_POLICY");

    const missingValues = evaluatePolicy({ role: "x" }, { version: "1", rules: [{ id: "r", type: "one_of", path: "role" }] });
    expect(missingValues.reason_code).toBe("INVALID_POLICY");
  });

  it("stops at the first structural failure and does not evaluate rules after it", () => {
    const result = evaluatePolicy(
      { a: 1 },
      { version: "1", rules: [{ id: "bad", type: "eval", path: "a" }, { id: "ok", type: "exists", path: "a" }] },
    );
    expect(result).toEqual({ reason_code: "UNSUPPORTED_RULE", result: null });
  });
});
