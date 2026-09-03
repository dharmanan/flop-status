import { afterEach, describe, expect, it, vi } from "vitest";
import { TechnocoreDirectPostError, postSignedRecordDirect } from "../../web/technocore-direct-post.js";

const ROOM = "mb-p-tclk-0123456789abcdef";
const CHALLENGE = { nonce: 42, text: '{"type":"offer"}' };
const SIGNED = { did: "did:key:z6MkExample", signature: "c2lnbmF0dXJl" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postSignedRecordDirect", () => {
  it("POSTs to the exact Technocore URL with the exact JSON body, and treats 200 as success", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await postSignedRecordDirect(ROOM, CHALLENGE, SIGNED);

    expect(result).toEqual({ posted: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`https://technocore.chat/r/${ROOM}?format=json`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      did: SIGNED.did,
      sig: SIGNED.signature,
      nonce: "42",
      text: CHALLENGE.text,
    });
  });

  it("URL-encodes the room even though it already passed the grammar check", async () => {
    // encodeURIComponent is a no-op for this specific room, but the call must
    // still go through it rather than string-concatenating the raw room.
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await postSignedRecordDirect(ROOM, CHALLENGE, SIGNED);

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`https://technocore.chat/r/${encodeURIComponent(ROOM)}?format=json`);
  });

  it("serializes a large safe-integer nonce as a string, without numeric precision loss", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const bigNonce = Number.MAX_SAFE_INTEGER; // 9007199254740991

    await postSignedRecordDirect(ROOM, { nonce: bigNonce, text: CHALLENGE.text }, SIGNED);

    const [, init] = fetchSpy.mock.calls[0]!;
    const parsedBody = JSON.parse(init.body as string);
    expect(typeof parsedBody.nonce).toBe("string");
    expect(parsedBody.nonce).toBe("9007199254740991");
  });

  it("rejects an invalid room before ever calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(postSignedRecordDirect("Not_A_Valid-Room!", CHALLENGE, SIGNED)).rejects.toThrow(TechnocoreDirectPostError);
    await expect(postSignedRecordDirect("", CHALLENGE, SIGNED)).rejects.toThrow(TechnocoreDirectPostError);
    await expect(postSignedRecordDirect("-leading-dash", CHALLENGE, SIGNED)).rejects.toThrow(TechnocoreDirectPostError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts the real FLOP room shapes (offer board and per-deal room)", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(postSignedRecordDirect("tclk-offers", CHALLENGE, SIGNED)).resolves.toEqual({ posted: true });
    await expect(postSignedRecordDirect("mb-p-tclk-0123456789abcdef", CHALLENGE, SIGNED)).resolves.toEqual({ posted: true });
  });

  it.each([400, 429, 503])("surfaces the HTTP status and body detail on a %d response, without retrying or pretending success", async (status) => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ error: `denied with status ${status}` }), { status }));
    vi.stubGlobal("fetch", fetchSpy);

    let caught: unknown;
    try {
      await postSignedRecordDirect(ROOM, CHALLENGE, SIGNED);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TechnocoreDirectPostError);
    const error = caught as InstanceType<typeof TechnocoreDirectPostError>;
    expect(error.status).toBe(status);
    expect(error.message).toContain(String(status));
    expect(error.message).toContain(`denied with status ${status}`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("surfaces the first non-blank line when a rejection body is plain text, not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("room is full\nsecond line ignored", { status: 400 })));

    await expect(postSignedRecordDirect(ROOM, CHALLENGE, SIGNED)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("room is full"),
    });
  });

  it("fails closed with a clear error when the fetch itself fails (network/CORS)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    let caught: unknown;
    try {
      await postSignedRecordDirect(ROOM, CHALLENGE, SIGNED);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TechnocoreDirectPostError);
    const error = caught as InstanceType<typeof TechnocoreDirectPostError>;
    expect(error.message).toContain("Could not reach Technocore directly");
    expect(error.message).toContain("Failed to fetch");
    expect(error.status).toBeUndefined();
  });
});
