import { describe, expect, it } from "vitest";
import { rejectedRecordCategory, splitTimelineSteps } from "../../web/tclk-step-presentation.js";

describe("splitTimelineSteps", () => {
  // The 1043 case: a full applied flow followed by a late, mis-addressed
  // cancel that the state machine rejected. The rejected cancel must never
  // land in the applied flow, and the applied flow must keep its full order.
  it("separates a rejected late cancel from the applied agreement flow", () => {
    const steps = [
      { index: 0, type: "offer", ok: true },
      { index: 1, type: "accept", ok: true },
      { index: 2, type: "lock", ok: true },
      { index: 3, type: "reveal", ok: true },
      { index: 4, type: "receipt", ok: true },
      { index: 5, type: "receipt", ok: true },
      { index: 6, type: "cancel", ok: false, reason: "cancel in status claimed" },
    ];
    const { applied, rejected } = splitTimelineSteps(steps);
    expect(applied.map((step) => step.type)).toEqual(["offer", "accept", "lock", "reveal", "receipt", "receipt"]);
    expect(applied.every((step) => step.ok)).toBe(true);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ type: "cancel", ok: false });
  });

  // A genuinely valid, applied cancellation is part of the normal flow, not
  // a rejected record — it must stay in `applied`.
  it("keeps a genuinely applied cancel in the applied flow, not in rejected", () => {
    const steps = [
      { index: 0, type: "offer", ok: true },
      { index: 1, type: "accept", ok: true },
      { index: 2, type: "cancel", ok: true },
    ];
    const { applied, rejected } = splitTimelineSteps(steps);
    expect(applied.map((step) => step.type)).toEqual(["offer", "accept", "cancel"]);
    expect(rejected).toHaveLength(0);
  });

  it("returns empty arrays for no steps", () => {
    expect(splitTimelineSteps(undefined)).toEqual({ applied: [], rejected: [] });
    expect(splitTimelineSteps([])).toEqual({ applied: [], rejected: [] });
  });

  it("can separate multiple rejected frames without dropping any", () => {
    const steps = [
      { index: 0, type: "offer", ok: true },
      { index: 1, type: "accept", ok: false, reason: "offer has expired" },
      { index: 2, type: "cancel", ok: false, reason: "cancel in status proposed" },
    ];
    const { applied, rejected } = splitTimelineSteps(steps);
    expect(applied).toHaveLength(1);
    expect(rejected).toHaveLength(2);
  });
});

describe("rejectedRecordCategory", () => {
  // 1. The confirmed 1043 case: a late cancel naming the offer id is rejected
  // by the real @flop-labs/tclk machine with the literal reason
  // "cancel in status claimed" (see machine.js: `${frame.type} in status
  // ${state.status}`). That embedded status is what must drive the category.
  it("classifies the confirmed 1043 reason 'cancel in status claimed' as already-terminal", () => {
    expect(rejectedRecordCategory({ reason: "cancel in status claimed" })).toBe("already-terminal");
  });

  // 2. A mid-flow rejection must be judged by ITS OWN reason, never by the
  // deal's eventual final status. A deal that later completes normally
  // (final status claimed) may still contain an earlier rejected record for
  // an unrelated reason — that record was not rejected because the deal was
  // "already completed", and must not say so.
  it("does not classify a rejection for an unrelated reason as already-terminal, even in a deal whose final status is claimed", () => {
    expect(rejectedRecordCategory({ reason: "offer has expired" })).toBe("not-applied");
    expect(rejectedRecordCategory({ reason: "accept in status accepted" })).toBe("not-applied");
    expect(rejectedRecordCategory({ reason: "contract id mismatch" })).toBe("not-applied");
  });

  // 3. The same "<frame> in status <terminal>" pattern for refunded and
  // cancelled, across different frame types — not hardcoded to cancel/claimed.
  it("classifies 'in status refunded' and 'in status cancelled' reasons as already-terminal, for any frame type", () => {
    expect(rejectedRecordCategory({ reason: "accept in status refunded" })).toBe("already-terminal");
    expect(rejectedRecordCategory({ reason: "lock in status cancelled" })).toBe("already-terminal");
    expect(rejectedRecordCategory({ reason: "reveal in status refunded" })).toBe("already-terminal");
    expect(rejectedRecordCategory({ reason: "refund in status cancelled" })).toBe("already-terminal");
  });

  // A rejection embedding a non-terminal status ("accepted"/"locked"/
  // "proposed") is real and REJECTED, but the deal was not already done —
  // this must not be conflated with the terminal case.
  it("does not classify 'in status accepted/locked/proposed' as already-terminal", () => {
    expect(rejectedRecordCategory({ reason: "lock in status accepted" })).toBe("not-applied");
    expect(rejectedRecordCategory({ reason: "cancel in status locked" })).toBe("not-applied");
    expect(rejectedRecordCategory({ reason: "reveal in status proposed" })).toBe("not-applied");
  });

  it("does not classify 'receipt before a terminal status' as already-terminal", () => {
    expect(rejectedRecordCategory({ reason: "receipt before a terminal status" })).toBe("not-applied");
  });

  it("treats a missing reason as not-applied rather than throwing", () => {
    expect(rejectedRecordCategory({})).toBe("not-applied");
  });
});
