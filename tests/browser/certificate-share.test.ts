import { describe, expect, it } from "vitest";
import {
  buildCertificateShareText,
  buildCertificateSocialDescription,
  buildXIntentUrl,
  capabilityShareMeta,
  certificateOgImageUrl,
  certificatePublicUrl,
  rankName,
} from "../../web/certificate-share.js";

describe("shareable capability certificates", () => {
  it("maps every Core capability to its own certificate identity", () => {
    const ids = [
      "cryptography.signature-verification",
      "data.canonical-json-sha256",
      "protocol.technocore-canonical-message",
      "evidence.signed-receipt-verification",
      "data.structured-transformation",
      "policy.constraint-compliance",
      "runtime.failure-recovery-idempotency",
    ];
    expect(ids.map((id) => capabilityShareMeta(id).ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(ids.map(certificateOgImageUrl)).size).toBe(7);
  });

  it("normalizes the API rank object to its public rank name", () => {
    expect(rankName({ rank_id: "core-verified", rank_name: "Core Verified", min_certificates: 7 })).toBe("Core Verified");
    expect(rankName("Regular")).toBe("Regular");
    expect(rankName(null)).toBe("");
  });

  it("uses the canonical proof URL directly in the X share text", () => {
    const text = buildCertificateShareText({
      certificateId: "cert-123",
      capabilityId: "runtime.failure-recovery-idempotency",
      profile: { display_name: "kohen", handle: "koheneric" },
      certificateCount: 7,
      rank: { rank_id: "core-verified", rank_name: "Core Verified", min_certificates: 7 },
      language: "tr",
      did: "did:key:z6Mkexample",
    });
    expect(text).toContain("kohen, Flop Proof'ta C7");
    expect(text).toContain("Flop Proof: koheneric");
    expect(text).toContain("Hata Kurtarma ve İdempotans");
    expect(text).toContain("7 doğrulanmış yetenek");
    expect(text).toContain("Core Verified");
    expect(text).toContain(certificatePublicUrl("cert-123"));
    expect(text).not.toContain("?share=");
    expect(text).toContain("@flop_labs");
    expect(text).not.toContain("[object Object]");
    expect(text.length).toBeLessThan(280);
  });

  it("keeps social description helpers free of object stringification", () => {
    const description = buildCertificateSocialDescription({
      capabilityId: "cryptography.signature-verification",
      profile: { display_name: "kohen", handle: "koheneric" },
      certificateCount: 7,
      rank: { rank_id: "core-verified", rank_name: "Core Verified", min_certificates: 7 },
      did: "did:key:z6Mkexample",
    });
    expect(description).toContain("kohen");
    expect(description).toContain("Flop Proof: koheneric");
    expect(description).toContain("Core Verified");
    expect(description).not.toContain("[object Object]");
    expect(buildXIntentUrl("hello FLOP")).toContain("twitter.com/intent/tweet?text=");
  });
});
