import { describe, expect, it } from "vitest";
import { parseVenueTimestampMs } from "../../lib/runtime/tclk-venue-timestamp.js";

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
