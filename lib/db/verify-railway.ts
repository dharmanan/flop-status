import { generateKeyPairSync } from "node:crypto";
import { ActiveChallengeExistsError, issueEd25519SignatureChallenge } from "../challenges/issuance-service.js";
import { encodeBase58btc } from "../crypto/base58.js";
import { decodeBase64Url } from "../crypto/base64url.js";
import { runTrial1FoundationMigration } from "./migration-runner.js";
import { createPgPool, PgChallengeRepository } from "./pg-adapter.js";

function generateRequesterDid(): string {
  const { publicKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" }) as { x: string };
  const rawPublicKey = decodeBase64Url(jwk.x);
  const multicodec = new Uint8Array(2 + rawPublicKey.length);
  multicodec.set([0xed, 0x01], 0);
  multicodec.set(rawPublicKey, 2);
  return `did:key:z${encodeBase58btc(multicodec)}`;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPgPool(connectionString);
  const repository = new PgChallengeRepository(pool);
  const agentDid = generateRequesterDid();

  try {
    const migration = await runTrial1FoundationMigration(pool);

    const attempts = await Promise.allSettled([
      issueEd25519SignatureChallenge({ agentDid }, { repository }),
      issueEd25519SignatureChallenge({ agentDid }, { repository }),
    ]);

    const fulfilled = attempts.filter(
      (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof issueEd25519SignatureChallenge>>> =>
        attempt.status === "fulfilled",
    );
    const rejected = attempts.filter(
      (attempt): attempt is PromiseRejectedResult => attempt.status === "rejected",
    );

    if (fulfilled.length !== 1 || rejected.length !== 1) {
      throw new Error(
        `expected exactly one successful and one rejected concurrent issuance, got ${fulfilled.length} success / ${rejected.length} rejected`,
      );
    }

    if (!(rejected[0]!.reason instanceof ActiveChallengeExistsError)) {
      throw rejected[0]!.reason;
    }

    const countResult = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM challenge_instances ci
       JOIN agents a ON a.id = ci.agent_id
       WHERE a.did = $1 AND ci.state = 'ISSUED'`,
      [agentDid],
    );

    if (Number(countResult.rows[0]?.count ?? "0") !== 1) {
      throw new Error("database invariant failed: expected exactly one ISSUED challenge");
    }

    const hiddenLeak = Object.hasOwn(fulfilled[0]!.value, "hiddenContext");
    if (hiddenLeak) {
      throw new Error("public issuance result leaked hiddenContext");
    }

    process.stdout.write(
      JSON.stringify(
        {
          migration,
          concurrentIssuance: "PASS",
          oneIssuedChallengeInvariant: "PASS",
          hiddenContextPublicLeak: "PASS",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    try {
      await pool.query(
        `DELETE FROM challenge_instances
         WHERE agent_id IN (SELECT id FROM agents WHERE did = $1)`,
        [agentDid],
      );
      await pool.query("DELETE FROM agents WHERE did = $1", [agentDid]);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Railway PostgreSQL verification failed: ${message}\n`);
  process.exitCode = 1;
});
