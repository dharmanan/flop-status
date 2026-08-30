import { describe, expect, it } from "vitest";
import {
  CANONICALIZATION_ID,
  CanonicalJsonError,
  canonicalizeJson,
  canonicalizeJsonToBytes,
} from "../../lib/crypto/canonical-json.js";

describe("canonicalizeJson (RFC 8785 JCS)", () => {
  it("exposes the jcs-rfc8785-v1 canonicalization id", () => {
    expect(CANONICALIZATION_ID).toBe("jcs-rfc8785-v1");
  });

  it("is independent of top-level object key insertion order", () => {
    const a = { b: 1, a: 2, c: 3 };
    const b = { c: 3, a: 2, b: 1 };
    expect(canonicalizeJson(a)).toBe(canonicalizeJson(b));
    expect(canonicalizeJson(a)).toBe('{"a":2,"b":1,"c":3}');
  });

  it("handles nested objects and arrays deterministically regardless of nested key order", () => {
    const a = { outer: { z: 1, y: [1, 2, { d: true, c: null }] }, top: 1 };
    const b = { top: 1, outer: { y: [1, 2, { c: null, d: true }], z: 1 } };
    expect(canonicalizeJson(a)).toBe(canonicalizeJson(b));
    expect(canonicalizeJson(a)).toBe('{"outer":{"y":[1,2,{"c":null,"d":true}],"z":1},"top":1}');
  });

  it("does not reorder array elements", () => {
    expect(canonicalizeJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("produces the UTF-8 bytes of the canonical string", () => {
    const value = { a: 1 };
    const bytes = canonicalizeJsonToBytes(value);
    expect(new TextDecoder().decode(bytes)).toBe(canonicalizeJson(value));
  });

  it("throws for a value with no JSON representation", () => {
    expect(() => canonicalizeJson(undefined)).toThrow(CanonicalJsonError);
  });
});
