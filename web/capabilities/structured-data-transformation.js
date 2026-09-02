export const CAPABILITY_ID = "data.structured-transformation";
export const PRODUCTION_TRIAL_ID = "structured-data-transformation-certification";
export const TRIAL_VERSION = "1";

/**
 * Deterministic Structured Data Transformation engine (Capability 5).
 *
 * Mirrors lib/trials/structured-data-transformation/transform.ts exactly —
 * same bounded operation language (copy, rename, set, remove, map_array), same
 * reason codes, same path and coercion rules. No eval, no Function
 * constructor, no arbitrary expression language. Verified against the server
 * engine in tests/browser/capability-modules.test.ts.
 */

const SUPPORTED_OPERATIONS = new Set(["copy", "rename", "set", "remove", "map_array"]);
const PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INTEGER_PATTERN = /^-?\d+$/;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

class TransformationError extends Error {
  constructor(reasonCode, message) {
    super(message);
    this.name = "TransformationError";
    this.reasonCode = reasonCode;
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function splitPath(path) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TransformationError("INVALID_TRANSFORMATION_SPEC", "operation path must be a non-empty string");
  }
  const segments = path.split(".");
  for (const segment of segments) {
    if (!PATH_SEGMENT_PATTERN.test(segment)) {
      throw new TransformationError("INVALID_TRANSFORMATION_SPEC", `invalid path segment: ${segment}`);
    }
  }
  return segments;
}

function readPath(source, path) {
  const segments = splitPath(path);
  let cursor = source;
  for (const segment of segments) {
    if (!isPlainObject(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return { found: false, value: undefined };
    }
    cursor = cursor[segment];
  }
  return { found: true, value: cursor };
}

function writePath(target, path, value) {
  const segments = splitPath(path);
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const existing = cursor[segment];
    if (existing === undefined) {
      const created = {};
      cursor[segment] = created;
      cursor = created;
    } else if (isPlainObject(existing)) {
      cursor = existing;
    } else {
      throw new TransformationError("TARGET_PATH_CONFLICT", `target path conflicts with an existing value: ${path}`);
    }
  }
  const leaf = segments[segments.length - 1];
  if (Object.prototype.hasOwnProperty.call(cursor, leaf)) {
    throw new TransformationError("TARGET_PATH_CONFLICT", `target path already written: ${path}`);
  }
  cursor[leaf] = value;
}

function removePath(target, path) {
  const segments = splitPath(path);
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (!isPlainObject(cursor)) return;
    cursor = cursor[segments[index]];
  }
  if (isPlainObject(cursor)) delete cursor[segments[segments.length - 1]];
}

export function coerceValue(value, type) {
  if (type === "string") {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return String(value);
    throw new TransformationError("INVALID_TYPE_COERCION", "cannot coerce value to string");
  }
  if (type === "integer") {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && INTEGER_PATTERN.test(value)) return Number.parseInt(value, 10);
    throw new TransformationError("INVALID_TYPE_COERCION", "cannot coerce value to integer");
  }
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && NUMBER_PATTERN.test(value)) return Number(value);
    throw new TransformationError("INVALID_TYPE_COERCION", "cannot coerce value to number");
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new TransformationError("INVALID_TYPE_COERCION", "cannot coerce value to boolean");
  }
  throw new TransformationError("INVALID_TRANSFORMATION_SPEC", `unknown coercion type: ${String(type)}`);
}

