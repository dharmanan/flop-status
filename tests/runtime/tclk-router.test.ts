import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTclkAwareHandler, parseRoomGeneration } from "../../lib/runtime/tclk-router.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function start(mcp: any, paper: any, history?: any) {
  const fallback = (_req: any, res: any) => {
    res.writeHead(418, { "content-type": "application/json" });
    res.end(JSON.stringify({ fallback: true }));
  };
  const server = createServer(createTclkAwareHandler(fallback, mcp, paper, history));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test address");
  return `http://127.0.0.1:${address.port}`;
}

describe("parseRoomGeneration", () => {
  it("accepts a positive integer as a known generation", () => {
    expect(parseRoomGeneration(1)).toBe(1);
    expect(parseRoomGeneration(42)).toBe(42);
  });

  // 0 is Technocore's own meaning for "room never existed" — inconsistent
  // with a message-bearing room, so it must never be treated as a known
  // generation to persist on a frame.
  it("treats 0 as unknown, never as a known generation", () => {
    expect(parseRoomGeneration(0)).toBeNull();
  });

  it("treats absent, non-numeric, and negative values as unknown", () => {
    expect(parseRoomGeneration(undefined)).toBeNull();
    expect(parseRoomGeneration(null)).toBeNull();
    expect(parseRoomGeneration("1")).toBeNull();
    expect(parseRoomGeneration(-1)).toBeNull();
    expect(parseRoomGeneration(Number.NaN)).toBeNull();
    expect(parseRoomGeneration(1.5)).toBeNull();
  });
});

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

  // The browser has no other way to learn which venue a live record came
  // from, and must never be trusted to supply one for a live read.
  it("returns the server's canonical operational venue alongside a live room read", async () => {
    vi.stubEnv("TECHNOCORE_URL", "https://selfhost.example.invalid/");
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String((input as { url?: string })?.url ?? input);
      if (url.startsWith("https://selfhost.example.invalid")) {
        return new Response(JSON.stringify({ room: "tclk-offers", messages: [], last_seq: 0, generation: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return realFetch(input as Parameters<typeof fetch>[0], init);
    });

    const base = await start({ call: async () => ({}) }, {});
    const response = await fetch(`${base}/api/v1/tclk/rooms/tclk-offers`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { venue: string; room: { room: string } };
    // Canonicalized: the configured trailing slash is not echoed back.
    expect(body.venue).toBe("https://selfhost.example.invalid");
    expect(body.room.room).toBe("tclk-offers");
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

describe("TCLK runtime router — history detail venue handling", () => {
  const OFFER_ID = `0x${"a1".repeat(32)}`;

  it("passes the ?venue= query parameter through to history.getByOfferId, canonicalized", async () => {
    const calls: Array<[string, string | undefined]> = [];
    const history = {
      getByOfferId: async (id: string, venue?: string) => {
        calls.push([id, venue]);
        return { status: "found", deal: { offerId: id, venue }, frames: [], historicalReplay: { complete: false, reason: "n/a" } };
      },
    };
    const base = await start({ call: async () => ({}) }, {}, history);

    // A trailing slash must canonicalize to the same identity the server
    // itself stores — a client passing a non-canonical venue must not
    // silently fail to match.
    const response = await fetch(`${base}/api/v1/tclk/history/${OFFER_ID}?venue=https://technocore.chat/`);
    expect(response.status).toBe(200);
    expect(calls).toEqual([[OFFER_ID, "https://technocore.chat"]]);
  });

  it("returns 400 INVALID_VENUE for a malformed venue query parameter, without ever calling history.getByOfferId", async () => {
    const getByOfferId = async () => ({ status: "not_found" as const });
    const history = { getByOfferId };
    const base = await start({ call: async () => ({}) }, {}, history);

    const response = await fetch(`${base}/api/v1/tclk/history/${OFFER_ID}?venue=not-a-url`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_VENUE" } });
  });

  it("returns 409 AMBIGUOUS_VENUE — never an arbitrary deal — when the same offer id exists on more than one venue", async () => {
    const venues = ["https://technocore.chat", "https://selfhost.example.invalid"];
    const history = { getByOfferId: async () => ({ status: "ambiguous" as const, venues }) };
    const base = await start({ call: async () => ({}) }, {}, history);

    const response = await fetch(`${base}/api/v1/tclk/history/${OFFER_ID}`);
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string; venues: string[] } };
    expect(body.error.code).toBe("AMBIGUOUS_VENUE");
    expect(body.error.venues).toEqual(venues);
  });

  it("returns 404 when history reports not_found", async () => {
    const history = { getByOfferId: async () => ({ status: "not_found" as const }) };
    const base = await start({ call: async () => ({}) }, {}, history);

    const response = await fetch(`${base}/api/v1/tclk/history/${OFFER_ID}`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "TCLK_HISTORY_NOT_FOUND" } });
  });
});
