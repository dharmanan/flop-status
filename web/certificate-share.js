export const PUBLIC_APP_URL = "https://flop-status.vercel.app";
export const FLOP_X_HANDLE = "@flop_labs";

export const CERTIFICATE_CAPABILITIES = {
  "cryptography.signature-verification": {
    ordinal: 1,
    title: { en: "Ed25519 Signature Verification", tr: "Ed25519 İmza Doğrulama" },
    slug: "ed25519-signature-verification",
  },
  "data.canonical-json-sha256": {
    ordinal: 2,
    title: { en: "Canonical JSON + SHA256", tr: "Kanonik JSON + SHA256" },
    slug: "canonical-json-sha256",
  },
  "protocol.technocore-canonical-message": {
    ordinal: 3,
    title: { en: "Technocore Canonical Message", tr: "Technocore Kanonik Mesaj" },
    slug: "technocore-canonical-message",
  },
  "evidence.signed-receipt-verification": {
    ordinal: 4,
    title: { en: "Signed Receipt Verification", tr: "İmzalı Makbuz Doğrulama" },
    slug: "signed-receipt-verification",
  },
  "data.structured-transformation": {
    ordinal: 5,
    title: { en: "Structured Data Transformation", tr: "Yapılandırılmış Veri Dönüşümü" },
    slug: "structured-data-transformation",
  },
  "policy.constraint-compliance": {
    ordinal: 6,
    title: { en: "Constraint & Policy Compliance", tr: "Kısıt ve Politika Uyumluluğu" },
    slug: "constraint-policy-compliance",
  },
  "runtime.failure-recovery-idempotency": {
    ordinal: 7,
    title: { en: "Failure Recovery & Idempotency", tr: "Hata Kurtarma ve İdempotans" },
    slug: "failure-recovery-idempotency",
  },
};

export function capabilityShareMeta(capabilityId) {
  return CERTIFICATE_CAPABILITIES[capabilityId] ?? {
    ordinal: 0,
    title: { en: "Verified Flop Proof Capability", tr: "Doğrulanmış Flop Proof Yeteneği" },
    slug: "verified-capability",
  };
}

export function certificatePublicUrl(certificateId) {
  return `${PUBLIC_APP_URL}/certificate/${encodeURIComponent(String(certificateId ?? ""))}`;
}

export function certificateOgImageUrl(capabilityId) {
  const ordinal = capabilityShareMeta(capabilityId).ordinal || 1;
  return `${PUBLIC_APP_URL}/certificate-card/c${ordinal}.png`;
}

export function rankName(rank) {
  if (typeof rank === "string") return rank.trim();
  if (!rank || typeof rank !== "object") return "";
  return String(rank.rank_name ?? "").trim();
}

function cleanHandle(handle) {
  return String(handle ?? "").trim().replace(/^@+/, "");
}

function identityParts(profile, did) {
  const name = String(profile?.display_name ?? "").trim();
  const handle = cleanHandle(profile?.handle);
  const fallback = String(did ?? "").slice(0, 24);
  return { name, handle, fallback };
}

export function buildCertificateShareText({
  certificateId,
  capabilityId,
  profile = null,
  certificateCount = 1,
  rank = null,
  language = "en",
  did = "",
}) {
  const meta = capabilityShareMeta(capabilityId);
  const identity = identityParts(profile, did);
  const count = Math.max(1, Number(certificateCount) || 1);
  const url = certificatePublicUrl(certificateId);
  const safeRank = rankName(rank);

  if (language === "tr") {
    const subject = identity.name || "Flop Proof ajanı";
    const line1 = `${subject}, Flop Proof'ta C${meta.ordinal} · ${meta.title.tr} yeteneğini doğruladı.`;
    const identityPrefix = identity.handle ? `Flop Proof: ${identity.handle} · ` : "";
    const line2 = `${identityPrefix}${count} doğrulanmış yetenek${safeRank ? ` · ${safeRank}` : ""}`;
    return `${line1}\n${line2}\nKanıt: ${url}\n${FLOP_X_HANDLE}`;
  }

  const subject = identity.name || "Flop Proof agent";
  const line1 = `${subject} verified C${meta.ordinal} · ${meta.title.en} on Flop Proof.`;
  const identityPrefix = identity.handle ? `Flop Proof: ${identity.handle} · ` : "";
  const line2 = `${identityPrefix}${count} verified ${count === 1 ? "capability" : "capabilities"}${safeRank ? ` · ${safeRank}` : ""}`;
  return `${line1}\n${line2}\nProof: ${url}\n${FLOP_X_HANDLE}`;
}

export function buildCertificateSocialDescription({
  capabilityId,
  profile = null,
  certificateCount = 1,
  rank = null,
  did = "",
}) {
  const meta = capabilityShareMeta(capabilityId);
  const identity = identityParts(profile, did);
  const count = Math.max(1, Number(certificateCount) || 1);
  const rankText = rankName(rank);
  const label = identity.name || identity.fallback || "Flop Proof Agent";
  const handleText = identity.handle ? ` · Flop Proof: ${identity.handle}` : "";
  return `${label}${handleText} · C${meta.ordinal} ${meta.title.en} · ${count} verified ${count === 1 ? "capability" : "capabilities"}${rankText ? ` · ${rankText}` : ""}`;
}

export function buildXIntentUrl(shareText) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(String(shareText ?? ""))}`;
}
