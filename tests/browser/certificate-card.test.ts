import { describe, expect, it } from "vitest";
import { renderCertificateCard } from "../../api/certificate-card.js";

describe("capability certificate social card", () => {
  it("returns a valid PNG for every Core capability", () => {
    for (let capability = 1; capability <= 7; capability += 1) {
      const image = renderCertificateCard(capability);
      expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(image.length).toBeGreaterThan(5_000);
    }
  });

  it("varies the rendered card by capability", () => {
    expect(renderCertificateCard(1).equals(renderCertificateCard(7))).toBe(false);
  });
});
