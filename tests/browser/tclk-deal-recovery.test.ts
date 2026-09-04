import { describe, expect, it } from "vitest";
import { buildHistoricalBoardState, findAcceptForContract, newestOffersFirst, reconcileMyDeals, sameExplicitVenue, venueSafeRecordOrder } from "../../web/tclk-deal-recovery.js";

const OFFER_ID = `0x${"a".repeat(64)}`;
const CONTRACT_ID = `0x${"b".repeat(64)}`;
const PAYER_DID = "did:key:zPayerExample";
const PAYEE_DID = "did:key:zPayeeExample";
const VENUE = "https://technocore.chat";
const OTHER_VENUE = "https://selfhost.example.invalid";

describe("buildHistoricalBoardState", () => {
  // A / D. The replay result is adopted as-is — no re-evaluation against the
  // current time, and no clock consulted at all — so a deal that historically
  // reconstructed to CLAIMED (an accept that was valid when it was signed)
  // stays CLAIMED no matter how much later this runs.
  it("adopts the replay result's status and steps unchanged", () => {
    const steps = [
      { index: 0, type: "offer", ok: true },
      { index: 1, type: "accept", ok: true },
      { index: 2, type: "lock", ok: true },
      { index: 3, type: "reveal", ok: true },
      { index: 4, type: "receipt", ok: true },
      { index: 5, type: "receipt", ok: true },
      { index: 6, type: "cancel", ok: false, reason: "already terminal" },
    ];
    const boardState = buildHistoricalBoardState(PAYER_DID, {
      status: "claimed",
      contractId: CONTRACT_ID,
      payeeDid: PAYEE_DID,
      steps,
    });
    expect(boardState.status).toBe("claimed");
    expect(boardState.steps).toBe(steps);
    expect(boardState.parties).toEqual({ payer: PAYER_DID, payee: PAYEE_DID });
    const cancelStep = boardState.steps.find((step: { type: string }) => step.type === "cancel");
    expect(cancelStep?.ok).toBe(false);
  });

  // C / K. The rendered/used contract id must be the true accepted contract
  // id, never the offer id, even though both are present on the deal.
  it("uses the replay's contractId as the contract, distinct from the offer id", () => {
    const boardState = buildHistoricalBoardState(PAYER_DID, {
      status: "claimed",
      contractId: CONTRACT_ID,
      payeeDid: PAYEE_DID,
      steps: [],
    });
    expect(boardState.contract).toBe(CONTRACT_ID);
    expect(boardState.contract).not.toBe(OFFER_ID);
  });

  // I. A genuinely cancelled replay result must surface as CANCELLED — this
  // module has no special-casing that prefers any particular terminal status.
  it("passes through a genuinely cancelled replay result as CANCELLED", () => {
    const boardState = buildHistoricalBoardState(PAYER_DID, {
      status: "cancelled",
      contractId: CONTRACT_ID,
      payeeDid: PAYEE_DID,
      steps: [{ index: 0, type: "offer", ok: true }, { index: 1, type: "cancel", ok: true }],
    });
    expect(boardState.status).toBe("cancelled");
  });

  it("never consults the current time", () => {
    const original = Date.now;
    let called = false;
    Date.now = () => { called = true; return original(); };
    try {
      buildHistoricalBoardState(PAYER_DID, { status: "claimed", contractId: CONTRACT_ID, payeeDid: PAYEE_DID, steps: [] });
    } finally {
      Date.now = original;
    }
    expect(called).toBe(false);
  });
});

