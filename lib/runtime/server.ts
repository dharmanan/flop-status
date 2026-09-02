import { createServer } from "node:http";
import { PgAgentProfileRepository } from "../db/agent-profile-repository.js";
import { PgChallengeStateRepository } from "../db/challenge-state-repository.js";
import { PgCertificationRepository } from "../db/certification-repository.js";
import { PgCommunicationRepository } from "../db/communication-repository.js";
import { PgDirectMailboxRepository } from "../db/direct-mailbox-repository.js";
import { PgTrial1FinalizationRepository } from "../db/finalization-recovery-repository.js";
import { PgPublicAgentRepository } from "../db/public-agent-repository.js";
import { PgPublicVerificationRepository } from "../db/public-verification-repository.js";
import { ensureActiveServerSigningKey } from "../db/server-key-repository.js";
import { PgSubmissionRepository } from "../db/pg-adapter.js";
import { runMigrations } from "../db/migration-runner.js";
import { createPgPool, PgChallengeRepository } from "../db/pg-adapter.js";
import { loadAttestationSignerFromEnv } from "../receipts/attestation-signer.js";
import { PublicVerificationService } from "../verification/public-verification-service.js";
import { AgentProfileService } from "./agent-profile-service.js";
import { createAgentProfileAwareHandler } from "./agent-profile-router.js";
import { CapabilityProductService } from "./capability-product-service.js";
import { CommunicationService } from "./communication-service.js";
import { DirectMailboxService } from "./direct-mailbox-service.js";
import { createDirectMailboxAwareHandler } from "./direct-mailbox-router.js";
import { createRuntimeRequestHandler } from "./router.js";
import { createTclkAwareHandler } from "./tclk-router.js";
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
  const capabilityProduct = new CapabilityProductService(new PgCertificationRepository(pool));
  const communication = new CommunicationService(new PgCommunicationRepository(pool));
  const mailbox = new DirectMailboxService(new PgDirectMailboxRepository(pool));
  const profiles = new AgentProfileService(new PgAgentProfileRepository(pool));
  const trial1Api = new Trial1ApiService({
    challengeRepository: new PgChallengeRepository(pool),
    challengeStateRepository: new PgChallengeStateRepository(pool),
    submissionRepository: new PgSubmissionRepository(pool),
    finalizationRepository: new PgTrial1FinalizationRepository(pool),
    signer,
    capabilityProduct,
  });
  const runtimeHandler = createRuntimeRequestHandler({
    publicVerification,
    publicAgent,
    trial1Api,
    capabilityProduct,
    communication,
    health: migrations,
  });
  const mailboxHandler = createDirectMailboxAwareHandler(runtimeHandler, mailbox);
  const profileHandler = createAgentProfileAwareHandler(mailboxHandler, profiles);
  const server = createServer(createTclkAwareHandler(profileHandler));

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
