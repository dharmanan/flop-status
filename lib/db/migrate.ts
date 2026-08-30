import { readFile } from "node:fs/promises";
import { createPgPool } from "./pg-adapter.js";

const MIGRATION_ID = "0001_trial1_foundation";
const MIGRATION_PATH = new URL("../../db/migrations/0001_trial1_foundation.sql", import.meta.url);

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPgPool(connectionString);
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
      process.stdout.write(`${MIGRATION_ID}: already applied\n`);
      return;
    }

    const sql = await readFile(MIGRATION_PATH, "utf8");
    await client.query(sql);

    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [MIGRATION_ID]);
    process.stdout.write(`${MIGRATION_ID}: applied\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`migration failed: ${message}\n`);
  process.exitCode = 1;
});