describe("findAcceptForContract", () => {
  // C. The confirmed 1043 bug: a late, mis-addressed cancel names the OFFER id
  // in its "contract" field. This must never be mistaken for the accept — only
  // a genuine accept frame whose own contract field equals the true contract
  // id may be returned.
  it("finds the accept record by the true contract id, ignoring a cancel whose contract field is actually the offer id", () => {
    const records = [
      { frame: { type: "offer", id: OFFER_ID } },
      { frame: { type: "cancel", contract: OFFER_ID } },
      { frame: { type: "accept", contract: CONTRACT_ID } },
    ];
    const accept = findAcceptForContract(records, CONTRACT_ID);
    expect(accept?.frame.type).toBe("accept");
    expect(accept?.frame.contract).toBe(CONTRACT_ID);
  });

  it("returns null for a missing contract id instead of guessing", () => {
    const records = [{ frame: { type: "accept", contract: CONTRACT_ID } }];
    expect(findAcceptForContract(records, null)).toBeNull();
  });

  it("returns null when no accept record matches the contract id", () => {
    const records = [{ frame: { type: "accept", contract: `0x${"c".repeat(64)}` } }];
    expect(findAcceptForContract(records, CONTRACT_ID)).toBeNull();
  });
});

describe("reconcileMyDeals", () => {
  function liveDeal(offerId: string, status = "accepted") {
    return { offer: { frame: { id: offerId, from: PAYER_DID } }, boardState: { status }, historical: false };
  }

  function recoveredDeal(offerId: string, status = "claimed") {
    return { offer: { frame: { id: offerId, from: PAYER_DID } }, boardState: { status, contract: CONTRACT_ID }, historical: true };
  }

  // H (fail-closed variant). offerId exists both in the live "mine" list and
  // in durable history, but historical recovery is incomplete (e.g. a
  // production frame is still missing its authoritative venue timestamp).
  // The stale, Date.now-derived live entry must NOT survive just because
  // recovery failed — it must be dropped and reported as a recovery issue,
  // never silently left standing in for an offer id known to have history.
  it("drops the stale live entry (does not retain it) when durable history exists for the same offer id but recovery is incomplete", () => {
    const stale = liveDeal(OFFER_ID);
    const { deals, recoveryIssues } = reconcileMyDeals(
      [stale],
      [{ ok: false, offerId: OFFER_ID, reason: "1 of 3 archived frame(s) lack an authoritative venue timestamp" }],
    );

    expect(deals.find((deal) => deal.offer.frame.id === OFFER_ID)).toBeUndefined();
    expect(recoveryIssues).toHaveLength(1);
    expect(recoveryIssues[0]).toMatchObject({ ok: false, offerId: OFFER_ID });
  });

  // H (success variant). A complete historical recovery replaces the live
  // entry for the same offer id rather than being skipped because that id
  // was already present.
  it("replaces a live entry with a complete historical recovery for the same offer id", () => {
    const stale = liveDeal(OFFER_ID, "accepted");
    const recovered = recoveredDeal(OFFER_ID, "claimed");
    const { deals, recoveryIssues } = reconcileMyDeals([stale], [{ ok: true, deal: recovered }]);

    expect(deals).toHaveLength(1);
    expect(deals[0]).toBe(recovered);
    expect(deals[0]!.boardState.status).toBe("claimed");
    expect(recoveryIssues).toHaveLength(0);
  });

  it("leaves a live entry untouched when durable history has nothing to say about it", () => {
    const live = liveDeal(OFFER_ID, "proposed");
    const { deals, recoveryIssues } = reconcileMyDeals([live], []);

    expect(deals).toEqual([live]);
    expect(recoveryIssues).toHaveLength(0);
  });

  it("adds a recovered archived deal that was not present live at all", () => {
    const recovered = recoveredDeal(OFFER_ID, "cancelled");
    const { deals } = reconcileMyDeals([], [{ ok: true, deal: recovered }]);

    expect(deals).toEqual([recovered]);
  });

  it("surfaces a recovery issue without touching unrelated live deals", () => {
    const unrelatedOfferId = `0x${"c".repeat(64)}`;
    const unrelated = liveDeal(unrelatedOfferId);
    const { deals, recoveryIssues } = reconcileMyDeals(
      [unrelated],
      [{ ok: false, offerId: OFFER_ID, reason: "no verified offer record" }],
    );

    expect(deals).toEqual([unrelated]);
    expect(recoveryIssues).toHaveLength(1);
  });
});

