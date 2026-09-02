import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flow = readFileSync(new URL("../../web/verification-flow.js", import.meta.url), "utf8");
const names = readFileSync(new URL("../../web/capability-names.js", import.meta.url), "utf8");

describe("verification terminal state", () => {
  it("stops treating PASS, FAIL and UNKNOWN as actively verifying", () => {
    expect(flow).toContain('if (stepId === "certificate") container.dataset.verificationRunning = "completed"');
    expect(flow).toContain('if (stepId === "verdict") container.dataset.verificationRunning = "completed"');
  });

  it("keeps certified visual state green even if stale verifying metadata exists", () => {
    expect(names).toContain('.shell-state-badge[data-certified="true"]');
    expect(names).toContain('.capability-selector-button[data-certified="true"]');
    expect(names).toContain('background: #09150f !important');
    expect(names).toContain('background: #0b1b12 !important');
  });
});
