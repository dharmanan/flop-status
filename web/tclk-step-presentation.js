// Pure helpers for presenting a TCLK contract state's step list. No DOM, no
// bilingual copy — tclk-deals.js stays the single place that decides wording
// and renders it; this module only decides structure.

/**
 * Splits a state's steps into the applied agreement flow and the rejected
 * signed records. A rejected frame — most notably a cancel attempt that
 * arrives after the agreement already reached a terminal state — is evidence
 * that something was signed and submitted, not a step in the normal
 * agreement flow, and must never be numbered alongside
 * OFFER/ACCEPT/LOCK/REVEAL/RECEIPT as if it were one.
 *
 * @param {Array<{index: number, type: string, ok: boolean, reason?: string}>} steps
 */
export function splitTimelineSteps(steps) {
  const applied = [];
  const rejected = [];
  for (const step of steps ?? []) {
    if (step.ok) applied.push(step);
    else rejected.push(step);
  }
  return { applied, rejected };
}

// The @flop-labs/tclk state machine (lib/machine.js) rejects a frame arriving
// after its own transition is no longer valid with the literal reason
// `${frame.type} in status ${state.status}` — e.g. "cancel in status
// claimed", "accept in status refunded". That embedded status is the state
// AT THE MOMENT this specific frame was evaluated, which is the only way to
// know why THIS step was rejected — the deal's later, final status (which
// could differ, e.g. a mid-flow rejection in a deal that still went on to
// complete normally) says nothing about it.
const ALREADY_TERMINAL_REASON_RE = /\bin status (?:claimed|refunded|cancelled)$/;

/**
 * Categorizes why a rejected record did not apply, without deciding wording.
 * "already-terminal" means the rejection reason itself establishes that the
 * attempted frame was rejected because the contract had already reached a
 * terminal status (claimed/refunded/cancelled) at the moment it was
 * evaluated — e.g. a late cancel naming the wrong identity, arriving after
 * the deal was already claimed. Everything else — including "in status
 * accepted"/"in status locked" (rejected, but not because the deal was
 * already done) and reasons unrelated to status at all ("offer has
 * expired", "receipt before a terminal status") — is "not-applied". This
 * deliberately looks at the step's own reason, not the deal's eventual final
 * status: an early rejected frame in a deal that later completed normally
 * must not be mislabeled as "the agreement was already completed".
 *
 * @param {{reason?: string}} step
 * @returns {"already-terminal" | "not-applied"}
 */
export function rejectedRecordCategory(step) {
  return ALREADY_TERMINAL_REASON_RE.test(String(step?.reason ?? "")) ? "already-terminal" : "not-applied";
}
