export interface HistoricalReplayStepLike {
  index: number;
  type: string;
  ok: boolean;
  reason?: string;
}

export interface HistoricalReplayResultLike {
  status: string;
  contractId: string | null;
  payeeDid: string | null;
  steps: HistoricalReplayStepLike[];
}

export interface HistoricalBoardState {
  status: string;
  contract: string | null;
  parties: { payer: string; payee: string | null };
  steps: HistoricalReplayStepLike[];
}

export function buildHistoricalBoardState(payerDid: string, historicalReplayResult: HistoricalReplayResultLike): HistoricalBoardState;

export interface AcceptCandidateRecord {
  frame?: { type?: string; contract?: string };
}

export function findAcceptForContract<T extends AcceptCandidateRecord>(records: T[], contractId: string | null): T | null;

export interface MyDealLike {
  offer: { frame: { id: string } };
}

export type RecoveryResult<T extends MyDealLike> =
  | { ok: true; deal: T }
  | { ok: false; offerId: string; reason: string };

export function reconcileMyDeals<T extends MyDealLike>(
  liveDeals: T[],
  recoveryResults: RecoveryResult<T>[],
): { deals: T[]; recoveryIssues: Array<{ ok: false; offerId: string; reason: string }> };

export interface OfferVenueOrderedDeal {
  offer: { venueTimestampMs?: number | null; seq?: number; venue?: string };
}

export function newestOffersFirst<T extends OfferVenueOrderedDeal>(deals: T[]): T[];

/** True only when both values are the same explicit, non-empty canonical venue string. */
export function sameExplicitVenue(a: unknown, b: unknown): boolean;

export interface VenueOrderedRecord {
  venue?: unknown;
  venueTimestampMs?: number | null;
  seq?: number;
}

/** Ascending comparator for raw Technocore records that may span venues. */
export function venueSafeRecordOrder(a: VenueOrderedRecord, b: VenueOrderedRecord): number;
