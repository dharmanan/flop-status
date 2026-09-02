import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { DirectMailboxError } from "../../lib/runtime/direct-mailbox-service.js";
import { createDirectMailboxAwareHandler } from "../../lib/runtime/direct-mailbox-router.js";

const servers: ReturnType<typeof createServer>[] = [];

function fallbackHandler(_request: IncomingMessage, response: ServerResponse) {
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { code: "FALLBACK_ROUTE_NOT_FOUND" } }));
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function start(mailbox: any) {
  const server = createServer(createDirectMailboxAwareHandler(fallbackHandler, mailbox));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function post(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("direct mailbox HTTP routes", () => {
  it("routes send/inbox/sent to the mailbox service with the expected response shape", async () => {
    const calls: string[] = [];
    const mailbox = {
      async send(body: unknown) {
        calls.push("send");
        return { message: { id: "m1" }, verification: { delivery: "STORED_FOR_RECIPIENT_DID" }, body };
      },
      async inbox(body: unknown) {
        calls.push("inbox");
        return { messages: [], body };
      },
      async sent(body: unknown) {
        calls.push("sent");
        return { messages: [], body };
      },
    };
    const base = await start(mailbox);
    const envelope = { payload: {}, signature: {} };

    const send = await post(base, "/api/v1/communication/mailbox/send", envelope);
    const inbox = await post(base, "/api/v1/communication/mailbox/inbox", envelope);
    const sent = await post(base, "/api/v1/communication/mailbox/sent", envelope);

    expect(send.status).toBe(201);
    expect(inbox.status).toBe(200);
    expect(sent.status).toBe(200);
    expect(calls).toEqual(["send", "inbox", "sent"]);
    expect(((await send.json()) as { message: { id: string } }).message.id).toBe("m1");
  });

  it("falls through to the wrapped handler for routes outside the mailbox prefix, without consuming the body", async () => {
    const mailbox = { async send() { throw new Error("must not execute"); } };
    const base = await start(mailbox);
    const response = await post(base, "/api/v1/challenges", { some: "body" });
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("FALLBACK_ROUTE_NOT_FOUND");
  });

  it("returns NOT_FOUND for an unknown route inside the mailbox prefix", async () => {
    const mailbox = {};
    const base = await start(mailbox);
    const response = await post(base, "/api/v1/communication/mailbox/unknown-action", {});
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed JSON and oversized bodies before the service ever runs", async () => {
    const mailbox = { async send() { throw new Error("must not execute"); } };
    const base = await start(mailbox);

    const badJson = await fetch(`${base}/api/v1/communication/mailbox/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(badJson.status).toBe(400);
    expect(((await badJson.json()) as { error: { code: string } }).error.code).toBe("INVALID_JSON");

    const tooBig = await post(base, "/api/v1/communication/mailbox/send", { padding: "x".repeat(17_000) });
    expect(tooBig.status).toBe(413);
    expect(((await tooBig.json()) as { error: { code: string } }).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("maps signed-action boundary errors to their documented HTTP statuses", async () => {
    const cases = [
      ["INVALID_MAILBOX_REQUEST", 400],
      ["INVALID_MAILBOX_SIGNATURE", 401],
      ["MAILBOX_ACTION_EXPIRED", 410],
      ["MAILBOX_REPLAY", 409],
      ["MAILBOX_SELF_SEND", 400],
    ] as const;

    for (const [code, status] of cases) {
      const mailbox = { async send() { throw new DirectMailboxError(code, code); } };
      const base = await start(mailbox);
      const response = await post(base, "/api/v1/communication/mailbox/send", { payload: {}, signature: {} });
      expect(response.status).toBe(status);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(code);
      await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    }
  });

  it("responds to OPTIONS preflight for mailbox routes without touching the service", async () => {
    const mailbox = { async send() { throw new Error("must not execute"); } };
    const base = await start(mailbox);
    const response = await fetch(`${base}/api/v1/communication/mailbox/send`, { method: "OPTIONS" });
    expect(response.status).toBe(204);
  });
});
