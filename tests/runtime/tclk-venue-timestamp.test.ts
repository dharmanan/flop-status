import { describe, expect, it } from "vitest";
import { computeTransportRecordFingerprint, parseVenueTimestampMs } from "../../lib/runtime/tclk-venue-timestamp.js";

describe("parseVenueTimestampMs", () => {
  it("parses a real Technocore venue timestamp to epoch milliseconds", () => {
    expect(parseVenueTimestampMs("2026-09-03T15:26:42.999601Z")).toBe(Date.parse("2026-09-03T15:26:42.999601Z"));
  });

  it("returns null for a non-string, missing, or unparseable value rather than substituting anything", () => {
    expect(parseVenueTimestampMs(undefined)).toBeNull();
    expect(parseVenueTimestampMs(null)).toBeNull();
    expect(parseVenueTimestampMs(1788432539261)).toBeNull();
    expect(parseVenueTimestampMs("")).toBeNull();
    expect(parseVenueTimestampMs("not-a-timestamp")).toBeNull();
  });
});

describe("computeTransportRecordFingerprint", () => {
  const base = {
    room: "tclk-offers",
    seq: 10457,
    ts: "2026-09-03T15:26:42.999601Z",
    from: "did:key:z6Mkexample",
    sig: "sig-abc",
    nonce: 123,
    text: "tclk1 {\"type\":\"offer\"}",
  };

  it("is a 64-character lowercase hex SHA-256 digest", () => {
    const fingerprint = computeTransportRecordFingerprint(base);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the exact same record", () => {
    expect(computeTransportRecordFingerprint(base)).toBe(computeTransportRecordFingerprint({ ...base }));
  });

  it("differs when seq differs, even with everything else identical — a signature never covers seq", () => {
    expect(computeTransportRecordFingerprint({ ...base, seq: base.seq + 1 })).not.toBe(computeTransportRecordFingerprint(base));
  });

  it("differs when the exact ts string differs, even by a single character", () => {
    expect(computeTransportRecordFingerprint({ ...base, ts: "2026-09-03T15:26:42.999602Z" })).not.toBe(computeTransportRecordFingerprint(base));
  });

  it("differs when from, sig, or text differs", () => {
    const fp = computeTransportRecordFingerprint(base);
    expect(computeTransportRecordFingerprint({ ...base, from: "did:key:z6MkOTHER" })).not.toBe(fp);
    expect(computeTransportRecordFingerprint({ ...base, sig: "sig-different" })).not.toBe(fp);
    expect(computeTransportRecordFingerprint({ ...base, text: "tclk1 {\"type\":\"cancel\"}" })).not.toBe(fp);
  });

  it("treats a string nonce and the equal numeric nonce as the same input, matching matchesArchivedFrame's own nonce comparison", () => {
    expect(computeTransportRecordFingerprint({ ...base, nonce: "123" })).toBe(computeTransportRecordFingerprint({ ...base, nonce: 123 }));
  });
});
