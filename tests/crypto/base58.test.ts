import { describe, expect, it } from "vitest";
import { Base58Error, decodeBase58btc, encodeBase58btc } from "../../lib/crypto/base58.js";

describe("base58btc", () => {
  it("round trips arbitrary byte sequences, including leading zero bytes", () => {
    const cases: Uint8Array[] = [
      new Uint8Array(0),
      Uint8Array.from([0]),
      Uint8Array.from([0, 0, 0]),
      Uint8Array.from([0, 1, 2, 3]),
      Uint8Array.from({ length: 34 }, (_, i) => (i * 13 + 5) % 256),
    ];
    for (const bytes of cases) {
      expect(decodeBase58btc(encodeBase58btc(bytes))).toEqual(bytes);
    }
  });

  it("encodes each leading zero byte as a leading '1' character", () => {
    expect(encodeBase58btc(Uint8Array.from([0, 0, 5]))).toMatch(/^11/);
    expect(decodeBase58btc("11")).toEqual(Uint8Array.from([0, 0]));
    expect(decodeBase58btc("")).toEqual(new Uint8Array(0));
  });

  it("rejects characters outside the base58btc alphabet (0, O, I, l are excluded)", () => {
    expect(() => decodeBase58btc("0")).toThrow(Base58Error);
    expect(() => decodeBase58btc("O")).toThrow(Base58Error);
    expect(() => decodeBase58btc("I")).toThrow(Base58Error);
    expect(() => decodeBase58btc("l")).toThrow(Base58Error);
  });
});
