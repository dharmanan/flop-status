import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_URL = new URL("../../db/migrations/0008_capability2_production_certification.sql", import.meta.url);
const sql = () => readFileSync(MIGRATION_URL, "utf8");

describe("migration 0008: production Capability 2 certification", () => {
  it("seeds the deterministic Canonical JSON + SHA256 module", () => {
    const text = sql();
    expect(text).toContain("canonical-json-sha256-browser");
    expect(text).toContain("data.canonical-json-sha256");
    expect(text).toContain("BROWSER_DETERMINISTIC");
    expect(text).toContain('"certificate_eligible":true');
  });

  it("uses a production certification trial distinct from historical Trial 2", () => {
    const text = sql();
    expect(text).toContain("canonical-json-sha256-certification");
    expect(text).toContain("canonical-json-sha256-verifier");
    expect(text).toContain("jcs-rfc8785-v1");
  });

  it("registers the migration id", () => {
    expect(sql()).toContain("0008_capability2_production_certification");
  });
});
