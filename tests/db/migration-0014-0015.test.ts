import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");
const communication = readFileSync(new URL("../../db/migrations/0014_agent_communication.sql", import.meta.url), "utf8");
const authNonces = readFileSync(new URL("../../db/migrations/0015_agent_communication_auth_nonces.sql", import.meta.url), "utf8");

describe("migrations 0014-0015: signed agent communication", () => {
  it("creates rooms, membership and signed message storage without public capability execution", () => {
    expect(communication).toContain("CREATE TABLE agent_rooms");
    expect(communication).toContain("CREATE TABLE agent_room_members");
    expect(communication).toContain("CREATE TABLE agent_messages");
    expect(communication).toContain("sender_signature text NOT NULL");
    expect(communication).toContain("canonical_message text NOT NULL");
    expect(communication).toContain("message_hash text NOT NULL");
  });

  it("binds rooms and messages to existing agents with foreign keys", () => {
    expect(communication).toContain("created_by_agent_id uuid NOT NULL REFERENCES agents(id)");
    expect(communication).toContain("agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE");
    expect(communication).toContain("sender_agent_id uuid NOT NULL REFERENCES agents(id)");
  });

  it("enforces per-room sender nonce uniqueness for message replay protection", () => {
    expect(communication).toContain("UNIQUE (room_id, sender_agent_id, nonce)");
  });

  it("creates one-time signed action nonce storage", () => {
    expect(authNonces).toContain("CREATE TABLE agent_action_nonces");
    expect(authNonces).toContain("PRIMARY KEY (agent_id, nonce)");
    expect(authNonces).toContain("action text NOT NULL");
  });

  it("registers both migrations after Capability 7", () => {
    const c7 = runner.indexOf("0013_capability7_production_certification");
    const rooms = runner.indexOf("0014_agent_communication");
    const nonces = runner.indexOf("0015_agent_communication_auth_nonces");
    expect(c7).toBeGreaterThanOrEqual(0);
    expect(rooms).toBeGreaterThan(c7);
    expect(nonces).toBeGreaterThan(rooms);
  });

  it("keeps communication migrations additive", () => {
    for (const sql of [communication, authNonces]) {
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bDELETE\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    }
  });
});
