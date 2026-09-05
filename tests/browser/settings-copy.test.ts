import { describe, expect, it } from "vitest";
import { settingsCustodyCopy } from "../../web/settings-copy.js";

describe("settings custody copy", () => {
  it("uses natural Turkish without changing the custody claim", () => {
    const text = settingsCustodyCopy("tr");
    expect(text).toContain("Aktif imzalama anahtarı");
    expect(text).toContain("IndexedDB");
    expect(text).toContain("Flop Proof değil");
    expect(text).not.toContain("signing key");
  });
});
