import { describe, expect, it } from "vitest";
import { matchesArchivedFrame, parseExportLines, type ExportedTclkRecord } from "../../lib/db/tclk-venue-timestamp-backfill.js";

const ARCHIVED = {
  seq: 10457,
  fromDid: "did:key:z6Mkn7LCcVgptpXz141Fk58UUhfho77Toer96cfqf3wVVxE4",
  line: "tclk1 {\"type\":\"offer\"}",
  transportSig: "sig-abc",
  transportNonce: "123",
};

function exportedRecord(overrides: Partial<ExportedTclkRecord> = {}): ExportedTclkRecord {
  return {
    seq: ARCHIVED.seq,
    ts: "2026-09-03T15:26:42.999601Z",
    from: ARCHIVED.fromDid,
    text: ARCHIVED.line,
    nonce: 123,
    sig: ARCHIVED.transportSig,
    ...overrides,
  };
}

describe("matchesArchivedFrame", () => {
  // G. Only an exact exported record match may populate a missing timestamp;
  // a mismatch on any signed field must not be accepted.
  it("matches when every signed field is identical", () => {
    expect(matchesArchivedFrame(ARCHIVED, exportedRecord())).toBe(true);
  });

  it("rejects a seq match with a different sender, text, signature, or nonce", () => {
    expect(matchesArchivedFrame(ARCHIVED, exportedRecord({ from: "did:key:z6MkOTHER" }))).toBe(false);
    expect(matchesArchivedFrame(ARCHIVED, exportedRecord({ text: "tclk1 {\"type\":\"cancel\"}" }))).toBe(false);
    expect(matchesArchivedFrame(ARCHIVED, exportedRecord({ sig: "sig-different" }))).toBe(false);
    expect(matchesArchivedFrame(ARCHIVED, exportedRecord({ nonce: 999 }))).toBe(false);
  });

  it("rejects a different seq entirely, even with everything else identical", () => {
    expect(matchesArchivedFrame(ARCHIVED, exportedRecord({ seq: ARCHIVED.seq + 1 }))).toBe(false);
  });

  it("compares nonce by value, tolerating string vs number encoding of the same nonce", () => {
    expect(matchesArchivedFrame(ARCHIVED, exportedRecord({ nonce: "123" }))).toBe(true);
  });
});

describe("parseExportLines", () => {
  it("parses one record per line from newline-delimited export text", () => {
    const raw = [
      JSON.stringify(exportedRecord({ seq: 1 })),
      JSON.stringify(exportedRecord({ seq: 2 })),
    ].join("\n");
    const records = parseExportLines(raw);
    expect(records.map((record) => record.seq)).toEqual([1, 2]);
  });

  it("skips blank and malformed lines instead of throwing", () => {
    const raw = [
      "",
      "not json at all",
      JSON.stringify(exportedRecord({ seq: 1 })),
      JSON.stringify({ seq: 2 /* missing required fields */ }),
      "   ",
    ].join("\n");
    const records = parseExportLines(raw);
    expect(records.map((record) => record.seq)).toEqual([1]);
  });
});
