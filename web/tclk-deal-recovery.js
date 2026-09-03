// Pure helpers for turning the server's durable, venue-timestamp-aware
// historical replay (lib/runtime/tclk-historical-replay.ts, exposed on the
// history-detail API as `historicalReplay`) into the same board-state shape
// the rest of tclk-deals.js already works with. No DOM, no fetch, no
// Date.now: an archived deal's true outcome must never be refolded against
// the current wall clock, which is exactly the bug this module exists to
// avoid reintroducing.

/**
 * @param {string} payerDid
 * @param {{status: string, contractId: string|null, payeeDid: string|null, steps: Array}} historicalReplayResult
 */
export function buildHistoricalBoardState(payerDid, historicalReplayResult) {
  return {
    status: historicalReplayResult.status,
    contract: historicalReplayResult.contractId,
    parties: { payer: payerDid, payee: historicalReplayResult.payeeDid },
    steps: historicalReplayResult.steps,
  };
}

/**
 * Locates the ACCEPT record for the true accepted contract id. Never falls
 * back to matching by offer id: an accepted agreement's contract id is a
 * distinct protocol identity from its offer id, and treating them as
 * interchangeable is the root cause this recovery path exists to avoid.
 *
 * @param {Array<{frame?: {type?: string, contract?: string}}>} records
 * @param {string|null} contractId
 */
export function findAcceptForContract(records, contractId) {
  if (!contractId) return null;
  return records.find((record) => record.frame?.type === "accept" && record.frame.contract === contractId) ?? null;
}
