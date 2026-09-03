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
  it("categorizes a rejection against a terminal deal status as already-terminal", () => {
    expect(rejectedRecordCategory("claimed")).toBe("already-terminal");
    expect(rejectedRecordCategory("refunded")).toBe("already-terminal");
    expect(rejectedRecordCategory("cancelled")).toBe("already-terminal");
  });

  it("categorizes a rejection against a non-terminal deal status as not-applied", () => {
    expect(rejectedRecordCategory("proposed")).toBe("not-applied");
    expect(rejectedRecordCategory("accepted")).toBe("not-applied");
    expect(rejectedRecordCategory("locked")).toBe("not-applied");
  });
});
