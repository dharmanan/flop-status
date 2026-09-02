import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");

const MIGRATIONS = [
  {
    id: "0008_capability2_production_certification",
    ordinal: 2,
    moduleId: "canonical-json-sha256-browser",
    capabilityId: "data.canonical-json-sha256",
    productionTrialId: "canonical-json-sha256-certification",
    historicalTrialId: "canonical-json-sha256",
    sequence: 2,
  },
  {
    id: "0009_capability3_production_certification",
    ordinal: 3,
    moduleId: "technocore-canonical-message-browser",
    capabilityId: "protocol.technocore-canonical-message",
    productionTrialId: "technocore-canonical-message-certification",
    historicalTrialId: "technocore-canonical-message",
    sequence: 3,
  },
  {
    id: "0010_capability4_production_certification",
    ordinal: 4,
    moduleId: "signed-receipt-verification-browser",
    capabilityId: "evidence.signed-receipt-verification",
    productionTrialId: "signed-receipt-verification-certification",
    historicalTrialId: "signed-receipt-verification",
    sequence: 4,
  },
];

function sqlFor(id: string): string {
  return readFileSync(new URL(`../../db/migrations/${id}.sql`, import.meta.url), "utf8");
}

describe("migrations 0008-0010: production Capability 2-4 certification", () => {
  for (const migration of MIGRATIONS) {
    describe(`${migration.id} (Capability ${migration.ordinal})`, () => {
      it("seeds the browser deterministic capability module", () => {
        const sql = sqlFor(migration.id);
        expect(sql).toContain("INSERT INTO capability_modules");
        expect(sql).toContain(migration.moduleId);
        expect(sql).toContain("BROWSER_DETERMINISTIC");
        expect(sql).toContain('"certificate_eligible":true');
        expect(sql).toContain('"llm_required":false');
      });

      it("registers a production certification trial distinct from the historical trial", () => {
        const sql = sqlFor(migration.id);
        expect(sql).toContain(migration.productionTrialId);
        expect(sql).toContain(migration.capabilityId);
        expect(sql).not.toMatch(new RegExp(`'${migration.historicalTrialId}',\\s*\\n\\s*'1',`));
      });

      it("records its program sequence number as durable metadata, matching the 0008 convention", () => {
        const sql = sqlFor(migration.id);
        expect(sql).toContain(`"sequence":${migration.sequence}`);
      });

      it("is append-only: it does not alter or delete existing definitions", () => {
        const sql = sqlFor(migration.id);
        expect(sql).not.toMatch(/\bDELETE\b/i);
        expect(sql).not.toMatch(/\bDROP\b/i);
        expect(sql).not.toMatch(/\bUPDATE\s+trial_definitions\b/i);
        expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i);
      });

      it("registers its own migration id and is wired into the runner", () => {
        expect(sqlFor(migration.id)).toContain(migration.id);
        expect(runner).toContain(migration.id);
      });
    });
  }

  it("keeps the migration list in append-only order", () => {
    const ids = [...runner.matchAll(/db\/migrations\/(\d{4}_[a-z0-9_]+)\.sql/g)].map((match) => match[1]);
    expect(ids).toEqual([
      "0001_trial1_foundation",
      "0002_trial1_submissions",
      "0003_trial1_receipts",
      "0004_trial2_canonical_json_sha256",
      "0005_trial3_technocore_canonical_message",
      "0006_trial4_signed_receipt_verification",
      "0007_capability1_production_certification",
      "0008_capability2_production_certification",
      "0009_capability3_production_certification",
      "0010_capability4_production_certification",
      "0011_capability5_production_certification",
      "0012_capability6_production_certification",
      "0013_capability7_production_certification",
      "0014_agent_communication",
      "0015_agent_communication_auth_nonces",
      "0016_agent_direct_mailbox",
      "0017_agent_profiles",
      "0018_tclk_deal_history",
    ]);
  });

  it("leaves the historical trial migrations unchanged", () => {
    expect(sqlFor("0004_trial2_canonical_json_sha256")).not.toContain("certification");
    expect(sqlFor("0005_trial3_technocore_canonical_message")).not.toContain("certification");
    expect(sqlFor("0006_trial4_signed_receipt_verification")).not.toContain("certification");
  });
});
