export interface AgentShareProfile {
  display_name?: string | null;
  handle?: string | null;
}
export interface CertificateShareInput {
  certificateId: string;
  capabilityId: string;
  profile?: AgentShareProfile | null;
  certificateCount?: number;
  rank?: string | null;
  language?: "en" | "tr";
  did?: string;
}
export declare const PUBLIC_APP_URL: string;
export declare const FLOP_X_HANDLE: string;
export declare const CERTIFICATE_CAPABILITIES: Record<string, {
  ordinal: number;
  title: { en: string; tr: string };
  slug: string;
}>;
export function capabilityShareMeta(capabilityId: string): {
  ordinal: number;
  title: { en: string; tr: string };
  slug: string;
};
export function certificatePublicUrl(certificateId: string): string;
export function certificateOgImageUrl(capabilityId: string): string;
export function buildCertificateShareText(input: CertificateShareInput): string;
export function buildCertificateSocialDescription(input: Omit<CertificateShareInput, "certificateId" | "language">): string;
export function buildXIntentUrl(shareText: string): string;
