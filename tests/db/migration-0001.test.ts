import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_URL = new URL("../../db/migrations/0001_trial1_foundation.sql", import.meta.url);

function readMigration(): string {
  return readFileSync(MIGRATION_URL, "utf8");
}

// This only checks the migration file's text, not real PostgreSQL behavior —
// there is no database driver or live instance in this checkpoint. See the
// final report for what remains NOT YET VERIFIED AGAINST REAL POSTGRESQL.
describe("migration 0001: one-active-challenge partial unique index", () => {
  it("creates a UNIQUE partial index on (agent_id, trial_definition_id) WHERE state = 'ISSUED'", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+idx_challenges_one_active_per_agent_trial\s+ON\s+challenge_instances\s*\(\s*agent_id\s*,\s*trial_definition_id\s*\)\s*WHERE\s+state\s*=\s*'ISSUED'/i,
    );
  });

  it("keeps the partial predicate immutable: no now() or expires_at in the index definition", () => {
    const sql = readMigration();
    const statementMatch = sql.match(
      /CREATE UNIQUE INDEX\s+idx_challenges_one_active_per_agent_trial[\s\S]*?;/i,
    );

    expect(statementMatch).not.toBeNull();
    const statement = (statementMatch as RegExpMatchArray)[0].toLowerCase();
    expect(statement).not.toContain("now(");
    expect(statement).not.toContain("expires_at");
  });

  it("declares the index after the table it targets exists", () => {
    const sql = readMigration();
    const tableIndex = sql.indexOf("CREATE TABLE challenge_instances");
    const uniqueIndexIndex = sql.indexOf("CREATE UNIQUE INDEX idx_challenges_one_active_per_agent_trial");

    expect(tableIndex).toBeGreaterThan(-1);
    expect(uniqueIndexIndex).toBeGreaterThan(tableIndex);
  });
});
