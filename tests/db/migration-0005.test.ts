import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_URL = new URL("../../db/migrations/0005_trial3_technocore_canonical_message.sql", import.meta.url);
const sql = () => readFileSync(MIGRATION_URL, "utf8");

describe("migration 0005: Trial 3 metadata", () => {
  it("seeds the Trial 3 capability and trial definition", () => {
    const text = sql();
    expect(text).toContain("protocol.technocore-canonical-message");
    expect(text).toContain("technocore-canonical-message-verifier");
    expect(text).toContain("'technocore-canonical-message'");
    expect(text).toContain("'jcs-rfc8785-v1'");
  });

  it("records the exact reference canonical form without adding DID to it", () => {
    const text = sql();
    expect(text).toContain('"reference_payload":"room|nonce|cleaned text"');
    expect(text).not.toContain("room|nonce|did");
  });

  it("registers the migration id", () => {
    expect(sql()).toContain("0005_trial3_technocore_canonical_message");
  });
});
