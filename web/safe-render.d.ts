export interface ElementFactory {
  createElement(tag: string): any;
}

export interface ProfileLike {
  displayName: string;
  handle: string;
  did: string;
}

export function renderProfileResultButton(profile: ProfileLike, doc?: ElementFactory): any;

export interface QuerySelectable {
  querySelector(selector: string): { textContent: string } | null | undefined;
}

export interface TclkOfferLike {
  amount: string | number;
  asset: string;
  id: string;
}

export interface TclkStateLike {
  status: string;
  contract?: string | null;
  rail?: string | null;
}

export function fillTclkProofSlots(proofElement: QuerySelectable, offer: TclkOfferLike, state: TclkStateLike): void;
