export interface CardLike {
  dataset: { offerId?: string; contractId?: string };
}

export interface ProtocolId {
  offerId: string;
  contractId?: string | null;
}

export function matchCardByProtocolId<T extends CardLike>(cards: T[], id: ProtocolId): T | null;
