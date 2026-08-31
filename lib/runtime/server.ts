import { createServer } from "node:http";
import { PgChallengeStateRepository } from "../db/challenge-state-repository.js";
import { PgTrial1FinalizationRepository } from "../db/finalization-recovery-repository.js";
import { PgPublicAgentRepository } from "../db/public-agent-repository.js";
import { PgPublicVerificationRepository } from "../db/public-verification-repository.js";
import { ensureActiveServerSigningKey } from "../db/server-key-repository.js";
import { PgSubmissionRepository } from "../db/pg-adapter.js";
import { runMigrations } from "../db/migration-runner.js";
import { createPgPool, PgChallengeRepository } from "../db/pg-adapter.js";
import { loadAttestationSignerFromEnv } from "../receipts/attestation-signer.js";
import { PublicVerificationService } from "../verification/public-verification-service.js";
import { createRuntimeRequestHandler } from "./router.js";
import { Trial1ApiService } from "./trial1-api-service.js";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("PORT must be a valid TCP port");

  const pool = createPgPool(connectionString);
  const migrations = await runMigrations(pool);
  const signer = loadAttestationSignerFromEnv();
  await ensureActiveServerSigningKey(pool, signer, new Date().toISOString());

  const publicVerification = new PublicVerificationService(new PgPublicVerificationRepository(pool));
  const publicAgent = new PgPublicAgentRepository(pool);
  const trial1Api = new Trial1ApiService({
    challengeRepository: new PgChallengeRepository(pool),
    challengeStateRepository: new PgChallengeStateRepository(pool),
    submissionRepository: new PgSubmissionRepository(pool),
    finalizationRepository: new PgTrial1FinalizationRepository(pool),
    signer,
  });
  const server = createServer(createRuntimeRequestHandler({ publicVerification, publicAgent, trial1Api, health: migrations }));

  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`FLOP runtime listening on port ${port}\n`);
  });

  const shutdown = async (): Promise<void> => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`startup failed: ${message}\n`);
  process.exitCode = 1;
});