describe("newestOffersFirst", () => {
  interface TestDeal {
    offer: { frame: { id: string }; venueTimestampMs?: number | null; seq?: number; [key: string]: unknown };
    [key: string]: unknown;
  }

  function dealWithOffer(id: string, extra: Record<string, unknown> = {}): TestDeal {
    return { offer: { frame: { id }, ...extra } };
  }

  // A. Three deals with offer venue timestamps 1000, 3000, 2000 sort as
  // 3000, 2000, 1000.
  it("sorts by the offer's own venue timestamp, newest first", () => {
    const oldest = dealWithOffer("oldest", { venueTimestampMs: 1000, seq: 1 });
    const newest = dealWithOffer("newest", { venueTimestampMs: 3000, seq: 3 });
    const middle = dealWithOffer("middle", { venueTimestampMs: 2000, seq: 2 });

    const sorted = newestOffersFirst([oldest, newest, middle]);

    expect(sorted.map((deal) => deal.offer.frame.id)).toEqual(["newest", "middle", "oldest"]);
  });

  // B. An older offer whose state was updated later must not move above a
  // newer offer — the sort depends only on offer.venueTimestampMs/seq, never
  // on anything describing a later event.
  it("keeps an older offer below a newer one even when the older deal's state changed more recently", () => {
    const newerOfferStaleState = dealWithOffer("newer-offer", { venueTimestampMs: 2000, seq: 2 });
    const olderOfferRecentlyUpdated = dealWithOffer("older-offer-recently-touched", {
      venueTimestampMs: 1000,
      seq: 1,
      // Decoys: if the sort looked at anything on the deal besides offer
      // venue timestamp/seq, these would wrongly put this deal on top.
      updatedAt: "2030-01-01T00:00:00.000Z",
      boardState: { status: "claimed" },
    });

    const sorted = newestOffersFirst([olderOfferRecentlyUpdated, newerOfferStaleState]);

    expect(sorted.map((deal) => deal.offer.frame.id)).toEqual(["newer-offer", "older-offer-recently-touched"]);
  });

  // C. A live deal and an archived/recovered deal sort correctly together
  // using the same deal.offer.venueTimestampMs field, regardless of origin.
  it("sorts live and archived/recovered deals together by the same offer venue timestamp field", () => {
    const archivedOlder = { ...dealWithOffer("archived", { venueTimestampMs: 500, seq: 1 }), historical: true };
    const liveNewer = dealWithOffer("live", { venueTimestampMs: 1500, seq: 2 });

    const sorted = newestOffersFirst([archivedOlder, liveNewer]);

    expect(sorted.map((deal) => deal.offer.frame.id)).toEqual(["live", "archived"]);
  });

  // D. Missing venue timestamp falls back to offer.seq DESC — but only for
  // offers that share one explicit venue, since seq is a per-venue namespace.
  it("falls back to offer.seq descending when a venue timestamp is missing on either side, within one venue", () => {
    const noTimestamp = dealWithOffer("no-timestamp", { venueTimestampMs: null, seq: 5, venue: VENUE });
    const hasTimestamp = dealWithOffer("has-timestamp", { venueTimestampMs: 1000, seq: 3, venue: VENUE });
    // Missing vs. missing: still resolved by seq.
    const alsoNoTimestamp = dealWithOffer("also-no-timestamp", { venueTimestampMs: null, seq: 4, venue: VENUE });

    const sorted = newestOffersFirst([noTimestamp, hasTimestamp, alsoNoTimestamp]);

    // Per the documented fallback: any side lacking a usable timestamp falls
    // back to seq DESC for that comparison, so ordering here is driven by seq
    // (5, 4, 3) rather than by the one real timestamp "winning" partially.
    expect(sorted.map((deal) => deal.offer.frame.id)).toEqual(["no-timestamp", "also-no-timestamp", "has-timestamp"]);
  });

  it("also falls back to seq when venueTimestampMs is undefined rather than null, within one venue", () => {
    const noField = dealWithOffer("no-field", { seq: 2, venue: VENUE });
    const hasTimestamp = dealWithOffer("has-timestamp", { venueTimestampMs: 1000, seq: 1, venue: VENUE });

    const sorted = newestOffersFirst([hasTimestamp, noField]);

    expect(sorted.map((deal) => deal.offer.frame.id)).toEqual(["no-field", "has-timestamp"]);
  });

  // E. Returns a new array and does not mutate the source array or its order.
  it("returns a new array and does not mutate the input array", () => {
    const a = dealWithOffer("a", { venueTimestampMs: 1000, seq: 1 });
    const b = dealWithOffer("b", { venueTimestampMs: 2000, seq: 2 });
    const source = [a, b];

    const sorted = newestOffersFirst(source);

    expect(sorted).not.toBe(source);
    expect(source).toEqual([a, b]); // original order untouched
    expect(sorted.map((deal) => deal.offer.frame.id)).toEqual(["b", "a"]);
  });

  // H. Equal or unusable timestamps produce deterministic, stable results,
  // and the function never consults expiresMs/updatedAt at all.
  it("is stable and deterministic when timestamps are equal, ignoring expiresMs/updatedAt entirely", () => {
    const first = dealWithOffer("first", { venueTimestampMs: 1000, seq: 1, expiresMs: 999999999, updatedAt: "2000-01-01" });
    const second = dealWithOffer("second", { venueTimestampMs: 1000, seq: 1, expiresMs: 1, updatedAt: "2099-01-01" });

    const sorted = newestOffersFirst([first, second]);
    const sortedAgain = newestOffersFirst([first, second]);

    expect(sorted.map((deal) => deal.offer.frame.id)).toEqual(["first", "second"]);
    expect(sortedAgain.map((deal) => deal.offer.frame.id)).toEqual(["first", "second"]);
  });

  // seq is a per-venue namespace that can also restart when a room is
  // recreated, so it may only order two offers carrying the SAME explicit
  // venue. Every other case fails closed: no ordering signal, stable input
  // order preserved.
  it("compares seq when both sides carry the same explicit venue", () => {
    const low = dealWithOffer("seq-5", { venueTimestampMs: null, seq: 5, venue: VENUE });
    const high = dealWithOffer("seq-9", { venueTimestampMs: null, seq: 9, venue: VENUE });

    expect(newestOffersFirst([low, high]).map((deal) => deal.offer.frame.id)).toEqual(["seq-9", "seq-5"]);
  });

  it("does not use seq when the two venues differ", () => {
    const official = dealWithOffer("official-seq-5", { venueTimestampMs: null, seq: 5, venue: VENUE });
    const selfhost = dealWithOffer("selfhost-seq-9", { venueTimestampMs: null, seq: 9, venue: OTHER_VENUE });

    // seq 9 would have won on a raw comparison; input order must survive.
    expect(newestOffersFirst([official, selfhost]).map((deal) => deal.offer.frame.id)).toEqual(["official-seq-5", "selfhost-seq-9"]);
  });

  it("does not use seq when A's venue is missing", () => {
    const missing = dealWithOffer("a-missing-seq-5", { venueTimestampMs: null, seq: 5 });
    const known = dealWithOffer("b-known-seq-9", { venueTimestampMs: null, seq: 9, venue: VENUE });

    expect(newestOffersFirst([missing, known]).map((deal) => deal.offer.frame.id)).toEqual(["a-missing-seq-5", "b-known-seq-9"]);
  });

  it("does not use seq when B's venue is missing", () => {
    const known = dealWithOffer("a-known-seq-5", { venueTimestampMs: null, seq: 5, venue: VENUE });
    const missing = dealWithOffer("b-missing-seq-9", { venueTimestampMs: null, seq: 9 });

    expect(newestOffersFirst([known, missing]).map((deal) => deal.offer.frame.id)).toEqual(["a-known-seq-5", "b-missing-seq-9"]);
  });

  it("does not use seq when both venues are missing", () => {
    const first = dealWithOffer("a-seq-5", { venueTimestampMs: null, seq: 5 });
    const second = dealWithOffer("b-seq-9", { venueTimestampMs: null, seq: 9 });

    expect(newestOffersFirst([first, second]).map((deal) => deal.offer.frame.id)).toEqual(["a-seq-5", "b-seq-9"]);
  });

  it("does not use seq when a venue is present but empty", () => {
    const empty = dealWithOffer("a-empty-seq-5", { venueTimestampMs: null, seq: 5, venue: "" });
    const known = dealWithOffer("b-known-seq-9", { venueTimestampMs: null, seq: 9, venue: VENUE });

    expect(newestOffersFirst([empty, known]).map((deal) => deal.offer.frame.id)).toEqual(["a-empty-seq-5", "b-known-seq-9"]);
  });
});

