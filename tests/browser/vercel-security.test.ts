import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel browser custody security", () => {
  it("uses a strict self-hosted script policy and bounded API connection policy", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
    const headers = config.headers?.[0]?.headers ?? [];
    const byKey = new Map(headers.map((entry: { key: string; value: string }) => [entry.key, entry.value]));
    const csp = byKey.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https://flop-status-production.up.railway.app https://technocore.chat");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(byKey.get("Referrer-Policy")).toBe("no-referrer");
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
