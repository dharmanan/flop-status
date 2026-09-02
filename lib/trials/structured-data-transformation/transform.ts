/**
 * Deterministic Structured Data Transformation engine (Capability 5).
 *
 * A small, bounded operation language — copy, rename, set, remove, map_array —
 * applied in explicit array order. No eval, no Function constructor, no
 * arbitrary expression language. Every failure mode has a stable reason code
 * so the browser executor and this server-side engine can be verified to
 * agree byte-for-byte on both success and failure.
 */

export type CoercionType = "string" | "integer" | "number" | "boolean";

export type TransformReasonCode =
  | "TRANSFORMATION_MATCH"
  | "SOURCE_PATH_MISSING"
  | "INVALID_TYPE_COERCION"
  | "INVALID_TRANSFORMATION_SPEC"
  | "UNSUPPORTED_OPERATION"
  | "TARGET_PATH_CONFLICT";

export class TransformationError extends Error {
  constructor(readonly reasonCode: TransformReasonCode, message: string) {
    super(message);
    this.name = "TransformationError";
  }
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface TransformResult {
  reason_code: TransformReasonCode;
  result: JsonValue | null;
}

const SUPPORTED_OPERATIONS = new Set(["copy", "rename", "set", "remove", "map_array"]);
const PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function splitPath(path: unknown): string[] {
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

/** Reads a dot-separated path from a plain-object/array-free JSON document. */
function readPath(source: unknown, path: string): { found: boolean; value: unknown } {
  const segments = splitPath(path);
  let cursor: unknown = source;
  for (const segment of segments) {
    if (!isPlainObject(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return { found: false, value: undefined };
    }
    cursor = cursor[segment];
  }
  return { found: true, value: cursor };
}

/**
 * Writes a dot-separated path into the accumulating target object, creating
 * intermediate objects as needed. Throws TARGET_PATH_CONFLICT if the exact
 * leaf was already written, or if an intermediate segment is already a
 * non-object value that cannot be descended into.
 */
function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = splitPath(path);
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const existing = cursor[segment];
    if (existing === undefined) {
      const created: Record<string, unknown> = {};
      cursor[segment] = created;
      cursor = created;
    } else if (isPlainObject(existing)) {
      cursor = existing;
    } else {
      throw new TransformationError("TARGET_PATH_CONFLICT", `target path conflicts with an existing value: ${path}`);
    }
  }
  const leaf = segments[segments.length - 1]!;
  if (Object.prototype.hasOwnProperty.call(cursor, leaf)) {
    throw new TransformationError("TARGET_PATH_CONFLICT", `target path already written: ${path}`);
  }
  cursor[leaf] = value;
}

/** Removes a dot-separated path from the target if present. Missing paths are a no-op. */
function removePath(target: Record<string, unknown>, path: string): void {
  const segments = splitPath(path);
  let cursor: unknown = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (!isPlainObject(cursor)) return;
    cursor = cursor[segments[index]!];
  }
  if (isPlainObject(cursor)) delete cursor[segments[segments.length - 1]!];
}

const INTEGER_PATTERN = /^-?\d+$/;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

export function coerceValue(value: unknown, type: CoercionType): JsonValue {
  if (type === "string") {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return String(value);
    throw new TransformationError("INVALID_TYPE_COERCION", `cannot coerce value to string`);
  }
  if (type === "integer") {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && INTEGER_PATTERN.test(value)) return Number.parseInt(value, 10);
    throw new TransformationError("INVALID_TYPE_COERCION", `cannot coerce value to integer`);
  }
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && NUMBER_PATTERN.test(value)) return Number(value);
    throw new TransformationError("INVALID_TYPE_COERCION", `cannot coerce value to number`);
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new TransformationError("INVALID_TYPE_COERCION", `cannot coerce value to boolean`);
  }
  throw new TransformationError("INVALID_TRANSFORMATION_SPEC", `unknown coercion type: ${String(type)}`);
}

export interface TransformOperation {
  op: string;
  from?: string;
  to?: string;
  value?: unknown;
  fields?: Record<string, { from: string; type: CoercionType }>;
}

export interface TransformSpec {
  version: string;
  operations: TransformOperation[];
}

function applyOperation(source: unknown, target: Record<string, unknown>, op: TransformOperation): void {
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
      const row: Record<string, JsonValue> = {};
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

/**
 * Applies a bounded, deterministic transformation. Never throws for
 * data-dependent problems (missing paths, bad coercions, unknown operations,
 * path conflicts) — those come back as a structured reason code instead, so
 * the agent can report them the same way a correct transformation is
 * reported. Only a structurally broken spec argument throws directly.
 */
export function applyTransformation(source: unknown, spec: TransformSpec): TransformResult {
  if (!isPlainObject(spec) || spec.version !== "1" || !Array.isArray(spec.operations)) {
    return { reason_code: "INVALID_TRANSFORMATION_SPEC", result: null };
  }
  const target: Record<string, unknown> = {};
  try {
    for (const op of spec.operations) {
      if (!isPlainObject(op) || typeof op.op !== "string") {
        throw new TransformationError("INVALID_TRANSFORMATION_SPEC", "operation must be an object with an op field");
      }
      applyOperation(source, target, op as TransformOperation);
    }
  } catch (error) {
    if (error instanceof TransformationError) {
      return { reason_code: error.reasonCode, result: null };
    }
    throw error;
  }
  return { reason_code: "TRANSFORMATION_MATCH", result: target as JsonValue };
}
