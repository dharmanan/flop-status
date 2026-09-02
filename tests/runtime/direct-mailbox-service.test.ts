import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeBase58btc } from "../../lib/crypto/base58.js";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { canonicalizeJsonToBytes } from "../../lib/crypto/canonical-json.js";
import { DirectMailboxService } from "../../lib/runtime/direct-mailbox-service.js";

function agent() {
  const pair = generateKeyPairSync("ed25519");
  const jwk = pair.publicKey.export({ format: "jwk" }) as { x: string };
  const raw = Buffer.from(jwk.x, "base64url");
  const prefixed = new Uint8Array(34);
  prefixed.set([0xed, 0x01], 0);
  prefixed.set(raw, 2);
  const did = `did:key:z${encodeBase58btc(prefixed)}`;
  return { did, sign(payload: unknown) { return encodeBase64Url(new Uint8Array(sign(null, Buffer.from(canonicalizeJsonToBytes(payload)), pair.privateKey))); } };
}
function envelope(a: ReturnType<typeof agent>, payload: Record<string, unknown>) {
  return { payload, signature: { algorithm: "Ed25519", encoding: "base64url", value: a.sign(payload) } };
}
class Repo {
  consumed = new Set<string>();
  items: any[] = [];
  async consumeActionNonce(did: string, nonce: string) { const key = `${did}:${nonce}`; if (this.consumed.has(key)) return false; this.consumed.add(key); return true; }
  async insertDirectMessage(input: any) { const row = { id: crypto.randomUUID(), ...input, storedAt: input.sentAt }; this.items.push(row); return row; }
  async listInbox(did: string) { return this.items.filter((m) => m.recipientDid === did); }
  async listSent(did: string) { return this.items.filter((m) => m.senderDid === did); }
}

describe("DirectMailboxService", () => {
  it("delivers a signed message directly to recipient DID without a room", async () => {
    const repo = new Repo(); const service = new DirectMailboxService(repo as any); const sender = agent(); const recipient = agent();
    const payload = { version: "1", action: "SEND_DIRECT_MESSAGE", actor_did: sender.did, nonce: crypto.randomUUID(), issued_at: new Date().toISOString(), recipient_did: recipient.did, text: " hello direct agent " };
    const result = await service.send(envelope(sender, payload));
    expect(result.message.senderDid).toBe(sender.did);
    expect(result.message.recipientDid).toBe(recipient.did);
    expect(result.message.cleanedText).toBe("hello direct agent");
    expect(result.message.canonicalMessage).toBe(`mailbox:${recipient.did}|${payload.nonce}|hello direct agent`);
    expect(result.verification.delivery).toBe("STORED_FOR_RECIPIENT_DID");
  });

  it("returns the message in recipient inbox and sender sent mailbox", async () => {
    const repo = new Repo(); const service = new DirectMailboxService(repo as any); const sender = agent(); const recipient = agent();
    const sendPayload = { version: "1", action: "SEND_DIRECT_MESSAGE", actor_did: sender.did, nonce: crypto.randomUUID(), issued_at: new Date().toISOString(), recipient_did: recipient.did, text: "mailbox test" };
    await service.send(envelope(sender, sendPayload));
    const inboxPayload = { version: "1", action: "LIST_DIRECT_INBOX", actor_did: recipient.did, nonce: crypto.randomUUID(), issued_at: new Date().toISOString() };
    const sentPayload = { version: "1", action: "LIST_DIRECT_SENT", actor_did: sender.did, nonce: crypto.randomUUID(), issued_at: new Date().toISOString() };
    expect((await service.inbox(envelope(recipient, inboxPayload))).messages).toHaveLength(1);
    expect((await service.sent(envelope(sender, sentPayload))).messages).toHaveLength(1);
  });

  it("rejects a signature from a different DID", async () => {
    const repo = new Repo(); const service = new DirectMailboxService(repo as any); const sender = agent(); const other = agent(); const recipient = agent();
    const payload = { version: "1", action: "SEND_DIRECT_MESSAGE", actor_did: sender.did, nonce: crypto.randomUUID(), issued_at: new Date().toISOString(), recipient_did: recipient.did, text: "forged" };
    await expect(service.send(envelope(other, payload))).rejects.toMatchObject({ code: "INVALID_MAILBOX_SIGNATURE" });
  });

  it("rejects replay of the same signed mailbox action", async () => {
    const repo = new Repo(); const service = new DirectMailboxService(repo as any); const sender = agent(); const recipient = agent();
    const payload = { version: "1", action: "SEND_DIRECT_MESSAGE", actor_did: sender.did, nonce: crypto.randomUUID(), issued_at: new Date().toISOString(), recipient_did: recipient.did, text: "once" };
    const signed = envelope(sender, payload); await service.send(signed);
    await expect(service.send(signed)).rejects.toMatchObject({ code: "MAILBOX_REPLAY" });
  });
});
