import { describe, expect, it } from "vitest";
import { TclkPaperRailAdapter } from "../../lib/runtime/tclk-paper-rail.js";
import type { TclkMcpClientLike, TclkToolName } from "../../lib/runtime/tclk-mcp-client.js";

const contract = `0x${"ab".repeat(32)}`;
const statement = `0x${"11".repeat(32)}`;
const secret = `0x${"22".repeat(32)}`;

class FakeMcp implements TclkMcpClientLike {
  async call<T = unknown>(tool: TclkToolName, args: Record<string, unknown>): Promise<T> {
    if (tool !== "tclk_verify_secret") throw new Error("unexpected tool");
    return { valid: args.secret === secret && args.statement === statement } as unknown as T;
  }
}

function noteFetch() {
  const values = new Map<string, string>();
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(String(input));
    const parts = url.pathname.split("/").filter(Boolean);
    const ns = parts[1] ?? "";
    const key = parts[2] ?? "";
    const path = `${ns}/${key}`;
    if (parts.length === 3) {
      const value = values.get(path);
      return value === undefined ? new Response("missing", { status: 404 }) : new Response(`!! untrusted content\n\n${value}\n`, { status: 200 });
    }
    if (parts[3] === "set") {
      const next = decodeURIComponent(parts[4] ?? "");
      const current = values.get(path);
      if (url.searchParams.get("if_absent") === "1" && current !== undefined) return new Response(current, { status: 409 });
      const expected = url.searchParams.get("if");
      if (expected !== null && current !== expected) return new Response(current ?? "", { status: 409 });
      values.set(path, next);
      return new Response("ok", { status: 200 });
    }
    return new Response("bad", { status: 400 });
  };
  return { values, fetchImpl: fetchImpl as typeof fetch };
}

describe("TclkPaperRailAdapter", () => {
  it("records a paper lock and claims only with a secret verified by official TCLK", async () => {
    const notes = noteFetch();
    let now = 1_000;
    const rail = new TclkPaperRailAdapter(new FakeMcp(), notes.fetchImpl, "https://technocore.chat", () => now);
    const locked = await rail.lock({ contract, statement, refundAfterMs: 10_000 });
    expect(locked.ref).toBe(contract);
    await expect(rail.read(contract)).resolves.toMatchObject({ status: "locked", statement, refundAfterMs: 10_000 });

    await expect(rail.claim(contract, `0x${"33".repeat(32)}`)).rejects.toThrow(/does not open/);
    expect((await rail.read(contract))?.status).toBe("locked");

    const claimed = await rail.claim(contract, secret);
    expect(claimed).toMatchObject({ status: "claimed", secret });
    expect((await rail.read(contract))?.status).toBe("claimed");

    now = 12_000;
    await expect(rail.refund(contract)).rejects.toThrow(/claimed/);
  });

  it("refuses refund before the deadline and allows it after the deadline", async () => {
    const notes = noteFetch();
    let now = 1_000;
    const rail = new TclkPaperRailAdapter(new FakeMcp(), notes.fetchImpl, "https://technocore.chat", () => now);
    await rail.lock({ contract, statement, refundAfterMs: 5_000 });
    await expect(rail.refund(contract)).rejects.toThrow(/before refundAfterMs/);
    expect((await rail.read(contract))?.status).toBe("locked");
    now = 5_000;
    await expect(rail.refund(contract)).resolves.toMatchObject({ status: "refunded" });
  });

  it("uses compare-and-set and refuses to overwrite an existing paper record", async () => {
    const notes = noteFetch();
    const rail = new TclkPaperRailAdapter(new FakeMcp(), notes.fetchImpl, "https://technocore.chat", () => 1_000);
    await rail.lock({ contract, statement, refundAfterMs: 5_000 });
    await expect(rail.lock({ contract, statement, refundAfterMs: 5_000 })).rejects.toThrow(/already has a record/);
  });
});
