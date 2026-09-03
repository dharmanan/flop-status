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
  const frames = new Map<string, { venueTimestampMs: number | null; offerId: string }>();
  return {
    offers,
    frames,
    archivedSeqs: vi.fn(async (room: string, seqs: number[]) =>
      new Set(seqs.filter((seq) => frames.has(`${room}#${seq}`)))),
    offerExists: vi.fn(async (offerId: string) => offers.has(offerId)),
    createOffer: vi.fn(async (input: { offerId: string }) => { offers.add(input.offerId); }),
    offerIdForContract: vi.fn(async () => null),
    storeFrame: vi.fn(async (frame: { room: string; seq: number; offerId: string; venueTimestampMs: number | null }) => {
      if (!offers.has(frame.offerId)) throw new Error("violates foreign key constraint");
      frames.set(`${frame.room}#${frame.seq}`, frame);
    }),
    framesForOffer: vi.fn(async (offerId: string) => [...frames.values()].filter((frame) => frame.offerId === offerId)),
    updateState: vi.fn(async () => undefined),
    listOfferIdsForReconcile: vi.fn(async () => []),
    listContractsForSync: vi.fn(async () => []),
    listByDid: vi.fn(async () => []),
    getByOfferId: vi.fn(async () => null),
  };
}

function signedMessage(seq: number, line: string, identity: TestEd25519Identity, ts?: string): RawTclkMessage {
  const nonce = seq * 7;
  const signature = identity.sign(encoder.encode(`${ROOM}|${nonce}|${line}`));
  return { seq, from: identity.did, sig: encodeBase64Url(signature), nonce, text: line, ts };
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

  it("skips an orphan frame rather than losing the deal without a trace", async () => {
    const identity = generateTestEd25519Identity();
    const repository = fakeRepository();
    const acceptFrame = { type: "accept", ref: OFFER_ID, from: identity.did };
    const mcp = { call: vi.fn(async () => ({ ok: true, frame: acceptFrame })) };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, mcp as never);

    // The offer was never archived — exactly what happens when it rotates out of
    // Technocore's window before any sync runs.
    const archived = await service.ingestRoom(ROOM, [signedMessage(2, JSON.stringify(acceptFrame), identity)]);

    expect(archived).toBe(0);
    expect(repository.storeFrame).not.toHaveBeenCalled();
  });

  // F. A raw Technocore message with a valid `ts` stores its venue timestamp;
  // an invalid or missing one stores null rather than substituting anything.
  it("archives a message's Technocore venue timestamp, and stores null when it is missing or unparseable", async () => {
    const identity = generateTestEd25519Identity();
    const repository = fakeRepository();
    const offerFrame = { type: "offer", id: OFFER_ID, from: identity.did, amount: "5", asset: "FLOP" };
    const mcp = {
      call: vi.fn(async (tool: string) => tool === "tclk_decode"
        ? { ok: true, frame: offerFrame }
        : { status: "proposed", offerId: OFFER_ID }),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, mcp as never);

    await service.ingestRoom(ROOM, [signedMessage(1, JSON.stringify(offerFrame), identity, "2026-09-03T15:26:42.999601Z")]);
    expect(repository.frames.get(`${ROOM}#1`)?.venueTimestampMs).toBe(Date.parse("2026-09-03T15:26:42.999601Z"));

    await service.ingestRoom(ROOM, [signedMessage(2, JSON.stringify(offerFrame), identity, "not-a-timestamp")]);
    expect(repository.frames.get(`${ROOM}#2`)?.venueTimestampMs).toBeNull();

    await service.ingestRoom(ROOM, [signedMessage(3, JSON.stringify(offerFrame), identity)]);
    expect(repository.frames.get(`${ROOM}#3`)?.venueTimestampMs).toBeNull();
  });

  // Reconciliation must not persist a status when the archived frames cannot
  // all be evaluated at an authoritative venue timestamp.
  it("does not update the stored deal when historical reconstruction is incomplete", async () => {
    const identity = generateTestEd25519Identity();
    const repository = fakeRepository();
    const offerFrame = { type: "offer", id: OFFER_ID, from: identity.did, amount: "5", asset: "FLOP" };
    const mcp = { call: vi.fn(async () => ({ ok: true, frame: offerFrame })) };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, mcp as never);

    // No `ts` provided, so the archived offer frame has no venue timestamp.
    await service.ingestRoom(ROOM, [signedMessage(1, JSON.stringify(offerFrame), identity)]);
    expect(repository.updateState).not.toHaveBeenCalled();
  });
});
