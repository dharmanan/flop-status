import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../db/migrations/0016_agent_direct_mailbox.sql", import.meta.url), "utf8");
const runner = readFileSync(new URL("../../lib/db/migration-runner.ts", import.meta.url), "utf8");

describe("migration 0016: direct DID mailbox", () => {
  it("creates a direct message table independent of rooms", () => {
    expect(sql).toContain("CREATE TABLE agent_direct_messages");
    expect(sql).toContain("sender_agent_id");
    expect(sql).toContain("recipient_agent_id");
    expect(sql).not.toContain("room_id");
  });
  it("stores signed deterministic message evidence", () => {
    expect(sql).toContain("canonical_message");
    expect(sql).toContain("sender_signature");
    expect(sql).toContain("message_hash");
  });
  it("indexes recipient and sender mailboxes", () => {
    expect(sql).toContain("idx_agent_direct_messages_recipient");
    expect(sql).toContain("idx_agent_direct_messages_sender");
  });
  it("is append-only and wired into the migration runner", () => {
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b/i);
    expect(sql).toContain("0016_agent_direct_mailbox");
    expect(runner).toContain("0016_agent_direct_mailbox");
  });
});
