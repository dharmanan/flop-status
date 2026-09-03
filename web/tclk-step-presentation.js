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

const TERMINAL_STATUSES = new Set(["claimed", "refunded", "cancelled"]);

/**
 * Categorizes why a rejected record did not apply, without deciding wording.
 * "already-terminal" is the common, expected case: a late signed record
 * (e.g. a cancel naming the wrong identity) arriving after the agreement was
 * already claimed, refunded, or cancelled.
 *
 * @param {string} dealStatus
 * @returns {"already-terminal" | "not-applied"}
 */
export function rejectedRecordCategory(dealStatus) {
  return TERMINAL_STATUSES.has(String(dealStatus)) ? "already-terminal" : "not-applied";
}
