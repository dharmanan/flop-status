import { describe, expect, it } from "vitest";
import { buildHistoricalBoardState, findAcceptForContract, reconcileMyDeals } from "../../web/tclk-deal-recovery.js";

const OFFER_ID = `0x${"a".repeat(64)}`;
const CONTRACT_ID = `0x${"b".repeat(64)}`;
const PAYER_DID = "did:key:zPayerExample";
const PAYEE_DID = "did:key:zPayeeExample";

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
