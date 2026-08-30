import { describe, expect, it } from "vitest";
import {
  PostgresChallengeRepository,
  SQL,
  type QueryExecutor,
} from "../../lib/db/challenge-repository.js";
import type { AgentRow, TrialDefinitionRow } from "../../lib/db/types.js";

interface RecordedCall {
  text: string;
  params: readonly unknown[];
}

function createRecordingExecutor(responses: Record<string, unknown[]>): {
  executor: QueryExecutor;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const executor: QueryExecutor = {
    async query<Row>(text: string, params: readonly unknown[]) {
      calls.push({ text, params });
      const rows = (responses[text] ?? []) as Row[];
      return { rows };
    },
  };
  return { executor, calls };
}

describe("PostgresChallengeRepository SQL parameterization", () => {
  it("never splices agentId/trialDefinitionId values into the advisory-lock SQL text", async () => {
    const agentId = "11111111-1111-1111-1111-111111111111";
    const trialDefinitionId = "22222222-2222-2222-2222-222222222222";
    const { executor, calls } = createRecordingExecutor({});

    const repository = new PostgresChallengeRepository(executor);
    await repository.withAgentTrialLock(agentId, trialDefinitionId, async () => "done");

    const lockCall = calls.find((call) => call.text === SQL.ADVISORY_LOCK);
    expect(lockCall).toBeDefined();
    expect(lockCall?.text).not.toContain(agentId);
    expect(lockCall?.text).not.toContain(trialDefinitionId);
    expect(lockCall?.text).toContain("$1");
    expect(lockCall?.text).toContain("$2");
    expect(lockCall?.params).toEqual([agentId, trialDefinitionId]);
  });

  it("wraps the locked section in BEGIN/COMMIT and rolls back on error", async () => {
    const { executor, calls } = createRecordingExecutor({});
    const repository = new PostgresChallengeRepository(executor);

    await repository.withAgentTrialLock("a", "b", async () => "ok");
    expect(calls.map((call) => call.text)).toEqual([SQL.BEGIN, SQL.ADVISORY_LOCK, SQL.COMMIT]);

    calls.length = 0;
    await expect(
      repository.withAgentTrialLock("a", "b", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(calls.map((call) => call.text)).toEqual([SQL.BEGIN, SQL.ADVISORY_LOCK, SQL.ROLLBACK]);
  });

  it("passes a value that looks like a SQL injection attempt only as a parameter, never interpolated", async () => {
    const suspiciousDid = "did:key:z' OR '1'='1'; DROP TABLE agents; --";
    const agentRow: AgentRow = {
      id: "agent-1",
      did: suspiciousDid,
      didMethod: "key",
      keyType: "Ed25519",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
    };
    const { executor, calls } = createRecordingExecutor({
      [SQL.FIND_OR_CREATE_AGENT]: [agentRow],
    });
    const repository = new PostgresChallengeRepository(executor);

    const result = await repository.findOrCreateAgentByDid(suspiciousDid, "key", "Ed25519");

    expect(result).toEqual(agentRow);
    const call = calls[0];
    expect(call?.text).not.toContain(suspiciousDid);
    expect(call?.text).not.toContain("DROP TABLE");
    expect(call?.params).toEqual([suspiciousDid, "key", "Ed25519"]);
  });

  it("finds an active trial definition using parameterized values, never string interpolation", async () => {
    const trialDefinitionRow: TrialDefinitionRow = {
      id: "trial-def-1",
      trialId: "ed25519-signature-verification",
      trialVersion: "1",
      capabilityId: "cryptography.signature-verification",
      verifierId: "ed25519-signature-verifier",
      verifierVersion: "1",
      canonicalizationId: "jcs-rfc8785-v1",
      definition: {},
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const { executor, calls } = createRecordingExecutor({
      [SQL.FIND_ACTIVE_TRIAL_DEFINITION]: [trialDefinitionRow],
    });
    const repository = new PostgresChallengeRepository(executor);

    const found = await repository.findActiveTrialDefinition("ed25519-signature-verification", "1");

    expect(found).toEqual(trialDefinitionRow);
    expect(calls[0]?.text).toContain("$1");
    expect(calls[0]?.text).toContain("$2");
    expect(calls[0]?.params).toEqual(["ed25519-signature-verification", "1"]);
  });

  it("returns null instead of throwing when no active trial definition row exists", async () => {
    const { executor } = createRecordingExecutor({});
    const repository = new PostgresChallengeRepository(executor);

    const found = await repository.findActiveTrialDefinition("unknown-trial", "1");
    expect(found).toBeNull();
  });
});
