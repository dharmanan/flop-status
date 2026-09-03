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
