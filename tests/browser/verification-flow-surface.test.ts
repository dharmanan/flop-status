import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flow = readFileSync(new URL("../../web/verification-flow.js", import.meta.url), "utf8");
const ceremony = readFileSync(new URL("../../web/verification-ceremony.js", import.meta.url), "utf8");
const ceremonyStyles = readFileSync(new URL("../../web/verification-ceremony-live.css", import.meta.url), "utf8");
const agent = readFileSync(new URL("../../web/agent.js", import.meta.url), "utf8");

describe("shared live verification ceremony", () => {
  it("declares the complete real verification sequence", () => {
    for (const step of ["challenge", "execute", "result", "sign", "verify", "verdict", "certificate"]) {
      expect(ceremony).toContain(`"${step}"`);
    }
  });

  it("contains bilingual copy for every real event", () => {
    expect(ceremony).toContain('challenge: ["Fresh challenge received", "Fresh challenge geldi"]');
    expect(ceremony).toContain('execute: ["Capability executed", "Capability çalıştı"]');
    expect(ceremony).toContain('result: ["Agent output created", "Ajan çıktısı oluştu"]');
    expect(ceremony).toContain('sign: ["DID signature attached", "DID imzası bağlandı"]');
    expect(ceremony).toContain('verify: ["FLOP verified independently", "FLOP bağımsız doğruladı"]');
    expect(ceremony).toContain('verdict: ["Decision recorded", "Karar kaydedildi"]');
    expect(ceremony).toContain('certificate: ["Certificate issued", "Certificate üretildi"]');
  });

  it("does not use timers to advance verification state", () => {
    for (const text of [flow, ceremony]) {
      expect(text).not.toMatch(/setInterval\s*\(/);
      expect(text).not.toMatch(/setTimeout\s*\(/);
    }
    expect(agent).not.toMatch(/setInterval\s*\(/);
    const timeouts = agent.match(/setTimeout\(/g) ?? [];
    expect(timeouts).toHaveLength(1);
    expect(agent).toContain("setTimeout(() => URL.revokeObjectURL(href), 0)");
  });

  it("uses finite Web Animations for visual storytelling while real state stays externally driven", () => {
    expect(ceremony).toContain("element.animate");
    expect(ceremony).toContain("visualTail = visualTail.then");
    expect(ceremony).toContain('function begin(step)');
    expect(ceremony).toContain('function complete(step, summary)');
    expect(flow).not.toContain("setTimeout");
  });

  it("keeps the live ceremony hidden until an explicit certification run resets it", () => {
    expect(ceremony).toContain("container.hidden = true");
    expect(ceremony).toContain('shell.classList.remove("ceremony-hidden-until-run")');
    expect(flow).toContain('container.dataset.verificationRunning = "true"');
    expect(flow.indexOf('container.dataset.verificationRunning = "true"')).toBeGreaterThan(flow.indexOf("reset()"));
  });

  it("shows actual visual transformations rather than seven static columns", () => {
    expect(ceremony).toContain("async function travel");
    expect(ceremony).toContain("animateChallenge");
    expect(ceremony).toContain("animateExecution");
    expect(ceremony).toContain("animateResult");
    expect(ceremony).toContain("animateSign");
    expect(ceremony).toContain("animateVerification");
    expect(ceremony).toContain("animateVerdict");
    expect(ceremony).toContain("animateCertificate");
    expect(ceremonyStyles).not.toContain("grid-template-columns: repeat(7");
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

  it("completes challenge only after the challenge API responds", () => {
    const beginIndex = agent.indexOf('flow.begin("challenge")');
    const awaitIndex = agent.indexOf('await jsonRequest("/api/v1/challenges"');
    const completeIndex = agent.indexOf('flow.complete("challenge"');
    expect(beginIndex).toBeLessThan(awaitIndex);
    expect(awaitIndex).toBeLessThan(completeIndex);
  });

  it("completes capability execution only after the installed module resolves", () => {
    const beginIndex = agent.indexOf('flow.begin("execute")');
    const executeIndex = agent.indexOf("await config.execute(challenge.case)");
    const completeIndex = agent.indexOf('flow.complete("execute"');
    expect(beginIndex).toBeLessThan(executeIndex);
    expect(executeIndex).toBeLessThan(completeIndex);
  });

  it("completes signing only after the browser DID key produces a signature", () => {
    const beginIndex = agent.indexOf('flow.begin("sign")');
    const signIndex = agent.indexOf("await crypto.subtle.sign(");
    const completeIndex = agent.indexOf('flow.complete("sign"');
    expect(beginIndex).toBeLessThan(signIndex);
    expect(signIndex).toBeLessThan(completeIndex);
  });

  it("forms a certificate only after receipt and certificate ids exist", () => {
    const guardIndex = agent.indexOf("if (!submitted.receipt_id || !submitted.certificate_id)");
    const certificateIndex = agent.indexOf('flow.complete("certificate"');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(certificateIndex);
  });

  it("reports FAIL without issuing a certificate", () => {
    expect(agent).toContain('flow.fail("verdict"');
    const failBlock = agent.slice(agent.indexOf('if (submitted.verdict !== "PASS")'), agent.indexOf('flow.complete("verdict"'));
    expect(failBlock).not.toContain('flow.complete("certificate"');
  });
});

describe("UNKNOWN stays distinct from FAIL", () => {
  it("routes VERIFICATION_UNKNOWN to unknown state", () => {
    expect(agent).toContain('error.message === "VERIFICATION_UNKNOWN"');
    expect(agent).toContain('flow.unknown("verify"');
    expect(agent).toContain('flow.unknown("verdict"');
    expect(ceremony).toContain('animateVerdict("unknown")');
  });
});

describe("ceremony visual contract", () => {
  it("models capability-specific challenge parts for C1-C4", () => {
    expect(ceremony).toContain('["public_key", "PUBLIC KEY"]');
    expect(ceremony).toContain('["document", "JSON"]');
    expect(ceremony).toContain('["room", "ROOM"]');
    expect(ceremony).toContain('["receipt", "RECEIPT"]');
  });

  it("visually separates agent execution from portable proof", () => {
    expect(ceremony).toContain('copy("STAYS INSIDE FLOP", "FLOP İÇİNDE KALIR")');
    expect(ceremony).toContain('copy("PORTABLE PROOF", "TAŞINABİLİR KANIT")');
    expect(ceremony).toContain("DID · Certificate · Receipt · Public proof");
  });

  it("does not add generic shadow styling", () => {
    expect(ceremonyStyles).not.toContain("box-shadow");
  });
});
