import { canonicalizeJson } from "./jcs.js";

export const CAPABILITY_ID = "policy.constraint-compliance";
export const PRODUCTION_TRIAL_ID = "constraint-policy-compliance-certification";
export const TRIAL_VERSION = "1";

/**
 * Deterministic Constraint & Policy Compliance engine (Capability 6).
 *
 * Mirrors lib/trials/constraint-policy-compliance/evaluate.ts exactly — same
 * bounded rule language, same reason codes, same path rules. No eval, no
 * Function constructor, no regular expression execution, no LLM judgment.
 * Verified against the server engine in tests/browser/capability-modules.test.ts.
 */

const SUPPORTED_RULE_TYPES = new Set([
  "required",
  "equals",
  "not_equals",
  "one_of",
  "not_one_of",
  "number_min",
  "number_max",
  "string_min_length",
  "string_max_length",
  "array_min_items",
  "array_max_items",
  "exists",
  "not_exists",
]);
const PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

class PolicyEvaluationError extends Error {
  constructor(reasonCode, message) {
    super(message);
    this.name = "PolicyEvaluationError";
    this.reasonCode = reasonCode;
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function equalsJson(a, b) {
  return canonicalizeJson(a) === canonicalizeJson(b);
}

function readPath(source, path) {
  if (typeof path !== "string" || path.length === 0) {
    throw new PolicyEvaluationError("INVALID_POLICY", "rule path must be a non-empty string");
  }
  const segments = path.split(".");
  for (const segment of segments) {
    if (!PATH_SEGMENT_PATTERN.test(segment)) {
      throw new PolicyEvaluationError("INVALID_POLICY", `invalid path segment: ${segment}`);
    }
  }
  let cursor = source;
  for (const segment of segments) {
    if (!isPlainObject(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return { found: false, value: undefined };
    }
    cursor = cursor[segment];
  }
  return { found: true, value: cursor };
}

function evaluateRule(document, rule) {
  const { found, value } = readPath(document, rule.path);

  switch (rule.type) {
    case "required":
      if (!found || value === null) return "REQUIRED_VALUE_MISSING";
      return null;
    case "exists":
      if (!found) return "PATH_EXISTENCE_VIOLATION";
      return null;
    case "not_exists":
      if (found) return "PATH_EXISTENCE_VIOLATION";
      return null;
    case "equals":
      if (!found || !equalsJson(value, rule.value)) return "VALUE_MISMATCH";
      return null;
    case "not_equals":
      if (found && equalsJson(value, rule.value)) return "VALUE_MISMATCH";
      return null;
    case "one_of":
      if (!Array.isArray(rule.values)) throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: one_of requires a values array`);
      if (!found || !rule.values.some((candidate) => equalsJson(value, candidate))) return "VALUE_NOT_ALLOWED";
      return null;
    case "not_one_of":
      if (!Array.isArray(rule.values)) throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: not_one_of requires a values array`);
      if (found && rule.values.some((candidate) => equalsJson(value, candidate))) return "VALUE_NOT_ALLOWED";
      return null;
    case "number_min":
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: number_min requires a numeric value`);
      if (!found || typeof value !== "number" || value < rule.value) return "NUMBER_MIN_VIOLATION";
      return null;
    case "number_max":
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: number_max requires a numeric value`);
      if (!found || typeof value !== "number" || value > rule.value) return "NUMBER_MAX_VIOLATION";
      return null;
    case "string_min_length":
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: string_min_length requires a numeric value`);
      if (!found || typeof value !== "string" || value.length < rule.value) return "STRING_LENGTH_VIOLATION";
      return null;
    case "string_max_length":
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: string_max_length requires a numeric value`);
      if (!found || typeof value !== "string" || value.length > rule.value) return "STRING_LENGTH_VIOLATION";
      return null;
    case "array_min_items":
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: array_min_items requires a numeric value`);
      if (!found || !Array.isArray(value) || value.length < rule.value) return "ARRAY_SIZE_VIOLATION";
      return null;
    case "array_max_items":
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: array_max_items requires a numeric value`);
      if (!found || !Array.isArray(value) || value.length > rule.value) return "ARRAY_SIZE_VIOLATION";
      return null;
    default:
      throw new PolicyEvaluationError("UNSUPPORTED_RULE", `unsupported rule type: ${rule.type}`);
  }
}

function isValidRuleShape(rule) {
  return isPlainObject(rule) && typeof rule.id === "string" && rule.id.length > 0 && typeof rule.type === "string" && typeof rule.path === "string";
}

export function evaluatePolicy(document, spec) {
  if (!isPlainObject(spec) || spec.version !== "1" || !Array.isArray(spec.rules)) {
    return { reason_code: "INVALID_POLICY", result: null };
  }

  const evaluatedRules = [];
  const violations = [];

  try {
    for (const rule of spec.rules) {
      if (!isValidRuleShape(rule)) {
        throw new PolicyEvaluationError("INVALID_POLICY", "rule must be an object with id, type and path");
      }
      evaluatedRules.push(rule.id);
      const violationReason = evaluateRule(document, rule);
      if (violationReason) violations.push({ rule_id: rule.id, reason: violationReason });
    }
  } catch (error) {
    if (error instanceof PolicyEvaluationError) {
      return { reason_code: error.reasonCode, result: null };
    }
    throw error;
  }

  return {
    reason_code: violations.length === 0 ? "POLICY_COMPLIANT" : "POLICY_VIOLATION",
    result: { compliant: violations.length === 0, violations, evaluated_rules: evaluatedRules },
  };
}

/** The single executor used by practice, certification and normal FLOP use. */
export async function executeConstraintPolicyCompliance(input) {
  return evaluatePolicy(input.document, input.policy);
}

export function createPracticeFixture() {
  const input = {
    document: { order: { country: "TR", currency: "TRY", amount: 1250, customer_type: "business", priority: "standard" } },
    policy: {
      version: "1",
      rules: [
        { id: "currency_by_country", type: "equals", path: "order.currency", value: "TRY" },
        { id: "amount_limit", type: "number_max", path: "order.amount", value: 5000 },
        { id: "customer_type", type: "one_of", path: "order.customer_type", values: ["individual", "business"] },
        { id: "required_country", type: "required", path: "order.country" },
      ],
    },
  };
  return {
    input,
    expected: {
      reason_code: "POLICY_COMPLIANT",
      result: {
        compliant: true,
        violations: [],
        evaluated_rules: ["currency_by_country", "amount_limit", "customer_type", "required_country"],
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
