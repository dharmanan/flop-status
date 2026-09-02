import { describe, expect, it } from "vitest";
import {
  buildCertificateShareText,
  buildCertificateSocialDescription,
  buildXIntentUrl,
  capabilityShareMeta,
  certificateOgImageUrl,
  certificatePublicUrl,
} from "../../web/certificate-share.js";

describe("shareable capability certificates", () => {
  it("maps every Core capability to its own social-card identity", () => {
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

  it("builds a public X share with handle, capability, count, rank, FLOP URL and @flop_labs", () => {
    const text = buildCertificateShareText({
      certificateId: "cert-123",
      capabilityId: "runtime.failure-recovery-idempotency",
      profile: { display_name: "kohen", handle: "koheneric" },
      certificateCount: 7,
      rank: "Core Verified",
      language: "tr",
      did: "did:key:z6Mkexample",
    });
    expect(text).toContain("FLOP handle: koheneric");
    expect(text).toContain("C7");
    expect(text).toContain("Hata Kurtarma ve İdempotans");
    expect(text).toContain("7 doğrulanmış yetenek");
    expect(text).toContain("Core Verified");
    expect(text).toContain(certificatePublicUrl("cert-123"));
    expect(text).toContain("@flop_labs");
    expect(text.length).toBeLessThan(280);
  });

  it("builds crawler metadata without depending on browser state", () => {
    const description = buildCertificateSocialDescription({
      capabilityId: "cryptography.signature-verification",
      profile: { display_name: "kohen", handle: "koheneric" },
      certificateCount: 7,
      rank: "Core Verified",
      did: "did:key:z6Mkexample",
    });
    expect(description).toContain("@koheneric");
    expect(description).toContain("C1");
    expect(description).toContain("7 verified capabilities");
    expect(buildXIntentUrl("hello FLOP")).toContain("twitter.com/intent/tweet?text=");
  });
});
