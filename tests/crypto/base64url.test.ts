import { describe, expect, it } from "vitest";
import { Base64UrlError, decodeBase64Url, encodeBase64Url } from "../../lib/crypto/base64url.js";

describe("base64url", () => {
  it("round trips arbitrary byte lengths", () => {
    for (let length = 0; length <= 40; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 7 + 1) % 256);
      const encoded = encodeBase64Url(bytes);
      expect(decodeBase64Url(encoded)).toEqual(bytes);
    }
  });

  it("matches known RFC 4648 base64 test vectors (unpadded, base64url alphabet)", () => {
    const vectors: Array<[string, string]> = [
      ["", ""],
      ["f", "Zg"],
      ["fo", "Zm8"],
      ["foo", "Zm9v"],
      ["foob", "Zm9vYg"],
      ["fooba", "Zm9vYmE"],
      ["foobar", "Zm9vYmFy"],
    ];
    for (const [input, expected] of vectors) {
      const bytes = new TextEncoder().encode(input);
      expect(encodeBase64Url(bytes)).toBe(expected);
      expect(decodeBase64Url(expected)).toEqual(bytes);
    }
  });

  it("rejects characters outside the unpadded base64url alphabet", () => {
    expect(() => decodeBase64Url("Zm9v+")).toThrow(Base64UrlError);
    expect(() => decodeBase64Url("Zm9v/")).toThrow(Base64UrlError);
    expect(() => decodeBase64Url("not base64!")).toThrow(Base64UrlError);
  });

  it("rejects standard base64 padding", () => {
    expect(() => decodeBase64Url("Zg==")).toThrow(Base64UrlError);
  });

  it("rejects an impossible length (length % 4 === 1)", () => {
    expect(() => decodeBase64Url("A")).toThrow(Base64UrlError);
    expect(() => decodeBase64Url("AAAAA")).toThrow(Base64UrlError);
  });

  it("rejects non-canonical encodings that decode to the same bytes as a shorter canonical string", () => {
    // "Zh" is a non-canonical 2-char encoding of the same 1 byte as canonical "Zg".
    expect(() => decodeBase64Url("Zh")).toThrow(Base64UrlError);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error intentional invalid input for the runtime guard
    expect(() => decodeBase64Url(123)).toThrow(Base64UrlError);
  });
});
