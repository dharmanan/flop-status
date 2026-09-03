export class TechnocoreDirectPostError extends Error {
  status?: number;
  body?: string;
  cause?: unknown;
  constructor(message: string, detail?: Record<string, unknown>);
}

export interface DirectPostChallenge {
  nonce: number | string;
  text: string;
}

export interface DirectPostSigned {
  did: string;
  signature: string;
}

export function postSignedRecordDirect(
  room: string,
  challenge: DirectPostChallenge,
  signed: DirectPostSigned,
): Promise<{ posted: true }>;
