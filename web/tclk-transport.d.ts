export interface TransportMessageLike {
  from: string;
  sig: string;
  nonce: unknown;
  text: string;
}

export function verifyTransport(room: string, message: Partial<TransportMessageLike> | null | undefined): Promise<boolean>;

export interface FrameLike {
  from?: string;
}

export interface DecodedFrameItemLike {
  from?: string;
  frame?: FrameLike;
}

export function evaluateFrameTrust(
  item: DecodedFrameItemLike | null | undefined,
  message: TransportMessageLike,
  transportValid: boolean,
): { fromMatches: boolean; trusted: boolean };
