import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createPgPool } from "./pg-adapter.js";

function safeDatabaseName(): string {
  return `flop_acceptance_${randomBytes(6).toString("hex")}`;
}

function quotedIdentifier(value: string): string {
  if (!/^[a-z0-9_]+$/.test(value)) {
    throw new Error("unsafe temporary database identifier");
  }
  return `"${value}"`;
}

function databaseUrl(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

function startChild(script: string, env: NodeJS.ProcessEnv): {
  child: ChildProcess;
  output: () => string;
} {
  let combined = "";
  const child = spawn(process.execPath, [script], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => { combined += chunk.toString(); });
  child.stderr?.on("data", (chunk) => { combined += chunk.toString(); });
  return { child, output: () => combined };
}

async function waitForHttp(base: string, child: ChildProcess, output: () => string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`temporary app exited before readiness:\n${output()}`);
    }
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.status === 200) return;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`temporary app did not become ready:\n${output()}`);
}

async function waitForExit(child: ChildProcess, timeoutMs = 10_000): Promise<void> {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error("child process exit timeout")), timeoutMs)),
  ]);
}

async function runVerifier(env: NodeJS.ProcessEnv): Promise<string> {
  const run = startChild("dist/db/verify-write-http-railway.js", env);
  await waitForExit(run.child, 30_000);
  if (run.child.exitCode !== 0) {
    throw new Error(`clean database Trial 1 flow failed:\n${run.output()}`);
  }
  return run.output();
}

interface AcceptanceReport {
  temporaryEmptyDatabaseCreated: "PASS";
  migrationsFromZero: "PASS";
  trial1SeedExactlyOnce: "PASS";
  applicationStartupOnCleanDatabase: "PASS";
  persistentServerPublicKeyMetadata: "PASS";
  fullTrial1PassOnCleanDatabase: "PASS";
  publicReceiptVerificationOnCleanDatabase: "PASS";
  technocoreUnreachableDuringFullFlow: "PASS";
  manualDatabasePatchingRequired: "NO";
  productionDatabaseModifiedByAcceptanceFlow: "NO";
  temporaryDatabaseCleanup: "PASS";
}

async function main(): Promise<void> {
  const productionUrl = process.env.DATABASE_URL;
  if (!productionUrl) throw new Error("DATABASE_URL is required");
  if (!process.env.FLOP_ATTESTATION_KEY_ID || !process.env.FLOP_ATTESTATION_PRIVATE_KEY_PKCS8_B64URL) {
    throw new Error("persistent Railway attestation signer env is required");
  }

  const tempDatabase = safeDatabaseName();
  const adminPool = createPgPool(productionUrl);
  const tempUrl = databaseUrl(productionUrl, tempDatabase);
  const tempPort = 32000 + (randomBytes(2).readUInt16BE(0) % 20000);
  const base = `http://127.0.0.1:${tempPort}`;
  let app: ReturnType<typeof startChild> | null = null;
  let tempPool: ReturnType<typeof createPgPool> | null = null;
  let databaseCreated = false;
  let report: Omit<AcceptanceReport, "temporaryDatabaseCleanup"> | null = null;

  try {
    await adminPool.query(`CREATE DATABASE ${quotedIdentifier(tempDatabase)}`);
    databaseCreated = true;

    const isolatedEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: tempUrl,
      PORT: String(tempPort),
      // Deliberately unreachable. Core Trial 1 must not care whether a
      // Technocore-compatible service exists.
      TECHNOCORE_URL: "http://127.0.0.1:1",
      TECHNOCORE_DISABLED: "1",
    };

    app = startChild("dist/runtime/server.js", isolatedEnv);
    await waitForHttp(base, app.child, app.output);

    tempPool = createPgPool(tempUrl);
    const migrationRows = await tempPool.query<{ id: string }>(
      "SELECT id FROM schema_migrations ORDER BY id",
    );
    const migrationIds = migrationRows.rows.map((row) => row.id);
    const expectedMigrations = [
      "0001_trial1_foundation",
      "0002_trial1_submissions",
      "0003_trial1_receipts",
    ];
    if (JSON.stringify(migrationIds) !== JSON.stringify(expectedMigrations)) {
      throw new Error(`clean migration set mismatch: ${JSON.stringify(migrationIds)}`);
    }

    const seed = await tempPool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM trial_definitions
       WHERE trial_id = 'ed25519-signature-verification' AND trial_version = '1'`,
    );
    if (seed.rows[0]?.count !== "1") {
      throw new Error(`Trial 1 seed count is ${seed.rows[0]?.count ?? "missing"}, expected 1`);
    }

    const serverKey = await tempPool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM server_signing_keys WHERE key_id = $1",
      [process.env.FLOP_ATTESTATION_KEY_ID],
    );
    if (serverKey.rows[0]?.count !== "1") {
      throw new Error("persistent attestation public key metadata was not initialized exactly once");
    }

    const verifierOutput = await runVerifier(isolatedEnv);
    if (!verifierOutput.includes('"deterministicPassHttp": "PASS"')) {
      throw new Error(`full clean database flow did not report PASS:\n${verifierOutput}`);
    }

    const receiptCount = await tempPool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM receipts",
    );
    // The HTTP verifier cleans its temporary Trial 1 evidence after proving it,
    // so a clean acceptance database returns to zero user receipts.
    if (receiptCount.rows[0]?.count !== "0") {
      throw new Error("clean database verifier did not clean its temporary receipt evidence");
    }

    report = {
      temporaryEmptyDatabaseCreated: "PASS",
      migrationsFromZero: "PASS",
      trial1SeedExactlyOnce: "PASS",
      applicationStartupOnCleanDatabase: "PASS",
      persistentServerPublicKeyMetadata: "PASS",
      fullTrial1PassOnCleanDatabase: "PASS",
      publicReceiptVerificationOnCleanDatabase: "PASS",
      technocoreUnreachableDuringFullFlow: "PASS",
      manualDatabasePatchingRequired: "NO",
      productionDatabaseModifiedByAcceptanceFlow: "NO",
    };
  } finally {
    if (tempPool) await tempPool.end().catch(() => undefined);
    if (app && app.child.exitCode === null) {
      app.child.kill("SIGTERM");
      try { await waitForExit(app.child); } catch { app.child.kill("SIGKILL"); }
    }
    if (databaseCreated) {
      await adminPool.query(`DROP DATABASE ${quotedIdentifier(tempDatabase)} WITH (FORCE)`);
      const remaining = await adminPool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM pg_database WHERE datname = $1",
        [tempDatabase],
      );
      if (remaining.rows[0]?.count !== "0") {
        throw new Error("temporary acceptance database still exists after DROP DATABASE");
      }
    }
    await adminPool.end();
  }

  if (!report) {
    throw new Error("acceptance report missing after successful cleanup");
  }

  const finalReport: AcceptanceReport = {
    ...report,
    temporaryDatabaseCleanup: "PASS",
  };
  process.stdout.write(JSON.stringify(finalReport, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Clean DB / Technocore independence acceptance failed: ${message}\n`);
  process.exitCode = 1;
});
