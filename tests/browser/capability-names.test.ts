import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { capabilityDisplayName, capabilityNumberFromId } from "../../web/capability-names.js";

const profileHint = readFileSync(new URL("../../web/tclk-profile-hint.js", import.meta.url), "utf8");

describe("localized capability display names", () => {
  it("returns Turkish user-facing names without changing capability ids", () => {
    expect(capabilityDisplayName(1, "tr")).toBe("Ed25519 İmza Doğrulama");
    expect(capabilityDisplayName(2, "tr")).toBe("Kanonik JSON + SHA256");
    expect(capabilityDisplayName(3, "tr")).toBe("Technocore Kanonik Mesaj");
    expect(capabilityDisplayName(4, "tr")).toBe("İmzalı Makbuz Doğrulama");
    expect(capabilityDisplayName(5, "tr")).toBe("Yapılandırılmış Veri Dönüşümü");
    expect(capabilityDisplayName(6, "tr")).toBe("Kısıt ve Politika Uyumluluğu");
    expect(capabilityDisplayName(7, "tr")).toBe("Hata Kurtarma ve İdempotans");
    expect(capabilityNumberFromId("cryptography.signature-verification")).toBe(1);
    expect(capabilityNumberFromId("runtime.failure-recovery-idempotency")).toBe(7);
  });

  it("keeps the existing English display names", () => {
    expect(capabilityDisplayName(1, "en")).toBe("Ed25519 Signature Verification");
    expect(capabilityDisplayName(7, "en")).toBe("Failure Recovery & Idempotency");
  });

  it("is loaded by the live dashboard module chain", () => {
    expect(profileHint).toContain('import("/capability-names.js?v=capability-names-v2")');
  });
});
