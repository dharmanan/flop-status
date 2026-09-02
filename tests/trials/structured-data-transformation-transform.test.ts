import { describe, expect, it } from "vitest";
import { applyTransformation, coerceValue } from "../../lib/trials/structured-data-transformation/transform.js";

describe("structured data transformation engine", () => {
  it("applies copy, rename, set, remove and map_array in order", () => {
    const source = {
      customer: { name: "Ada Lovelace", country: "GB" },
      items: [
        { sku: "A1", qty: "2", price: 10.5 },
        { sku: "B2", qty: "1", price: 20 },
      ],
      internal_note: "do not export",
    };
    const result = applyTransformation(source, {
      version: "1",
      operations: [
        { op: "rename", from: "customer.name", to: "buyer.full_name" },
        { op: "copy", from: "customer.country", to: "buyer.country" },
        { op: "set", to: "buyer.channel", value: "online" },
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
        { op: "remove", from: "buyer.channel" },
      ],
    });

    expect(result).toEqual({
      reason_code: "TRANSFORMATION_MATCH",
      result: {
        buyer: { full_name: "Ada Lovelace", country: "GB" },
        lines: [
          { sku: "A1", quantity: 2, unit_price: 10.5 },
          { sku: "B2", quantity: 1, unit_price: 20 },
        ],
      },
    });
  });

  it("builds a fresh target and never carries over unmentioned source fields", () => {
    const result = applyTransformation(
      { customer: { name: "Ada" }, internal_note: "secret" },
      { version: "1", operations: [{ op: "copy", from: "customer.name", to: "buyer.name" }] },
    );
    expect(result.result).toEqual({ buyer: { name: "Ada" } });
  });

  it("treats remove of a path never written to the target as a no-op", () => {
    const result = applyTransformation(
      { a: 1 },
      { version: "1", operations: [{ op: "remove", from: "never.written" }] },
    );
    expect(result).toEqual({ reason_code: "TRANSFORMATION_MATCH", result: {} });
  });

  it("returns SOURCE_PATH_MISSING when copy reads an absent path", () => {
    const result = applyTransformation({ a: 1 }, { version: "1", operations: [{ op: "copy", from: "b.c", to: "d" }] });
    expect(result).toEqual({ reason_code: "SOURCE_PATH_MISSING", result: null });
  });

  it("returns SOURCE_PATH_MISSING when rename reads an absent path", () => {
    const result = applyTransformation({ a: 1 }, { version: "1", operations: [{ op: "rename", from: "b", to: "c" }] });
    expect(result.reason_code).toBe("SOURCE_PATH_MISSING");
  });

  it("returns SOURCE_PATH_MISSING when map_array source path is absent", () => {
    const result = applyTransformation(
      {},
      { version: "1", operations: [{ op: "map_array", from: "items", to: "lines", fields: { sku: { from: "sku", type: "string" } } }] },
    );
    expect(result.reason_code).toBe("SOURCE_PATH_MISSING");
  });

  it("returns SOURCE_PATH_MISSING when a map_array element is missing the mapped field", () => {
    const result = applyTransformation(
      { items: [{ sku: "A1" }, { qty: "2" }] },
      { version: "1", operations: [{ op: "map_array", from: "items", to: "lines", fields: { sku: { from: "sku", type: "string" } } }] },
    );
    expect(result.reason_code).toBe("SOURCE_PATH_MISSING");
  });

  it("returns INVALID_TYPE_COERCION when a mapped field cannot be coerced", () => {
    const result = applyTransformation(
      { items: [{ sku: "not-an-integer" }] },
      { version: "1", operations: [{ op: "map_array", from: "items", to: "lines", fields: { sku: { from: "sku", type: "integer" } } }] },
    );
    expect(result).toEqual({ reason_code: "INVALID_TYPE_COERCION", result: null });
  });

  it("returns INVALID_TRANSFORMATION_SPEC when map_array source is not an array", () => {
    const result = applyTransformation(
      { items: { not: "an array" } },
      { version: "1", operations: [{ op: "map_array", from: "items", to: "lines", fields: { sku: { from: "sku", type: "string" } } }] },
    );
    expect(result.reason_code).toBe("INVALID_TRANSFORMATION_SPEC");
  });

  it("returns UNSUPPORTED_OPERATION for an operation name outside the fixed vocabulary", () => {
    const result = applyTransformation({ a: 1 }, { version: "1", operations: [{ op: "eval", from: "a", to: "b" }] });
    expect(result).toEqual({ reason_code: "UNSUPPORTED_OPERATION", result: null });
  });

  it("returns TARGET_PATH_CONFLICT when two operations write the exact same target leaf", () => {
    const result = applyTransformation(
      { a: 1, b: 2 },
      { version: "1", operations: [{ op: "copy", from: "a", to: "x.y" }, { op: "copy", from: "b", to: "x.y" }] },
    );
    expect(result).toEqual({ reason_code: "TARGET_PATH_CONFLICT", result: null });
  });

  it("returns TARGET_PATH_CONFLICT when a later write tries to descend through an already-written scalar", () => {
    const result = applyTransformation(
      { a: 1, b: 2 },
      { version: "1", operations: [{ op: "set", to: "x", value: 1 }, { op: "copy", from: "b", to: "x.y" }] },
    );
    expect(result).toEqual({ reason_code: "TARGET_PATH_CONFLICT", result: null });
  });

  it("returns INVALID_TRANSFORMATION_SPEC for a malformed spec shape", () => {
    expect(applyTransformation({}, { version: "2", operations: [] } as never).reason_code).toBe(
      "INVALID_TRANSFORMATION_SPEC",
    );
    expect(applyTransformation({}, { version: "1", operations: "not-an-array" } as never).reason_code).toBe(
      "INVALID_TRANSFORMATION_SPEC",
    );
  });

  it("stops at the first failing operation and does not apply later operations", () => {
    const result = applyTransformation(
      { a: 1 },
      {
        version: "1",
        operations: [
          { op: "copy", from: "missing", to: "x" },
          { op: "set", to: "y", value: "should not run" },
        ],
      },
    );
    expect(result).toEqual({ reason_code: "SOURCE_PATH_MISSING", result: null });
  });

  describe("coerceValue", () => {
    it("coerces to string from number and boolean", () => {
      expect(coerceValue(42, "string")).toBe("42");
      expect(coerceValue(true, "string")).toBe("true");
      expect(coerceValue("already", "string")).toBe("already");
    });

    it("coerces to integer from a matching numeric string or an integer number", () => {
      expect(coerceValue("7", "integer")).toBe(7);
      expect(coerceValue(7, "integer")).toBe(7);
      expect(() => coerceValue(7.5, "integer")).toThrow();
      expect(() => coerceValue("7.5", "integer")).toThrow();
    });

    it("coerces to number from a numeric string or a number", () => {
      expect(coerceValue("7.5", "number")).toBe(7.5);
      expect(coerceValue(7.5, "number")).toBe(7.5);
      expect(() => coerceValue("not-a-number", "number")).toThrow();
    });

    it("coerces to boolean only from the literal strings true/false or an actual boolean", () => {
      expect(coerceValue("true", "boolean")).toBe(true);
      expect(coerceValue("false", "boolean")).toBe(false);
      expect(coerceValue(false, "boolean")).toBe(false);
      expect(() => coerceValue("yes", "boolean")).toThrow();
      expect(() => coerceValue(1, "boolean")).toThrow();
    });
  });
});
