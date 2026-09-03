import { describe, expect, it, vi } from "vitest";
import { TclkDealHistoryService, type RawTclkMessage } from "../../lib/runtime/tclk-deal-history-service.js";
import type { PgTclkDealHistoryRepository } from "../../lib/db/tclk-deal-history-repository.js";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { generateTestEd25519Identity, type TestEd25519Identity } from "../helpers/ed25519-fixtures.js";

const OFFER_ID = `0x${"a1".repeat(32)}`;
const ROOM = "tclk-offers";
const encoder = new TextEncoder();

function fakeRepository() {
  const offers = new Set<string>();
  const frames = new Map<string, unknown>();
  return {
    offers,
    frames,
    archivedSeqs: vi.fn(async (room: string, seqs: number[]) =>
      new Set(seqs.filter((seq) => frames.has(`${room}#${seq}`)))),
    offerExists: vi.fn(async (offerId: string) => offers.has(offerId)),
    createOffer: vi.fn(async (input: { offerId: string }) => { offers.add(input.offerId); }),
    offerIdForContract: vi.fn(async () => null),
    storeFrame: vi.fn(async (frame: { room: string; seq: number; offerId: string }) => {
      if (!offers.has(frame.offerId)) throw new Error("violates foreign key constraint");
      frames.set(`${frame.room}#${frame.seq}`, frame);
    }),
    transcriptLines: vi.fn(async () => ["line"]),
    updateState: vi.fn(async () => undefined),
    listOfferIdsForReconcile: vi.fn(async () => []),
    listContractsForSync: vi.fn(async () => []),
    listByDid: vi.fn(async () => []),
    getByOfferId: vi.fn(async () => null),
  };
}

function signedMessage(seq: number, line: string, identity: TestEd25519Identity): RawTclkMessage {
  const nonce = seq * 7;
  const signature = identity.sign(encoder.encode(`${ROOM}|${nonce}|${line}`));
  return { seq, from: identity.did, sig: encodeBase64Url(signature), nonce, text: line };
}

function decodeCount(mcp: { call: ReturnType<typeof vi.fn> }): number {
  return mcp.call.mock.calls.filter(([tool]) => tool === "tclk_decode").length;
}

describe("TclkDealHistoryService ingest", () => {
  it("skips records it has already archived instead of decoding them again", () => {
    const identity = generateTestEd25519Identity();
    const repository = fakeRepository();
    const offerFrame = { type: "offer", id: OFFER_ID, from: identity.did, amount: "5", asset: "FLOP" };
    const mcp = {
      call: vi.fn(async (tool: string) => tool === "tclk_decode"
        ? { ok: true, frame: offerFrame }
        : { status: "proposed", offerId: OFFER_ID }),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, mcp as never);
    const messages = [signedMessage(1, JSON.stringify(offerFrame), identity)];

    return service.ingestRoom(ROOM, messages).then(async (first) => {
      expect(first).toBe(1);
      const afterFirstPass = decodeCount(mcp);

      // A repeat sync must not re-decode what is already archived: long syncs are
      // what let Technocore rotate a record away before it reaches the archive.
      expect(await service.ingestRoom(ROOM, messages)).toBe(0);
      expect(decodeCount(mcp)).toBe(afterFirstPass);
    });
  });

  it("reports an orphan frame rather than losing the deal without a trace", async () => {
    const identity = generateTestEd25519Identity();
    const repository = fakeRepository();
    const acceptFrame = { type: "accept", ref: OFFER_ID, from: identity.did };
    const mcp = { call: vi.fn(async () => ({ ok: true, frame: acceptFrame })) };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, mcp as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // The offer was never archived — exactly what happens when it rotates out of
    // Technocore's window before any sync runs.
    const archived = await service.ingestRoom(ROOM, [signedMessage(2, JSON.stringify(acceptFrame), identity)]);

    expect(archived).toBe(0);
    expect(repository.storeFrame).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("orphan accept frame"));
    warn.mockRestore();
  });
});
