import { describe, expect, it, vi } from "vitest";
import { makeOffer, makeAccept, generateHashLock, type CancelFrame, type LockFrame, type ReceiptFrame, type RevealFrame } from "@flop-labs/tclk";
import { TclkDealHistoryService, type RawTclkMessage } from "../../lib/runtime/tclk-deal-history-service.js";
import type { ArchivedTclkDeal, ArchivedTclkFrame, PgTclkDealHistoryRepository } from "../../lib/db/tclk-deal-history-repository.js";
import { encodeBase64Url } from "../../lib/crypto/base64url.js";
import { generateTestEd25519Identity, type TestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import { archivedFrame, dealRoomFor } from "../helpers/tclk-fixtures.js";

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

describe("TclkDealHistoryService.getByOfferId", () => {
  // B. The confirmed 1043 PAPER chronology, exposed through the same
  // history-detail path the browser's archived-deal recovery now depends on.
  // historicalReplay must be the SAME replayArchivedFrames() result
  // reconcileOffer() already computes, not a second, independent calculation
  // — and the existing `deal`/`frames` fields must stay unchanged (additive).
  it("attaches a complete historicalReplay (status CLAIMED) computed by the same replayArchivedFrames used for reconciliation", async () => {
    const payer = generateTestEd25519Identity();
    const payee = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T15:26:42.999601Z");
    const acceptTs = Date.parse("2026-09-03T15:27:21.234339Z");
    const lockTs = Date.parse("2026-09-03T15:28:31.260255Z");
    const revealTs = Date.parse("2026-09-03T15:29:30.323288Z");
    const receipt1Ts = Date.parse("2026-09-03T15:30:21.308306Z");
    const receipt2Ts = Date.parse("2026-09-03T15:31:21.249814Z");
    const lateCancelTs = Date.parse("2026-09-03T18:44:50.276806Z");

    const offer = makeOffer({
      from: payer.did,
      role: "payer",
      amount: "1043",
      asset: "PAPER",
      lock: "hash",
      rails: ["paper"],
      claimByMs: offerTs + 30 * 60_000,
      refundAfterMs: offerTs + 60 * 60_000,
      expiresMs: offerTs + 10 * 60_000,
    });
    const { preimage, hash } = generateHashLock();
    const accept = makeAccept(offer, { from: payee.did, statement: hash });
    const contract = accept.contract;
    const room = dealRoomFor(contract);

    const lock: LockFrame = { type: "lock", from: payer.did, contract, rail: "paper", ref: contract };
    const reveal: RevealFrame = { type: "reveal", from: payee.did, contract, secret: preimage };
    const receiptPayer: ReceiptFrame = { type: "receipt", from: payer.did, contract, outcome: "claimed" };
    const receiptPayee: ReceiptFrame = { type: "receipt", from: payee.did, contract, outcome: "claimed" };
    // The confirmed bug: this cancel names the OFFER id, not the accepted
    // contract id, and arrives long after the deal already completed.
    const lateCancel: CancelFrame = { type: "cancel", from: payer.did, contract: offer.id, reason: "late, wrong contract" };

    const frames = [
      archivedFrame({ room: ROOM, seq: 10457, offerId: offer.id, tclkFrame: offer, venueTimestampMs: offerTs }),
      archivedFrame({ room: ROOM, seq: 10460, offerId: offer.id, tclkFrame: accept, venueTimestampMs: acceptTs }),
      archivedFrame({ room, seq: 1, offerId: offer.id, tclkFrame: lock, venueTimestampMs: lockTs }),
      archivedFrame({ room, seq: 2, offerId: offer.id, tclkFrame: reveal, venueTimestampMs: revealTs }),
      archivedFrame({ room, seq: 3, offerId: offer.id, tclkFrame: receiptPayer, venueTimestampMs: receipt1Ts }),
      archivedFrame({ room, seq: 4, offerId: offer.id, tclkFrame: receiptPayee, venueTimestampMs: receipt2Ts }),
      archivedFrame({ room: ROOM, seq: 13562, offerId: offer.id, tclkFrame: lateCancel, venueTimestampMs: lateCancelTs }),
    ];

    const dealRow: ArchivedTclkDeal = {
      offerId: offer.id,
      contractId: contract,
      payerDid: payer.did,
      payeeDid: payee.did,
      amount: "1043",
      asset: "PAPER",
      jobId: null,
      jobContext: null,
      status: "claimed",
      offerExpiresMs: offer.expiresMs,
      claimByMs: offer.claimByMs,
      refundAfterMs: offer.refundAfterMs,
      createdAt: new Date(offerTs).toISOString(),
      updatedAt: new Date(receipt2Ts).toISOString(),
    };

    const repository = {
      framesForOffer: vi.fn(async () => frames),
      getByOfferId: vi.fn(async () => ({ deal: dealRow, frames })),
      updateState: vi.fn(async () => undefined),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);

    const result = await service.getByOfferId(offer.id);

    expect(result).not.toBeNull();
    expect(result?.deal).toBe(dealRow);
    expect(result?.frames).toBe(frames);
    expect(result?.historicalReplay.complete).toBe(true);
    if (!result?.historicalReplay.complete) return;
    expect(result.historicalReplay.result.status).toBe("claimed");
    expect(result.historicalReplay.result.contractId).toBe(contract);
    const cancelStep = result.historicalReplay.result.steps.find((step) => step.type === "cancel");
    expect(cancelStep?.ok).toBe(false);
  });

  it("returns historicalReplay.complete === false, not a fabricated status, when a venue timestamp is missing", async () => {
    const payer = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T15:00:00.000000Z");
    const offer = makeOffer({
      from: payer.did,
      role: "payer",
      amount: "5",
      asset: "PAPER",
      lock: "hash",
      rails: ["paper"],
      claimByMs: offerTs + 30 * 60_000,
      refundAfterMs: offerTs + 60 * 60_000,
      expiresMs: offerTs + 10 * 60_000,
    });
    // Archived before migration 0019 existed: no authoritative venue timestamp.
    const frames = [archivedFrame({ room: ROOM, seq: 1, offerId: offer.id, tclkFrame: offer, venueTimestampMs: null })];
    const dealRow: ArchivedTclkDeal = {
      offerId: offer.id,
      contractId: null,
      payerDid: payer.did,
      payeeDid: null,
      amount: "5",
      asset: "PAPER",
      jobId: null,
      jobContext: null,
      status: "proposed",
      offerExpiresMs: offer.expiresMs,
      claimByMs: offer.claimByMs,
      refundAfterMs: offer.refundAfterMs,
      createdAt: new Date(offerTs).toISOString(),
      updatedAt: new Date(offerTs).toISOString(),
    };
    const repository = {
      framesForOffer: vi.fn(async () => frames),
      getByOfferId: vi.fn(async () => ({ deal: dealRow, frames })),
      updateState: vi.fn(async () => undefined),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);

    const result = await service.getByOfferId(offer.id);

    expect(result?.historicalReplay.complete).toBe(false);
    expect(repository.updateState).not.toHaveBeenCalled();
  });
});

describe("TclkDealHistoryService reconciliation log noise", () => {
  // The venueTimestampMs: null short-circuits replayArchivedFrames() before
  // it even looks at frameType/line, so a single minimal frame is enough to
  // land on the "incomplete" path deterministically for any offerId.
  function incompleteFrame(offerId: string): ArchivedTclkFrame {
    return {
      room: ROOM,
      seq: 1,
      offerId,
      frameType: "offer",
      fromDid: "did:key:zFixture",
      line: "irrelevant-for-the-incomplete-path",
      frame: {},
      transportSig: "fixture-sig",
      transportNonce: "0",
      venueTimestampMs: null,
    };
  }

  function warnMessages(spy: ReturnType<typeof vi.fn>): string[] {
    return spy.mock.calls.map((call: unknown[]) => String(call[0]));
  }

  // 1. A direct/specific reconciliation path (getByOfferId) reports the same
  // offer+reason once, not on every call.
  it("getByOfferId does not repeat the same incomplete-reconstruction warning for the same offer+reason", async () => {
    const frames = [incompleteFrame(OFFER_ID)];
    const repository = {
      framesForOffer: vi.fn(async () => frames),
      getByOfferId: vi.fn(async () => ({ deal: {} as ArchivedTclkDeal, frames })),
      updateState: vi.fn(async () => undefined),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await service.getByOfferId(OFFER_ID);
    await service.getByOfferId(OFFER_ID);
    await service.getByOfferId(OFFER_ID);
    const messages = warnMessages(warn);
    warn.mockRestore();

    const incompleteLines = messages.filter((line) => line.includes("historical reconstruction incomplete"));
    expect(incompleteLines).toHaveLength(1);
    expect(incompleteLines[0]).toContain(OFFER_ID);
  });

  // 2. Multiple incomplete deals in one reconcileArchivedDeals() pass produce
  // ONE batch summary, not one warning per offer.
  it("reconcileArchivedDeals summarizes multiple newly-incomplete deals in one warning instead of one per offer", async () => {
    const offerIds = [OFFER_ID, `0x${"b2".repeat(32)}`, `0x${"c3".repeat(32)}`];
    const repository = {
      listOfferIdsForReconcile: vi.fn(async () => offerIds),
      framesForOffer: vi.fn(async (offerId: string) => [incompleteFrame(offerId)]),
      updateState: vi.fn(async () => undefined),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await service.reconcileArchivedDeals();
    const messages = warnMessages(warn);
    warn.mockRestore();

    const perOfferLines = messages.filter((line) => line.includes("historical reconstruction incomplete for"));
    const summaryLines = messages.filter((line) => /archived deal\(s\) skipped/.test(line));
    expect(perOfferLines).toHaveLength(0);
    expect(summaryLines).toHaveLength(1);
    expect(summaryLines[0]).toContain("3");
  });

  // Correctness: replayArchivedFrames() returns complete:false for several
  // distinct reasons — missing venue timestamps is only one of them (others
  // include "no offer frame among archived records", "did not decode...",
  // "openContract rejected..."). The batch summary must stay truthful for a
  // batch made up entirely of a NON-timestamp incomplete reason: it must
  // never claim venue timestamps are missing when they are not.
  it("does not claim missing venue timestamps in the batch summary when the incomplete reason is unrelated", async () => {
    // Every frame carries a real venueTimestampMs, so replayArchivedFrames()
    // passes the missing-timestamp check — but none is an "offer" frame, so
    // it fails closed with "no offer frame among archived records" instead.
    const nonOfferFrame: ArchivedTclkFrame = {
      room: ROOM,
      seq: 1,
      offerId: OFFER_ID,
      frameType: "accept",
      fromDid: "did:key:zFixture",
      line: "irrelevant-for-this-reason",
      frame: {},
      transportSig: "fixture-sig",
      transportNonce: "0",
      venueTimestampMs: Date.now(),
    };
    const repository = {
      listOfferIdsForReconcile: vi.fn(async () => [OFFER_ID]),
      framesForOffer: vi.fn(async () => [nonOfferFrame]),
      updateState: vi.fn(async () => undefined),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await service.reconcileArchivedDeals();
    const messages = warnMessages(warn);
    warn.mockRestore();

    const summaryLines = messages.filter((line) => /archived deal\(s\) skipped/.test(line));
    expect(summaryLines).toHaveLength(1);
    expect(summaryLines[0]).not.toMatch(/timestamp/i);
  });

  // 3. Running the identical batch again does not re-emit the same summary
  // (or any per-offer line) for offers already accounted for.
  it("reconcileArchivedDeals does not repeat the same batch summary on a second pass over the same offers", async () => {
    const offerIds = [OFFER_ID, `0x${"b2".repeat(32)}`];
    const repository = {
      listOfferIdsForReconcile: vi.fn(async () => offerIds),
      framesForOffer: vi.fn(async (offerId: string) => [incompleteFrame(offerId)]),
      updateState: vi.fn(async () => undefined),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await service.reconcileArchivedDeals();
    await service.reconcileArchivedDeals();
    const messages = warnMessages(warn);
    warn.mockRestore();

    const summaryLines = messages.filter((line) => /archived deal\(s\) skipped/.test(line));
    expect(summaryLines).toHaveLength(1);
  });

  // 4. A genuine thrown error during reconciliation stays individually
  // visible and is never folded into the incomplete-history batch summary.
  it("logs a genuine reconciliation exception individually, separate from the incomplete-history summary", async () => {
    const failure = new Error("connection terminated unexpectedly");
    const repository = {
      listOfferIdsForReconcile: vi.fn(async () => [OFFER_ID]),
      framesForOffer: vi.fn(async () => { throw failure; }),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await service.reconcileArchivedDeals();
    const messages = warnMessages(warn);
    warn.mockRestore();

    expect(messages.some((line) => line.includes(`reconcile failed for ${OFFER_ID}`) && line.includes(failure.message))).toBe(true);
    expect(messages.some((line) => /archived deal\(s\) skipped/.test(line))).toBe(false);
  });

  // 5. A complete historical replay must still call repository.updateState
  // exactly as before — this change only affects what gets logged, never the
  // underlying persisted state or the fail-closed behavior for incomplete
  // replays (already covered by "does not update the stored deal..." above).
  it("still calls repository.updateState for a complete historical replay, from the batch path", async () => {
    const payer = generateTestEd25519Identity();
    const payee = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T15:00:00.000000Z");
    const offer = makeOffer({
      from: payer.did,
      role: "payer",
      amount: "5",
      asset: "PAPER",
      lock: "hash",
      rails: ["paper"],
      claimByMs: offerTs + 30 * 60_000,
      refundAfterMs: offerTs + 60 * 60_000,
      expiresMs: offerTs + 10 * 60_000,
    });
    const { hash } = generateHashLock();
    const accept = makeAccept(offer, { from: payee.did, statement: hash });
    const frames = [
      archivedFrame({ room: ROOM, seq: 1, offerId: offer.id, tclkFrame: offer, venueTimestampMs: offerTs }),
      archivedFrame({ room: ROOM, seq: 2, offerId: offer.id, tclkFrame: accept, venueTimestampMs: offerTs + 60_000 }),
    ];
    const repository = {
      listOfferIdsForReconcile: vi.fn(async () => [offer.id]),
      framesForOffer: vi.fn(async () => frames),
      updateState: vi.fn(async () => undefined),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);

    const reconciled = await service.reconcileArchivedDeals();

    expect(reconciled).toBe(1);
    expect(repository.updateState).toHaveBeenCalledTimes(1);
    expect(repository.updateState).toHaveBeenCalledWith({
      offerId: offer.id,
      contractId: accept.contract,
      payeeDid: payee.did,
      status: "accepted",
    });
  });

  // 6. listByDid(did, { reconcile: false }) reads stored state without
  // triggering another reconcileArchivedDeals() pass.
  it("listByDid with reconcile:false reads stored state without reconciling", async () => {
    const repository = {
      listOfferIdsForReconcile: vi.fn(async () => [OFFER_ID]),
      listByDid: vi.fn(async () => []),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);

    await service.listByDid("did:key:zTestExampleDid", { reconcile: false });

    expect(repository.listOfferIdsForReconcile).not.toHaveBeenCalled();
    expect(repository.listByDid).toHaveBeenCalledTimes(1);
  });

  // 7. Default listByDid(did) behavior remains backwards compatible: it
  // still reconciles first, unchanged from before this fix.
  it("listByDid defaults to reconciling first, unchanged from before", async () => {
    const repository = {
      listOfferIdsForReconcile: vi.fn(async () => []),
      listByDid: vi.fn(async () => []),
    };
    const service = new TclkDealHistoryService(repository as unknown as PgTclkDealHistoryRepository, { call: vi.fn() } as never);

    await service.listByDid("did:key:zTestExampleDid");

    expect(repository.listOfferIdsForReconcile).toHaveBeenCalledTimes(1);
    expect(repository.listByDid).toHaveBeenCalledTimes(1);
  });
});
