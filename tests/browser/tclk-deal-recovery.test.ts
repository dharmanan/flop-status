import { describe, expect, it } from "vitest";
import { buildHistoricalBoardState, findAcceptForContract } from "../../web/tclk-deal-recovery.js";

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
