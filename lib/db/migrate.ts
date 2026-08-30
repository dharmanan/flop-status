import { runTrial1FoundationMigration } from "./migration-runner.js";
import { createPgPool } from "./pg-adapter.js";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPgPool(connectionString);
  try {
    const result = await runTrial1FoundationMigration(pool);
    process.stdout.write(`0001_trial1_foundation: ${result}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`migration failed: ${message}\n`);
  process.exitCode = 1;
});
