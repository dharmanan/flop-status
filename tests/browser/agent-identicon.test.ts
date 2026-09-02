import { describe, expect, it } from "vitest";
import { createAgentIdenticonModel } from "../../web/agent-identicon.js";

describe("agent DID identicon", () => {
  it("is deterministic for the same DID", () => {
    const did = "did:key:z6Mkn7LCcVgptpXz141Fk58UUhfho77example";
    expect(createAgentIdenticonModel(did)).toEqual(createAgentIdenticonModel(did));
  });

  it("varies visual parameters across different DIDs", () => {
    const first = createAgentIdenticonModel("did:key:z6Mkfirstagent1111111111111111111111");
    const second = createAgentIdenticonModel("did:key:z6Mksecondagent22222222222222222222");
    expect(second).not.toEqual(first);
  });

  it("keeps palette and geometry inside the supported design system", () => {
    const model = createAgentIdenticonModel("did:key:z6Mkboundedagent3333333333333333333");
    expect(model.paletteIndex).toBeGreaterThanOrEqual(0);
    expect(model.paletteIndex).toBeLessThan(6);
    expect(model.spokes).toBeGreaterThanOrEqual(5);
    expect(model.spokes).toBeLessThanOrEqual(8);
    expect(model.orbitRadius).toBeGreaterThanOrEqual(18);
    expect(model.orbitRadius).toBeLessThanOrEqual(22);
  });
});