describe("sameExplicitVenue", () => {
  it("is true only for two identical, non-empty venue strings", () => {
    expect(sameExplicitVenue(VENUE, VENUE)).toBe(true);
  });

  it("is false for differing, missing, empty, or non-string venues", () => {
    expect(sameExplicitVenue(VENUE, OTHER_VENUE)).toBe(false);
    expect(sameExplicitVenue(VENUE, undefined)).toBe(false);
    expect(sameExplicitVenue(undefined, VENUE)).toBe(false);
    expect(sameExplicitVenue(undefined, undefined)).toBe(false);
    expect(sameExplicitVenue("", "")).toBe(false);
    expect(sameExplicitVenue(VENUE, null)).toBe(false);
    expect(sameExplicitVenue(1, 1)).toBe(false);
  });
});

describe("venueSafeRecordOrder", () => {
  interface TestRecord {
    seq: number;
    venue?: string;
    venueTimestampMs?: number | null;
  }

  function record(extra: Partial<TestRecord> = {}): TestRecord {
    return { seq: 0, ...extra };
  }

  it("orders same-venue records by seq ascending when no timestamps decide it", () => {
    const a = record({ seq: 5, venue: VENUE, venueTimestampMs: null });
    const b = record({ seq: 9, venue: VENUE, venueTimestampMs: null });

    expect([b, a].sort(venueSafeRecordOrder).map((item) => item.seq)).toEqual([5, 9]);
  });

  // The concrete mixed-venue case: an official archived record must never be
  // seq-sorted against a self-host live record.
  it("does not seq-order an archived record from one venue against a live record from another", () => {
    const officialArchived = record({ seq: 10457, venue: VENUE, venueTimestampMs: null });
    const selfhostLive = record({ seq: 1, venue: OTHER_VENUE, venueTimestampMs: null });

    // A raw seq sort would have put the self-host seq 1 first; input order stands.
    expect([officialArchived, selfhostLive].sort(venueSafeRecordOrder).map((item) => item.seq)).toEqual([10457, 1]);
  });

  it("does not seq-order when either record's venue is missing", () => {
    const known = record({ seq: 9, venue: VENUE, venueTimestampMs: null });
    const missing = record({ seq: 1, venueTimestampMs: null });

    expect([known, missing].sort(venueSafeRecordOrder).map((item) => item.seq)).toEqual([9, 1]);
    expect([missing, known].sort(venueSafeRecordOrder).map((item) => item.seq)).toEqual([1, 9]);
  });

  it("orders chronologically by authoritative venue timestamp before considering seq, even across venues", () => {
    const laterOnOfficial = record({ seq: 1, venue: VENUE, venueTimestampMs: 2000 });
    const earlierOnSelfhost = record({ seq: 99, venue: OTHER_VENUE, venueTimestampMs: 1000 });

    expect([laterOnOfficial, earlierOnSelfhost].sort(venueSafeRecordOrder).map((item) => item.venueTimestampMs)).toEqual([1000, 2000]);
  });

  it("never consults the current time", () => {
    const original = Date.now;
    let called = false;
    Date.now = () => { called = true; return original(); };
    try {
      venueSafeRecordOrder({ seq: 1, venue: VENUE }, { seq: 2, venue: VENUE });
    } finally {
      Date.now = original;
    }
    expect(called).toBe(false);
  });
});
