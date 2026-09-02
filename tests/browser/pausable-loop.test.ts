import { describe, expect, it } from "vitest";
import { createPausableLoop } from "../../web/pausable-loop.js";

/** A manually-steppable fake requestAnimationFrame scheduler. */
function fakeScheduler() {
  let nextId = 1;
  const pending = new Map<number, (time: number) => void>();
  return {
    schedule(tick: (time: number) => void): number {
      const id = nextId++;
      pending.set(id, tick);
      return id;
    },
    cancel(id: number): void {
      pending.delete(id);
    },
    /** Runs every currently-pending tick once, simulating one animation frame. */
    step(time = 0): void {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, tick] of due) tick(time);
    },
    pendingCount(): number {
      return pending.size;
    },
  };
}

describe("createPausableLoop (verification ceremony rAF lifecycle — H-2 fix)", () => {
  it("keeps scheduling itself every frame while visible, never more than one frame in flight", () => {
    const scheduler = fakeScheduler();
    let frames = 0;
    createPausableLoop({
      isVisible: () => true,
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
      onFrame: () => { frames += 1; },
    });

    scheduler.step();
    scheduler.step();
    scheduler.step();

    expect(frames).toBe(3);
    expect(scheduler.pendingCount()).toBe(1);
  });

  it("stops scheduling itself as soon as a frame notices the shell became hidden", () => {
    const scheduler = fakeScheduler();
    let visible = true;
    let frames = 0;
    createPausableLoop({
      isVisible: () => visible,
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
      onFrame: () => { frames += 1; },
    });

    scheduler.step(); // frame 1: visible, draws, reschedules
    expect(frames).toBe(1);
    expect(scheduler.pendingCount()).toBe(1);

    visible = false;
    scheduler.step(); // frame 2: notices hidden — no draw, no reschedule
    expect(frames).toBe(1);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("resumeIfVisible restarts a paused loop, and is a no-op both while still hidden and while already running", () => {
    const scheduler = fakeScheduler();
    let visible = true;
    let frames = 0;
    const loop = createPausableLoop({
      isVisible: () => visible,
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
      onFrame: () => { frames += 1; },
    });

    scheduler.step();
    visible = false;
    scheduler.step();
    expect(loop.isRunning()).toBe(false);

    loop.resumeIfVisible(); // still hidden: must not schedule anything
    expect(scheduler.pendingCount()).toBe(0);

    visible = true; // e.g. the user navigated back to this capability
    loop.resumeIfVisible();
    expect(loop.isRunning()).toBe(true);
    expect(scheduler.pendingCount()).toBe(1);

    loop.resumeIfVisible(); // already running: must never create a second concurrent frame
    expect(scheduler.pendingCount()).toBe(1);

    scheduler.step();
    expect(frames).toBe(2);
  });

  it("destroy stops the loop permanently — resumeIfVisible after destroy is a no-op", () => {
    const scheduler = fakeScheduler();
    let frames = 0;
    const loop = createPausableLoop({
      isVisible: () => true,
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
      onFrame: () => { frames += 1; },
    });

    loop.destroy();
    expect(scheduler.pendingCount()).toBe(0);

    loop.resumeIfVisible();
    expect(scheduler.pendingCount()).toBe(0);
    expect(loop.isRunning()).toBe(false);

    scheduler.step();
    expect(frames).toBe(0);
  });

  it("repeated show/hide/re-enter cycles (repeated capability navigation) never accumulate more than one active frame", () => {
    const scheduler = fakeScheduler();
    let visible = true;
    const loop = createPausableLoop({
      isVisible: () => visible,
      schedule: scheduler.schedule,
      cancel: scheduler.cancel,
      onFrame: () => {},
    });

    for (let cycle = 0; cycle < 5; cycle += 1) {
      scheduler.step();
      visible = false;
      scheduler.step();
      expect(scheduler.pendingCount()).toBeLessThanOrEqual(1);
      visible = true;
      loop.resumeIfVisible();
      expect(scheduler.pendingCount()).toBe(1);
    }
  });
});
