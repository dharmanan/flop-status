import { describe, expect, it } from "vitest";
import { makeOffer, makeAccept, generateHashLock, type CancelFrame, type LockFrame, type ReceiptFrame, type RevealFrame } from "@flop-labs/tclk";
import { replayArchivedFrames } from "../../lib/runtime/tclk-historical-replay.js";
import { generateTestEd25519Identity } from "../helpers/ed25519-fixtures.js";
import { archivedFrame, dealRoomFor } from "../helpers/tclk-fixtures.js";

const OFFER_ROOM = "tclk-offers";

function baseOfferTerms(payerDid: string, nowMs: number) {
  return {
    from: payerDid,
    role: "payer" as const,
    amount: "1043",
    asset: "PAPER",
    lock: "hash" as const,
    rails: ["paper"],
    claimByMs: nowMs + 30 * 60_000,
    refundAfterMs: nowMs + 60 * 60_000,
    expiresMs: nowMs + 10 * 60_000,
  };
}

describe("replayArchivedFrames", () => {
  // A. Historical valid accept: an accept signed well inside the offer's
  // window must not be re-rejected as expired just because reconstruction
  // happens hours later. Each frame is evaluated at its OWN venue timestamp,
  // never at "now".
  it("keeps a historically valid accept ACCEPTED even when reconstructed hours later", () => {
    const payer = generateTestEd25519Identity();
    const payee = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T15:00:00.000000Z");
    const acceptTs = offerTs + 60_000; // accepted 1 minute later, well inside the 10-minute window

    const offer = makeOffer(baseOfferTerms(payer.did, offerTs));
    const { hash } = generateHashLock();
    const accept = makeAccept(offer, { from: payee.did, statement: hash });

    const frames = [
      archivedFrame({ room: OFFER_ROOM, seq: 1, offerId: offer.id, tclkFrame: offer, venueTimestampMs: offerTs }),
      archivedFrame({ room: OFFER_ROOM, seq: 2, offerId: offer.id, tclkFrame: accept, venueTimestampMs: acceptTs }),
    ];

    const outcome = replayArchivedFrames(frames);
    expect(outcome.complete).toBe(true);
    if (!outcome.complete) return;
    expect(outcome.result.status).toBe("accepted");
    const acceptStep = outcome.result.steps.find((step) => step.type === "accept");
    expect(acceptStep?.ok).toBe(true);
    expect(acceptStep?.reason ?? "").not.toMatch(/expir/i);
  });

  // B. The confirmed 1043 PAPER chronology: offer, accept, lock, reveal, two
  // receipts, and a much later cancel that names the offer id instead of the
  // accepted contract id. Final status must be CLAIMED; the late cancel must
  // be rejected and must not move the deal backward.
  it("reconstructs the confirmed 1043 PAPER deal to CLAIMED, rejecting the late mis-addressed cancel", () => {
    const payer = generateTestEd25519Identity();
    const payee = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T15:26:42.999601Z");
    const acceptTs = Date.parse("2026-09-03T15:27:21.234339Z");
    const lockTs = Date.parse("2026-09-03T15:28:31.260255Z");
    const revealTs = Date.parse("2026-09-03T15:29:30.323288Z");
    const receipt1Ts = Date.parse("2026-09-03T15:30:21.308306Z");
    const receipt2Ts = Date.parse("2026-09-03T15:31:21.249814Z");
    const lateCancelTs = Date.parse("2026-09-03T18:44:50.276806Z");

    const offer = makeOffer(baseOfferTerms(payer.did, offerTs));
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
      archivedFrame({ room: OFFER_ROOM, seq: 10457, offerId: offer.id, tclkFrame: offer, venueTimestampMs: offerTs }),
      archivedFrame({ room: OFFER_ROOM, seq: 10460, offerId: offer.id, tclkFrame: accept, venueTimestampMs: acceptTs }),
      archivedFrame({ room, seq: 1, offerId: offer.id, tclkFrame: lock, venueTimestampMs: lockTs }),
      archivedFrame({ room, seq: 2, offerId: offer.id, tclkFrame: reveal, venueTimestampMs: revealTs }),
      archivedFrame({ room, seq: 3, offerId: offer.id, tclkFrame: receiptPayer, venueTimestampMs: receipt1Ts }),
      archivedFrame({ room, seq: 4, offerId: offer.id, tclkFrame: receiptPayee, venueTimestampMs: receipt2Ts }),
      archivedFrame({ room: OFFER_ROOM, seq: 13562, offerId: offer.id, tclkFrame: lateCancel, venueTimestampMs: lateCancelTs }),
    ];

    const outcome = replayArchivedFrames(frames);
    expect(outcome.complete).toBe(true);
    if (!outcome.complete) return;
    expect(outcome.result.status).toBe("claimed");
    expect(outcome.result.contractId).toBe(contract);

    const cancelStep = outcome.result.steps.find((step) => step.type === "cancel");
    expect(cancelStep?.ok).toBe(false);
    const receiptSteps = outcome.result.steps.filter((step) => step.type === "receipt");
    expect(receiptSteps).toHaveLength(2);
  });

  // C. Cross-room chronology must be driven purely by venue timestamp, never
  // by "tclk-offers first" or by the order frames happen to arrive in. Feeding
  // the exact same 1043 frames in a scrambled array order must reconstruct to
  // the identical result.
  it("reconstructs the same result regardless of input array order, proving the sort is by timestamp not by room or position", () => {
    const payer = generateTestEd25519Identity();
    const payee = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T15:26:42.999601Z");
    const acceptTs = Date.parse("2026-09-03T15:27:21.234339Z");
    const lockTs = Date.parse("2026-09-03T15:28:31.260255Z");
    const revealTs = Date.parse("2026-09-03T15:29:30.323288Z");
    const lateCancelTs = Date.parse("2026-09-03T18:44:50.276806Z");

    const offer = makeOffer(baseOfferTerms(payer.did, offerTs));
    const { preimage, hash } = generateHashLock();
    const accept = makeAccept(offer, { from: payee.did, statement: hash });
    const contract = accept.contract;
    const room = dealRoomFor(contract);
    const lock: LockFrame = { type: "lock", from: payer.did, contract, rail: "paper", ref: contract };
    const reveal: RevealFrame = { type: "reveal", from: payee.did, contract, secret: preimage };
    const lateCancel: CancelFrame = { type: "cancel", from: payer.did, contract: offer.id, reason: "late, wrong contract" };

    const inOrder = [
      archivedFrame({ room: OFFER_ROOM, seq: 1, offerId: offer.id, tclkFrame: offer, venueTimestampMs: offerTs }),
      archivedFrame({ room: OFFER_ROOM, seq: 2, offerId: offer.id, tclkFrame: accept, venueTimestampMs: acceptTs }),
      archivedFrame({ room, seq: 1, offerId: offer.id, tclkFrame: lock, venueTimestampMs: lockTs }),
      archivedFrame({ room, seq: 2, offerId: offer.id, tclkFrame: reveal, venueTimestampMs: revealTs }),
      archivedFrame({ room: OFFER_ROOM, seq: 3, offerId: offer.id, tclkFrame: lateCancel, venueTimestampMs: lateCancelTs }),
    ];
    // Deliberately not chronological and not grouped by room: the late cancel
    // (a tclk-offers frame) is listed FIRST, ahead of the earlier deal-room frames.
    const scrambled = [4, 2, 0, 3, 1].map((index) => inOrder[index]!);

    const a = replayArchivedFrames(inOrder);
    const b = replayArchivedFrames(scrambled);
    expect(a.complete).toBe(true);
    expect(b.complete).toBe(true);
    if (!a.complete || !b.complete) return;
    expect(b.result.status).toBe(a.result.status);
    expect(b.result.status).toBe("claimed");
    expect(b.result.steps.map((step) => `${step.type}:${step.ok}`)).toEqual(a.result.steps.map((step) => `${step.type}:${step.ok}`));
  });

  // D. Missing timestamp: no Date.now() fallback, no fabricated state update.
  it("fails closed when a required frame has no venue timestamp, instead of guessing", () => {
    const payer = generateTestEd25519Identity();
    const payee = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T15:00:00.000000Z");

    const offer = makeOffer(baseOfferTerms(payer.did, offerTs));
    const { hash } = generateHashLock();
    const accept = makeAccept(offer, { from: payee.did, statement: hash });

    const frames = [
      archivedFrame({ room: OFFER_ROOM, seq: 1, offerId: offer.id, tclkFrame: offer, venueTimestampMs: offerTs }),
      // Archived before the venue-timestamp column existed: no authoritative time.
      archivedFrame({ room: OFFER_ROOM, seq: 2, offerId: offer.id, tclkFrame: accept, venueTimestampMs: null }),
    ];

    const outcome = replayArchivedFrames(frames);
    expect(outcome.complete).toBe(false);
    if (outcome.complete) return;
    expect(outcome.reason).toMatch(/venue timestamp/i);
  });

  // E. A genuinely valid cancellation must still result in CANCELLED. The fix
  // must not simply prefer CLAIMED over CANCELLED — it must follow whatever
  // the official state machine actually decides from the true chronology.
  it("reconstructs a genuinely valid cancellation to CANCELLED", () => {
    const payer = generateTestEd25519Identity();
    const payee = generateTestEd25519Identity();
    const offerTs = Date.parse("2026-09-03T09:00:00.000000Z");
    const acceptTs = offerTs + 60_000;
    const cancelTs = offerTs + 90_000;

    const offer = makeOffer(baseOfferTerms(payer.did, offerTs));
    const { hash } = generateHashLock();
    const accept = makeAccept(offer, { from: payee.did, statement: hash });
    const contract = accept.contract;
    const room = dealRoomFor(contract);
    // A real cancel: correct contract id, posted to the deal room, before any lock.
    const cancel: CancelFrame = { type: "cancel", from: payer.did, contract, reason: "payer changed mind before lock" };

    const frames = [
      archivedFrame({ room: OFFER_ROOM, seq: 1, offerId: offer.id, tclkFrame: offer, venueTimestampMs: offerTs }),
      archivedFrame({ room: OFFER_ROOM, seq: 2, offerId: offer.id, tclkFrame: accept, venueTimestampMs: acceptTs }),
      archivedFrame({ room, seq: 1, offerId: offer.id, tclkFrame: cancel, venueTimestampMs: cancelTs }),
    ];

    const outcome = replayArchivedFrames(frames);
    expect(outcome.complete).toBe(true);
    if (!outcome.complete) return;
    expect(outcome.result.status).toBe("cancelled");
    const cancelStep = outcome.result.steps.find((step) => step.type === "cancel");
    expect(cancelStep?.ok).toBe(true);
  });
});
