import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
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
import { PgTclkDealHistoryRepository } from "../db/tclk-deal-history-repository.js";
import { loadAttestationSignerFromEnv } from "../receipts/attestation-signer.js";
import { PublicVerificationService } from "../verification/public-verification-service.js";
import { AgentProfileService } from "./agent-profile-service.js";
import { createAgentProfileAwareHandler } from "./agent-profile-router.js";
import { CapabilityProductService } from "./capability-product-service.js";
import { CommunicationService } from "./communication-service.js";
import { DirectMailboxService } from "./direct-mailbox-service.js";
import { createDirectMailboxAwareHandler } from "./direct-mailbox-router.js";
import { createRuntimeRequestHandler } from "./router.js";
import { TclkDealHistoryService } from "./tclk-deal-history-service.js";
import { TclkMcpClient } from "./tclk-mcp-client.js";
import { createTclkMcpHttpHandler, INTERNAL_MCP_TOKEN_HEADER } from "./tclk-mcp-http.js";
import { TclkPaperRailAdapter } from "./tclk-paper-rail.js";
import { createTclkAwareHandler } from "./tclk-router.js";
import { Trial1ApiService } from "./trial1-api-service.js";

// Attaches the per-process internal MCP token to a loopback request without
// disturbing any header the caller already set. Used only for the in-process
// TclkMcpClient below — every other outbound fetch in this process is
// unaffected.
function withInternalMcpToken(fetchImpl: typeof fetch, token: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(INTERNAL_MCP_TOKEN_HEADER, token);
    return fetchImpl(input, { ...init, headers });
  };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("PORT must be a valid TCP port");
  // Authenticates the embedded /mcp route (same public listener, see below)
  // against direct external calls. Generated fresh per process, kept only in
  // memory, never logged, never persisted, and never sourced from env.
  const internalMcpToken = randomBytes(32).toString("base64url");

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
  // The embedded /mcp route below serves the same process this client calls,
  // so TclkMcpClient targets this server's own loopback address rather than
  // a remote TCLK_MCP_URL — there is no separate MCP service to configure.
  // The wrapped fetch attaches the internal token so this loopback call
  // authenticates the same way any other caller of /mcp would have to.
  const tclkMcp = new TclkMcpClient(`http://127.0.0.1:${port}/mcp`, withInternalMcpToken(fetch, internalMcpToken));
  const tclkPaper = new TclkPaperRailAdapter(tclkMcp);
  const tclkHistory = new TclkDealHistoryService(new PgTclkDealHistoryRepository(pool), tclkMcp);
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
  const tclkHandler = createTclkAwareHandler(profileHandler, tclkMcp, tclkPaper, tclkHistory);
  const server = createServer(createTclkMcpHttpHandler(tclkHandler, { internalToken: internalMcpToken }));

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
