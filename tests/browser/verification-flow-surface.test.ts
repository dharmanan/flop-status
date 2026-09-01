import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flow = readFileSync(new URL("../../web/verification-flow.js", import.meta.url), "utf8");
const agent = readFileSync(new URL("../../web/agent.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../web/styles.css", import.meta.url), "utf8");

describe("shared verification run surface", () => {
  it("declares the full sequence of user-visible steps", () => {
    for (const step of ["challenge", "execute", "result", "sign", "verify", "verdict", "certificate"]) {
      expect(flow).toContain(`"${step}"`);
    }
  });

  it("offers both languages for every step title", () => {
    const titles = flow.match(/\[".+?", ".+?"\]/g) ?? [];
    expect(titles.length).toBeGreaterThanOrEqual(7);
    expect(flow).toContain("DOĞRULAMA AKIŞI");
    expect(flow).toContain("VERIFICATION RUN");
  });

  it("never fakes progress with timers, intervals or animation loops", () => {
    for (const text of [flow, agent]) {
      expect(text).not.toMatch(/setInterval\s*\(/);
      expect(text).not.toMatch(/requestAnimationFrame\s*\(/);
    }
    // agent.js keeps exactly one setTimeout, and it only revokes a blob URL
    // after a download; it never advances verification state.
    const timeouts = agent.match(/setTimeout\(/g) ?? [];
    expect(timeouts).toHaveLength(1);
    expect(agent).toContain("setTimeout(() => URL.revokeObjectURL(href), 0)");
    expect(flow).not.toMatch(/setTimeout\s*\(/);
  });
});

describe("verification steps are bound to real operations", () => {
  const boundSteps: Array<[string, string]> = [
    ['flow.begin("challenge")', 'flow.complete("challenge"'],
    ['flow.begin("execute")', 'flow.complete("execute"'],
    ['flow.begin("result")', 'flow.complete("result"'],
    ['flow.begin("sign")', 'flow.complete("sign"'],
    ['flow.begin("verify")', 'flow.complete("verify"'],
  ];

  for (const [begin, complete] of boundSteps) {
    it(`${begin} is completed by a real operation result`, () => {
      expect(agent).toContain(begin);
      expect(agent).toContain(complete);
      expect(agent.indexOf(begin)).toBeLessThan(agent.indexOf(complete));
    });
  }

  it("completes the challenge step only after the challenge API responds", () => {
    const beginIndex = agent.indexOf('flow.begin("challenge")');
    const awaitIndex = agent.indexOf('await jsonRequest("/api/v1/challenges"');
    const completeIndex = agent.indexOf('flow.complete("challenge"');
    expect(beginIndex).toBeLessThan(awaitIndex);
    expect(awaitIndex).toBeLessThan(completeIndex);
  });

  it("completes the capability step only after the installed module resolves", () => {
    const beginIndex = agent.indexOf('flow.begin("execute")');
    const executeIndex = agent.indexOf("await config.execute(challenge.case)");
    const completeIndex = agent.indexOf('flow.complete("execute"');
    expect(beginIndex).toBeLessThan(executeIndex);
    expect(executeIndex).toBeLessThan(completeIndex);
  });

  it("completes the signing step only after the browser key produces a signature", () => {
    const beginIndex = agent.indexOf('flow.begin("sign")');
    const signIndex = agent.indexOf("await crypto.subtle.sign(");
    const completeIndex = agent.indexOf('flow.complete("sign"');
    expect(beginIndex).toBeLessThan(signIndex);
    expect(signIndex).toBeLessThan(completeIndex);
  });

  it("shows the certificate step only when a certificate id came back", () => {
    const certificateIndex = agent.indexOf("if (!submitted.receipt_id || !submitted.certificate_id)");
    const showIndex = agent.indexOf("flow.showCertificateStep()");
    expect(certificateIndex).toBeGreaterThan(-1);
    expect(certificateIndex).toBeLessThan(showIndex);
  });

  it("reports FAIL without a certificate step", () => {
    expect(agent).toContain('flow.fail("verdict"');
    const failBlock = agent.slice(agent.indexOf('if (submitted.verdict !== "PASS")'), agent.indexOf('flow.complete("verdict"'));
    expect(failBlock).not.toContain("showCertificateStep");
  });
});

describe("UNKNOWN is never presented as FAIL", () => {
  it("routes VERIFICATION_UNKNOWN to the unknown state", () => {
    expect(agent).toContain('error.message === "VERIFICATION_UNKNOWN"');
    expect(agent).toContain('flow.unknown("verify"');
    expect(agent).toContain('flow.unknown("verdict"');
  });

  it("styles the unknown state differently from the fail state", () => {
    expect(styles).toContain('.flow-step[data-state="unknown"] .flow-marker');
    expect(styles).toContain('.flow-step[data-state="fail"] .flow-marker');
    const unknownMarker = styles.match(/\.flow-step\[data-state="unknown"\] \.flow-marker \{[^}]*\}/)?.[0];
    const failMarker = styles.match(/\.flow-step\[data-state="fail"\] \.flow-marker \{[^}]*\}/)?.[0];
    expect(unknownMarker).toBeTruthy();
    expect(failMarker).toBeTruthy();
    expect(unknownMarker).not.toBe(failMarker);
  });
});

describe("verification flow motion stays quiet and accessible", () => {
  it("uses short transitions rather than looping animations", () => {
    expect(styles).toContain(".flow-marker");
    expect(styles).not.toMatch(/@keyframes\s+flow/);
    expect(styles).not.toMatch(/animation:\s*[^;]*infinite/);
  });

  it("respects prefers-reduced-motion", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    const block = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain("transition: none");
  });

  it("avoids gradients, glow and neon in the flow surface", () => {
    const flowStyles = styles.slice(styles.indexOf(".verification-flow"));
    expect(flowStyles).not.toContain("gradient");
    expect(flowStyles).not.toContain("box-shadow");
    expect(flowStyles).not.toContain("filter: blur");
  });
});
