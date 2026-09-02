import { describe, expect, it } from "vitest";
import { restoreProductSecondaryView } from "../../web/workspace-return-guard.js";

describe("workspace return guard", () => {
  it("restores a product secondary view after leaving Network, Mailbox, or Deals", () => {
    let removed = "";
    const secondary = {
      hidden: true,
      classList: { remove(value: string) { removed = value; } },
    };
    const item = { dataset: { view: "overview" } };
    const target = { closest(selector: string) { return selector === ".product-nav-item" ? item : null; } };
    const shell = { querySelector(selector: string) { return selector === ".workspace-secondary-view" ? secondary : null; } };

    expect(restoreProductSecondaryView(shell as never, target as never)).toBe(true);
    expect(removed).toBe("shell-view-hidden");
    expect(secondary.hidden).toBe(false);
  });

  it("does not interfere with the dedicated Capabilities workspace", () => {
    let touched = false;
    const item = { dataset: { view: "capabilities" } };
    const target = { closest(selector: string) { return selector === ".product-nav-item" ? item : null; } };
    const shell = { querySelector() { touched = true; return null; } };

    expect(restoreProductSecondaryView(shell as never, target as never)).toBe(false);
    expect(touched).toBe(false);
  });
});
