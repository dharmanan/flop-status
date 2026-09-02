/**
 * Deterministic Constraint & Policy Compliance engine (Capability 6).
 *
 * A small, bounded rule language — required, equals, not_equals, one_of,
 * not_one_of, number_min, number_max, string_min_length, string_max_length,
 * array_min_items, array_max_items, exists, not_exists — evaluated in
 * explicit array order against a plain JSON document. No eval, no Function
 * constructor, no regular expression execution, no LLM judgment. Every
 * failure mode has a stable reason code so the browser executor and this
 * server-side engine can be verified to agree byte-for-byte.
 */

import { canonicalizeJson } from "../../crypto/canonical-json.js";

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

export class PolicyEvaluationError extends Error {
  constructor(readonly reasonCode: "INVALID_POLICY" | "UNSUPPORTED_RULE", message: string) {
    super(message);
    this.name = "PolicyEvaluationError";
  }
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface PolicyRule {
  id: string;
  type: string;
  path: string;
  value?: unknown;
  values?: unknown[];
}

export interface PolicySpec {
  version: string;
  rules: PolicyRule[];
}

export interface PolicyViolation {
  rule_id: string;
  reason: ViolationReasonCode;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: PolicyViolation[];
  evaluated_rules: string[];
}

export interface PolicyEvaluationResult {
  reason_code: PolicyReasonCode;
  result: ComplianceResult | null;
}

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function readPath(source: unknown, path: unknown): { found: boolean; value: unknown } {
  if (typeof path !== "string" || path.length === 0) {
    throw new PolicyEvaluationError("INVALID_POLICY", "rule path must be a non-empty string");
  }
  const segments = path.split(".");
  for (const segment of segments) {
    if (!PATH_SEGMENT_PATTERN.test(segment)) {
      throw new PolicyEvaluationError("INVALID_POLICY", `invalid path segment: ${segment}`);
    }
  }
  let cursor: unknown = source;
  for (const segment of segments) {
    if (!isPlainObject(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return { found: false, value: undefined };
    }
    cursor = cursor[segment];
  }
  return { found: true, value: cursor };
}

function equalsJson(a: unknown, b: unknown): boolean {
  return canonicalizeJson(a) === canonicalizeJson(b);
}

/**
 * `required` is a value-presence check (missing OR explicitly null both
 * fail); `exists`/`not_exists` are pure path-presence checks where an
 * explicit null still counts as present. This distinction is not fully
 * disambiguated by the task spec — it is the documented design decision
 * for this engine, chosen so `required` matches the spec's own example
 * ("required_country" must have an actual country, not just the key).
 */
function evaluateRule(document: unknown, rule: PolicyRule): ViolationReasonCode | null {
  const { found, value } = readPath(document, rule.path);

  switch (rule.type) {
    case "required": {
      if (!found || value === null) return "REQUIRED_VALUE_MISSING";
      return null;
    }
    case "exists": {
      if (!found) return "PATH_EXISTENCE_VIOLATION";
      return null;
    }
    case "not_exists": {
      if (found) return "PATH_EXISTENCE_VIOLATION";
      return null;
    }
    case "equals": {
      if (!found || !equalsJson(value, rule.value)) return "VALUE_MISMATCH";
      return null;
    }
    case "not_equals": {
      if (found && equalsJson(value, rule.value)) return "VALUE_MISMATCH";
      return null;
    }
    case "one_of": {
      if (!Array.isArray(rule.values)) {
        throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: one_of requires a values array`);
      }
      if (!found || !rule.values.some((candidate) => equalsJson(value, candidate))) return "VALUE_NOT_ALLOWED";
      return null;
    }
    case "not_one_of": {
      if (!Array.isArray(rule.values)) {
        throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: not_one_of requires a values array`);
      }
      if (found && rule.values.some((candidate) => equalsJson(value, candidate))) return "VALUE_NOT_ALLOWED";
      return null;
    }
    case "number_min": {
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: number_min requires a numeric value`);
      if (!found || typeof value !== "number" || value < rule.value) return "NUMBER_MIN_VIOLATION";
      return null;
    }
    case "number_max": {
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: number_max requires a numeric value`);
      if (!found || typeof value !== "number" || value > rule.value) return "NUMBER_MAX_VIOLATION";
      return null;
    }
    case "string_min_length": {
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: string_min_length requires a numeric value`);
      if (!found || typeof value !== "string" || value.length < rule.value) return "STRING_LENGTH_VIOLATION";
      return null;
    }
    case "string_max_length": {
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: string_max_length requires a numeric value`);
      if (!found || typeof value !== "string" || value.length > rule.value) return "STRING_LENGTH_VIOLATION";
      return null;
    }
    case "array_min_items": {
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: array_min_items requires a numeric value`);
      if (!found || !Array.isArray(value) || value.length < rule.value) return "ARRAY_SIZE_VIOLATION";
      return null;
    }
    case "array_max_items": {
      if (typeof rule.value !== "number") throw new PolicyEvaluationError("INVALID_POLICY", `rule ${rule.id}: array_max_items requires a numeric value`);
      if (!found || !Array.isArray(value) || value.length > rule.value) return "ARRAY_SIZE_VIOLATION";
      return null;
    }
    default:
      throw new PolicyEvaluationError("UNSUPPORTED_RULE", `unsupported rule type: ${rule.type}`);
  }
}

function isValidRuleShape(rule: unknown): rule is PolicyRule {
  return (
    isPlainObject(rule) &&
    typeof rule.id === "string" &&
    rule.id.length > 0 &&
    typeof rule.type === "string" &&
    typeof rule.path === "string"
  );
}

/**
 * Evaluates a bounded, deterministic policy against a document. Structural
 * problems (malformed policy shape, an unsupported rule type, a rule with
 * missing required fields for its own type) abort the whole evaluation with
 * a null result and a stable top-level reason code — mirroring how
 * Capability 5's transform engine handles INVALID_TRANSFORMATION_SPEC and
 * UNSUPPORTED_OPERATION. Otherwise every rule is evaluated, in declared
 * order, and every violation is recorded in that same order so ordering is
 * deterministic.
 */
export function evaluatePolicy(document: unknown, spec: PolicySpec): PolicyEvaluationResult {
  if (!isPlainObject(spec) || spec.version !== "1" || !Array.isArray(spec.rules)) {
    return { reason_code: "INVALID_POLICY", result: null };
  }

  const evaluatedRules: string[] = [];
  const violations: PolicyViolation[] = [];

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
