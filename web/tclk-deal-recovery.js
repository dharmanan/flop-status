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

/**
 * Merges the live offer-board's "mine" deals with durable-history recovery
 * results, for a single offer id at a time. Once an offer id is known to
 * exist in durable history, its live Date.now-derived entry is never left in
 * place: a complete recovery replaces it, and an incomplete one removes it
 * outright and reports it as a recovery issue instead. This is what keeps a
 * stale live replay from silently standing in for an offer id whose durable
 * history could not be confirmed — fail closed, not "fail to whatever was
 * already there".
 *
 * @param {Array<{offer: {frame: {id: string}}}>} liveDeals
 * @param {Array<{ok: true, deal: {offer: {frame: {id: string}}}} | {ok: false, offerId: string, reason: string}>} recoveryResults
 */
export function reconcileMyDeals(liveDeals, recoveryResults) {
  const byOfferId = new Map(liveDeals.map((deal) => [deal.offer.frame.id, deal]));
  const recoveryIssues = [];
  for (const recovered of recoveryResults) {
    if (recovered.ok) {
      byOfferId.set(recovered.deal.offer.frame.id, recovered.deal);
    } else {
      byOfferId.delete(recovered.offerId);
      recoveryIssues.push(recovered);
    }
  }
  return { deals: [...byOfferId.values()], recoveryIssues };
}
