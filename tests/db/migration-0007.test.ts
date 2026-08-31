import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_URL = new URL("../../db/migrations/0007_capability1_production_certification.sql", import.meta.url);
const sql = () => readFileSync(MIGRATION_URL, "utf8");

describe("migration 0007: production Capability 1 certification", () => {
  it("creates explicit capability installation and certificate state", () => {
    const text = sql();
    expect(text).toContain("CREATE TABLE capability_modules");
    expect(text).toContain("CREATE TABLE agent_capability_installations");
    expect(text).toContain("CREATE TABLE capability_certificates");
  });

  it("seeds the browser deterministic Capability 1 module", () => {
    const text = sql();
    expect(text).toContain("ed25519-signature-verification-browser");
    expect(text).toContain("BROWSER_DETERMINISTIC");
    expect(text).toContain('"certificate_eligible":true');
  });

  it("uses a production certification trial distinct from historical Trial 1", () => {
    const text = sql();
    expect(text).toContain("ed25519-signature-verification-certification");
    expect(text).toContain("cryptography.signature-verification");
  });

  it("registers the migration id", () => {
    expect(sql()).toContain("0007_capability1_production_certification");
  });
});
