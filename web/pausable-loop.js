// A tiny, framework-free requestAnimationFrame pause/resume state machine.
// Extracted from verification-ceremony.js so the "must not run while hidden,
// must not accumulate loops across repeated show/hide cycles" guarantee is
// directly unit-testable with a fake scheduler, without a real canvas/WAAPI
// browser stack.
//
// - Starts scheduling immediately.
// - Each tick checks `isVisible()`; if false, it stops scheduling itself
//   (never calls `schedule` again) instead of drawing forever off-screen.
// - `resumeIfVisible()` restarts it — a no-op if already running, disposed,
//   or still not visible — so callers can call it liberally from real
//   lifecycle pulses (reset/begin/complete, a re-entered view, ...) without
//   ever creating a second concurrent loop.
export function createPausableLoop({ isVisible, schedule, cancel, onFrame }) {
  let frameId = 0;
  let disposed = false;

  function tick(time) {
    if (disposed) return;
    if (!isVisible()) {
      frameId = 0;
      return;
    }
    onFrame(time);
    frameId = schedule(tick);
  }

  frameId = schedule(tick);

  return {
    resumeIfVisible() {
      if (disposed || frameId || !isVisible()) return;
      frameId = schedule(tick);
    },
    isRunning() {
      return Boolean(frameId);
    },
    destroy() {
      disposed = true;
      cancel(frameId);
      frameId = 0;
    },
  };
}
