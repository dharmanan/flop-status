import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createTclkAwareHandler } from "../../lib/runtime/tclk-router.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function start(mcp: any, paper: any) {
  const fallback = (_req: any, res: any) => {
    res.writeHead(418, { "content-type": "application/json" });
    res.end(JSON.stringify({ fallback: true }));
  };
  const server = createServer(createTclkAwareHandler(fallback, mcp, paper));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test address");
  return `http://127.0.0.1:${address.port}`;
}

describe("TCLK runtime router", () => {
  it("proxies only the allowlisted official TCLK tools", async () => {
    const calls: any[] = [];
    const mcp = { call: async (tool: string, args: any) => { calls.push([tool, args]); return { line: "tclk1 {}" }; } };
    const base = await start(mcp, {});

    const ok = await fetch(`${base}/api/v1/tclk/tools/tclk_make_offer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "did:key:z6Mkexample" }),
    });
    expect(ok.status).toBe(200);
    expect(calls).toEqual([["tclk_make_offer", { from: "did:key:z6Mkexample" }]]);

    const denied = await fetch(`${base}/api/v1/tclk/tools/tclk_adaptor_presign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(denied.status).toBe(404);
    expect(await denied.json()).toMatchObject({ error: { code: "TCLK_TOOL_NOT_ALLOWED" } });
  });

  it("labels the status surface alpha and no-real-value", async () => {
    const mcp = { call: async () => ({ did: null, paymentPublicKey: null }) };
    const base = await start(mcp, {});
    const response = await fetch(`${base}/api/v1/tclk/status`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      protocol: "tclk/1",
      mode: "alpha-paper-only",
      real_value: false,
    });
  });

  it("returns an explicit no-value warning on PaperRail mutations", async () => {
    const paper = {
      lock: async () => ({ ref: `0x${"ab".repeat(32)}`, record: { status: "locked" } }),
    };
    const base = await start({ call: async () => ({}) }, paper);
    const response = await fetch(`${base}/api/v1/tclk/paper/lock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contract: `0x${"ab".repeat(32)}`, statement: `0x${"11".repeat(32)}`, refundAfterMs: Date.now() + 60_000 }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.warning).toMatch(/holds no value/i);
  });

  it("marks an existing PaperRail record as a recoverable lock conflict", async () => {
    const paper = {
      lock: async () => {
        throw Object.assign(new Error("paper rail already has a record for this contract"), {
          status: 409,
          code: "PAPER_RECORD_EXISTS",
        });
      },
    };
    const base = await start({ call: async () => ({}) }, paper);
    const response = await fetch(`${base}/api/v1/tclk/paper/lock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "PAPER_RECORD_EXISTS" } });
  });

  it("does not become a general Technocore room proxy", async () => {
    const base = await start({ call: async () => ({}) }, {});
    const response = await fetch(`${base}/api/v1/tclk/rooms/general-chat`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_TCLK_ROOM" } });
  });

  it("falls through for non-TCLK routes", async () => {
    const base = await start({ call: async () => ({}) }, {});
    const response = await fetch(`${base}/api/v1/health`);
    expect(response.status).toBe(418);
  });
});
