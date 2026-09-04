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

function hasUsableVenueTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The single place the venue-comparability rule lives. Two raw Technocore
 * seq numbers share a namespace only when both records carry the same
 * explicit, non-empty canonical venue. A missing or unknown venue on either
 * side is not evidence of sameness, so this fails closed. Venue strings
 * arrive already canonicalized from the server — nothing is normalized,
 * inferred, or defaulted here.
 *
 * @param {unknown} a
 * @param {unknown} b
 */
export function sameExplicitVenue(a, b) {
  return typeof a === "string" && typeof b === "string" && a.length > 0 && b.length > 0 && a === b;
}

/**
 * Orders "My deals" cards newest-OFFER-first — presentation only. Sorts
 * strictly by the OFFER record's own Technocore venue timestamp
 * (deal.offer.venueTimestampMs), never by a later state update, receipt, or
 * any other event, so a deal that changed status recently does not jump
 * above an older offer. Falls back to the offer's room sequence number
 * (deal.offer.seq) whenever either side lacks a usable venue timestamp, or
 * the timestamps are equal: every deal.offer record comes from the same
 * tclk-offers room, so a higher seq there is always later. Never touches
 * updatedAt/expiresMs/claimByMs/refundAfterMs. Returns a new array; the
 * input array (and its deal objects) are never mutated.
 *
 * @param {Array<{offer: {venueTimestampMs?: number|null, seq?: number}}>} deals
 */
export function newestOffersFirst(deals) {
  return [...deals].sort((a, b) => {
    const aTs = a.offer?.venueTimestampMs;
    const bTs = b.offer?.venueTimestampMs;
    if (hasUsableVenueTimestamp(aTs) && hasUsableVenueTimestamp(bTs) && aTs !== bTs) {
      return bTs - aTs;
    }
    // A room's seq namespace belongs to one venue and can restart when that
    // room is recreated, so seq may only order two offers that both carry
    // the same explicit venue. Anything else — differing venues, or a venue
    // missing on either side — contributes no ordering signal at all and
    // leaves the pair in stable input order rather than implying an order
    // neither side's seq actually carries.
    if (!sameExplicitVenue(a.offer?.venue, b.offer?.venue)) return 0;
    const aSeq = typeof a.offer?.seq === "number" ? a.offer.seq : 0;
    const bSeq = typeof b.offer?.seq === "number" ? b.offer.seq : 0;
    return bSeq - aSeq;
  });
}

/**
 * Orders raw Technocore records for display when the set can mix venues —
 * live records from the current operational venue alongside archived
 * records recovered from whichever venue that deal was actually made on
 * (see dealTranscript in tclk-deals.js). Authoritative venue timestamps
 * (the same field the durable replay orders by) decide chronologically
 * when both are present; seq is consulted only for two records sharing an
 * explicit venue; otherwise the pair keeps its input order. No cross-venue
 * seq order is invented, and no clock is read here.
 *
 * @param {{venue?: unknown, venueTimestampMs?: number|null, seq?: number}} a
 * @param {{venue?: unknown, venueTimestampMs?: number|null, seq?: number}} b
 */
export function venueSafeRecordOrder(a, b) {
  const aTs = a?.venueTimestampMs;
  const bTs = b?.venueTimestampMs;
  if (hasUsableVenueTimestamp(aTs) && hasUsableVenueTimestamp(bTs) && aTs !== bTs) {
    return aTs - bTs;
  }
  if (!sameExplicitVenue(a?.venue, b?.venue)) return 0;
  const aSeq = typeof a?.seq === "number" ? a.seq : 0;
  const bSeq = typeof b?.seq === "number" ? b.seq : 0;
  return aSeq - bSeq;
}
