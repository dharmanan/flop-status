import { describe, expect, it } from "vitest";
import { matchCardByProtocolId } from "../../web/tclk-deal-refresh.js";

// Two distinct deals that share every display field a fuzzy matcher could use
// (payer, amount, asset, job title) but have different, immutable protocol ids.
// Regression for: refreshing one must never reopen the other.
const OFFER_A = `0x${"a1".repeat(32)}`;
const OFFER_B = `0x${"b2".repeat(32)}`;
const CONTRACT_A = `0x${"c3".repeat(32)}`;
const CONTRACT_STALE = `0x${"d4".repeat(32)}`;

function card(offerId: string, contractId?: string) {
  return { dataset: { offerId, ...(contractId ? { contractId } : {}) } };
}

describe("matchCardByProtocolId", () => {
  it("finds Deal A only, never Deal B, even though every display field is identical", () => {
    const dealA = card(OFFER_A, CONTRACT_A);
    const dealB = card(OFFER_B); // same payer/amount/asset/title in the UI, different offerId

    expect(matchCardByProtocolId([dealA, dealB], { offerId: OFFER_A, contractId: CONTRACT_A })).toBe(dealA);
    expect(matchCardByProtocolId([dealA, dealB], { offerId: OFFER_B, contractId: null })).toBe(dealB);
  });

  it("fails closed when the exact id is not present, rather than guessing", () => {
    const dealA = card(OFFER_A);
    const dealB = card(OFFER_B);
    expect(matchCardByProtocolId([dealA, dealB], { offerId: `0x${"ff".repeat(32)}`, contractId: null })).toBeNull();
    expect(matchCardByProtocolId([], { offerId: OFFER_A, contractId: null })).toBeNull();
  });

  it("fails closed on a duplicate id rather than picking one arbitrarily", () => {
    const first = card(OFFER_A);
    const second = card(OFFER_A);
    expect(matchCardByProtocolId([first, second], { offerId: OFFER_A, contractId: null })).toBeNull();
  });

  it("requires the contractId to also match once a deal is accepted, so a stale card cannot be opened as if it were the current contract", () => {
    // Same offerId as the deal being refreshed, but its card still carries the
    // contract from before the board caught up — or, in principle, a forged one.
    // Either way it must not be treated as the same accepted deal.
    const staleCard = card(OFFER_A, CONTRACT_STALE);
    expect(matchCardByProtocolId([staleCard], { offerId: OFFER_A, contractId: CONTRACT_A })).toBeNull();

    const currentCard = card(OFFER_A, CONTRACT_A);
    expect(matchCardByProtocolId([staleCard, currentCard], { offerId: OFFER_A, contractId: CONTRACT_A })).toBe(currentCard);
  });

  it("accepts offerId alone before a contract exists", () => {
    const preAccept = card(OFFER_A);
    expect(matchCardByProtocolId([preAccept], { offerId: OFFER_A, contractId: null })).toBe(preAccept);
  });
});
