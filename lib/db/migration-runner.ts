import { readFile } from "node:fs/promises";
import type { Pool } from "pg";

const MIGRATION_ID = "0001_trial1_foundation";
const MIGRATION_PATH = new URL("../../db/migrations/0001_trial1_foundation.sql", import.meta.url);

export async function runTrial1FoundationMigration(pool: Pool): Promise<"applied" | "already-applied"> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM schema_migrations WHERE id = $1",
      [MIGRATION_ID],
    );

    if (existing.rows.length > 0) {
      return "already-applied";
    }

    const sql = await readFile(MIGRATION_PATH, "utf8");
    await client.query(sql);
    return "applied";
  } finally {
    client.release();
  }
}
