import { describe, expect, it } from "vitest";
import { isSha256Hash, sha256 } from "../../lib/crypto/sha256.js";

describe("sha256", () => {
  it("produces the project representation sha256:<base64url-no-padding>", () => {
    // Cross-checked independently against hashlib.sha256 + base64.urlsafe_b64encode.
    expect(sha256(new TextEncoder().encode(""))).toBe(
      "sha256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
    );
    expect(sha256(new TextEncoder().encode("hello world"))).toBe(
      "sha256:uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvzek",
    );
  });

  it("hashes exact bytes: order and every byte matter", () => {
    const a = sha256(Uint8Array.from([1, 2, 3]));
    const reordered = sha256(Uint8Array.from([3, 2, 1]));
    const extended = sha256(Uint8Array.from([1, 2, 3, 0]));
    expect(a).not.toBe(reordered);
    expect(a).not.toBe(extended);
  });

  it("validates the sha256 hash format", () => {
    expect(isSha256Hash(sha256(new Uint8Array(0)))).toBe(true);
    expect(isSha256Hash("sha256:not-valid-base64url-length")).toBe(false);
    expect(isSha256Hash("md5:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU")).toBe(false);
    expect(isSha256Hash("sha256:AAAA")).toBe(false);
  });
});
