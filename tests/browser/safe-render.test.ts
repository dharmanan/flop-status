import { describe, expect, it } from "vitest";
import { fillTclkProofSlots, renderProfileResultButton } from "../../web/safe-render.js";

/**
 * A minimal fake DOM element. `innerHTML` is a setter that always throws — the
 * regression these tests guard against is exactly "an untrusted value reaches
 * an HTML sink", so any code path that still did `el.innerHTML = untrustedValue`
 * would fail these tests loudly instead of silently passing a string-match check.
 */
class FakeElement {
  readonly tag: string;
  type = "";
  className = "";
  textContent = "";
  children: FakeElement[] = [];
  private readonly slots = new Map<string, FakeElement>();

  constructor(tag: string) {
    this.tag = tag;
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  registerSlot(selector: string, element: FakeElement): void {
    this.slots.set(selector, element);
  }

  querySelector(selector: string): FakeElement {
    const found = this.slots.get(selector);
    if (!found) throw new Error(`no fake slot registered for ${selector}`);
    return found;
  }

  set innerHTML(_value: string) {
    throw new Error(`innerHTML must never be assigned for untrusted content (attempted on <${this.tag}>)`);
  }
}

function fakeDocument() {
  return { createElement: (tag: string) => new FakeElement(tag) };
}

describe("renderProfileResultButton (agent profile search — XSS fix)", () => {
  it("renders an attacker-controlled display name as text, never as HTML", () => {
    const malicious = {
      displayName: '<img src=x onerror="window.pwned=true">',
      handle: "atlas7k2",
      did: "did:key:z6MkExample",
    };

    const button = renderProfileResultButton(malicious, fakeDocument()) as FakeElement;

    expect(button.tag).toBe("button");
    expect(button.className).toBe("profile-search-result");
    const [name, handle, did] = button.children;
    expect(name?.tag).toBe("strong");
    expect(name?.textContent).toBe(malicious.displayName);
    expect(handle?.tag).toBe("span");
    expect(handle?.textContent).toBe(`@${malicious.handle}`);
    expect(did?.tag).toBe("code");
    expect(did?.textContent).toBe(malicious.did);
    // Reaching this line proves innerHTML was never assigned on any created
    // element (the FakeElement setter above throws synchronously if it is).
  });

  it("handles an ordinary profile the same way (no special-casing of safe input)", () => {
    const button = renderProfileResultButton(
      { displayName: "Atlas", handle: "atlas7k2", did: "did:key:z1" },
      fakeDocument(),
    ) as FakeElement;
    expect(button.children.map((child) => child.textContent)).toEqual(["Atlas", "@atlas7k2", "did:key:z1"]);
  });
});

describe("fillTclkProofSlots (TCLK Deal Proof — XSS fix)", () => {
  function proofFixture() {
    const proof = new FakeElement("section");
    const amount = new FakeElement("h2");
    const status = new FakeElement("strong");
    const contract = new FakeElement("code");
    const rail = new FakeElement("strong");
    proof.registerSlot(".proof-amount-slot", amount);
    proof.registerSlot(".tclk-proof-state", status);
    proof.registerSlot(".proof-contract-slot", contract);
    proof.registerSlot(".proof-rail-slot", rail);
    return { proof, amount, status, contract, rail };
  }

  it("renders an attacker-controlled asset label as text, never as HTML", () => {
    const { proof, amount } = proofFixture();
    const offer = { amount: "1000", asset: "<script>alert(1)</script>", id: `0x${"a".repeat(64)}` };
    const state = { status: "locked", contract: null, rail: null };

    fillTclkProofSlots(proof, offer, state);

    expect(amount.textContent).toBe(`${offer.amount} ${offer.asset}`);
  });

  it("renders untrusted status/contract/rail from the Technocore transcript as text", () => {
    const { proof, status, contract, rail } = proofFixture();
    const offer = { amount: "1000", asset: "PAPER", id: `0x${"b".repeat(64)}` };
    const state = { status: "claimed", contract: `0x${"c".repeat(64)}`, rail: "<b>paper</b>" };

    fillTclkProofSlots(proof, offer, state);

    expect(status.textContent).toBe("CLAIMED");
    expect(contract.textContent).toBe(state.contract);
    expect(rail.textContent).toBe(state.rail);
  });

  it("falls back to the offer id / \"paper\" when state omits contract/rail", () => {
    const { proof, contract, rail } = proofFixture();
    const offer = { amount: "1000", asset: "PAPER", id: `0x${"d".repeat(64)}` };
    const state = { status: "proposed" };

    fillTclkProofSlots(proof, offer, state);

    expect(contract.textContent).toBe(offer.id);
    expect(rail.textContent).toBe("paper");
  });
});