function applyOperation(source, target, op) {
  if (!SUPPORTED_OPERATIONS.has(op.op)) {
    throw new TransformationError("UNSUPPORTED_OPERATION", `unsupported operation: ${op.op}`);
  }

  if (op.op === "copy" || op.op === "rename") {
    if (typeof op.from !== "string" || typeof op.to !== "string") {
      throw new TransformationError("INVALID_TRANSFORMATION_SPEC", `${op.op} requires from and to`);
    }
    const { found, value } = readPath(source, op.from);
    if (!found) throw new TransformationError("SOURCE_PATH_MISSING", `source path missing: ${op.from}`);
    writePath(target, op.to, value);
    return;
  }

  if (op.op === "set") {
    if (typeof op.to !== "string" || !Object.prototype.hasOwnProperty.call(op, "value")) {
      throw new TransformationError("INVALID_TRANSFORMATION_SPEC", "set requires to and value");
    }
    writePath(target, op.to, op.value);
    return;
  }

  if (op.op === "remove") {
    if (typeof op.from !== "string") {
      throw new TransformationError("INVALID_TRANSFORMATION_SPEC", "remove requires from");
    }
    removePath(target, op.from);
    return;
  }

  if (op.op === "map_array") {
    if (typeof op.from !== "string" || typeof op.to !== "string" || !isPlainObject(op.fields)) {
      throw new TransformationError("INVALID_TRANSFORMATION_SPEC", "map_array requires from, to and fields");
    }
    const { found, value } = readPath(source, op.from);
    if (!found) throw new TransformationError("SOURCE_PATH_MISSING", `source path missing: ${op.from}`);
    if (!Array.isArray(value)) {
      throw new TransformationError("INVALID_TRANSFORMATION_SPEC", `map_array source is not an array: ${op.from}`);
    }
    const fieldEntries = Object.entries(op.fields);
    const mapped = value.map((element) => {
      const row = {};
      for (const [targetField, fieldSpec] of fieldEntries) {
        if (!isPlainObject(fieldSpec) || typeof fieldSpec.from !== "string" || typeof fieldSpec.type !== "string") {
          throw new TransformationError("INVALID_TRANSFORMATION_SPEC", `invalid map_array field spec: ${targetField}`);
        }
        const { found: elementFound, value: elementValue } = readPath(element, fieldSpec.from);
        if (!elementFound) throw new TransformationError("SOURCE_PATH_MISSING", `array element missing field: ${fieldSpec.from}`);
        row[targetField] = coerceValue(elementValue, fieldSpec.type);
      }
      return row;
    });
    writePath(target, op.to, mapped);
    return;
  }
}

export function applyTransformation(source, spec) {
  if (!isPlainObject(spec) || spec.version !== "1" || !Array.isArray(spec.operations)) {
    return { reason_code: "INVALID_TRANSFORMATION_SPEC", result: null };
  }
  const target = {};
  try {
    for (const op of spec.operations) {
      if (!isPlainObject(op) || typeof op.op !== "string") {
        throw new TransformationError("INVALID_TRANSFORMATION_SPEC", "operation must be an object with an op field");
      }
      applyOperation(source, target, op);
    }
  } catch (error) {
    if (error instanceof TransformationError) {
      return { reason_code: error.reasonCode, result: null };
    }
    throw error;
  }
  return { reason_code: "TRANSFORMATION_MATCH", result: target };
}

/** The single executor used by practice, certification and normal FLOP use. */
export async function executeStructuredDataTransformation(input) {
  return applyTransformation(input.source, input.spec);
}

export function createPracticeFixture() {
  const input = {
    source: { customer: { name: "Ada", country: "TR" }, items: [{ sku: "A12", qty: "2", price: 125.5 }] },
    spec: {
      version: "1",
      operations: [
        { op: "rename", from: "customer.name", to: "buyer.full_name" },
        { op: "copy", from: "customer.country", to: "buyer.country" },
        {
          op: "map_array",
          from: "items",
          to: "lines",
          fields: {
            sku: { from: "sku", type: "string" },
            quantity: { from: "qty", type: "integer" },
            unit_price: { from: "price", type: "number" },
          },
        },
      ],
    },
  };
  return {
    input,
    expected: {
      reason_code: "TRANSFORMATION_MATCH",
      result: { buyer: { full_name: "Ada", country: "TR" }, lines: [{ sku: "A12", quantity: 2, unit_price: 125.5 }] },
    },
  };
}

export async function evaluatePractice(result, fixture) {
  return (
    result.reason_code === fixture.expected.reason_code &&
    JSON.stringify(result.result) === JSON.stringify(fixture.expected.result)
  );
}
