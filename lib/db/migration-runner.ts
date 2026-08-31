import { readFile } from "node:fs/promises";
import type { Pool, PoolClient } from "pg";

const MIGRATION_LOCK_KEY = "flop:migrations";
const FOUNDATION_MIGRATION_ID = "0001_trial1_foundation";
const MIGRATIONS = [
  {
    id: FOUNDATION_MIGRATION_ID,
    path: new URL("../../db/migrations/0001_trial1_foundation.sql", import.meta.url),
  },
  {
    id: "0002_trial1_submissions",
    path: new URL("../../db/migrations/0002_trial1_submissions.sql", import.meta.url),
  },
  {
    id: "0003_trial1_receipts",
    path: new URL("../../db/migrations/0003_trial1_receipts.sql", import.meta.url),
  },
  {
    id: "0004_trial2_canonical_json_sha256",
    path: new URL("../../db/migrations/0004_trial2_canonical_json_sha256.sql", import.meta.url),
  },
] as const;

export interface MigrationResult {
  id: string;
  status: "applied" | "already-applied";
}

async function backfillLegacyFoundationMarker(client: PoolClient): Promise<void> {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM schema_migrations WHERE id = $1",
    [FOUNDATION_MIGRATION_ID],
  );
  if (existing.rows.length > 0) {
    return;
  }

  const legacy = await client.query<{ foundation_present: boolean }>(`
    SELECT
      to_regclass('public.agents') IS NOT NULL
      AND to_regclass('public.capabilities') IS NOT NULL
      AND to_regclass('public.trial_definitions') IS NOT NULL
      AND to_regclass('public.challenge_instances') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'challenge_state'
      ) AS foundation_present
  `);

  if (legacy.rows[0]?.foundation_present === true) {
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
      FOUNDATION_MIGRATION_ID,
    ]);
  }
}

export async function runMigrations(pool: Pool): Promise<MigrationResult[]> {
  const client = await pool.connect();
  let locked = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [MIGRATION_LOCK_KEY]);
    locked = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await backfillLegacyFoundationMarker(client);

    const results: MigrationResult[] = [];
    for (const migration of MIGRATIONS) {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM schema_migrations WHERE id = $1",
        [migration.id],
      );
      if (existing.rows.length > 0) {
        results.push({ id: migration.id, status: "already-applied" });
        continue;
      }

      const sql = await readFile(migration.path, "utf8");
      await client.query(sql);
      // Some historical migrations self-register inside their transaction.
      // ON CONFLICT keeps the runner compatible with both styles.
      await client.query(
        "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
        [migration.id],
      );
      results.push({ id: migration.id, status: "applied" });
    }

    return results;
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
          MIGRATION_LOCK_KEY,
        ]);
      } finally {
        client.release();
      }
    } else {
      client.release();
    }
  }
}

export async function runTrial1FoundationMigration(
  pool: Pool,
): Promise<"applied" | "already-applied"> {
  const results = await runMigrations(pool);
  const foundation = results.find((result) => result.id === FOUNDATION_MIGRATION_ID);
  if (!foundation) {
    throw new Error("foundation migration result missing");
  }
  return foundation.status;
}
