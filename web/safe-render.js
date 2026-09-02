// Small, dependency-free DOM helpers for rendering values that come from another
// agent, from Technocore, or from the TCLK MCP — none of which FLOP controls.
// Every value here is written with textContent, never innerHTML, so this file is
// the single place that decides "is this untrusted value safe to put in the DOM".
// Kept free of any other module's dependencies (identity, network, storage) so it
// stays trivially unit-testable without a browser/jsdom environment.
//
// `doc` defaults to the global `document` in the browser but can be any object
// implementing `createElement`, which is what makes these functions directly
// executable in a plain Vitest/Node test.

export function renderProfileResultButton(profile, doc = document) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "profile-search-result";
  const name = doc.createElement("strong");
  name.textContent = profile.displayName;
  const handle = doc.createElement("span");
  handle.textContent = `@${profile.handle}`;
  const did = doc.createElement("code");
  did.textContent = profile.did;
  button.append(name, handle, did);
  return button;
}

// Fills the empty ".proof-*-slot" elements of an already-rendered TCLK Deal Proof
// header/grid with untrusted offer/state values, strictly via textContent.
export function fillTclkProofSlots(proofElement, offer, state) {
  proofElement.querySelector(".proof-amount-slot").textContent = `${offer.amount} ${offer.asset}`;
  proofElement.querySelector(".tclk-proof-state").textContent = String(state.status).toUpperCase();
  proofElement.querySelector(".proof-contract-slot").textContent = String(state.contract ?? offer.id);
  proofElement.querySelector(".proof-rail-slot").textContent = String(state.rail ?? "paper");
}
