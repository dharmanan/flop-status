import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { CommunicationError } from "../../lib/runtime/communication-service.js";
import { createRuntimeRequestHandler } from "../../lib/runtime/router.js";

const servers: ReturnType<typeof createServer>[] = [];
const roomId = "11111111-1111-4111-8111-111111111111";
const baseDeps = {
  health: [],
  publicVerification: {
    async getReceipt() { return null; },
    async getVerification() { return null; },
    async getServerKeys() { return []; },
  },
  publicAgent: { async findAgentByDid() { return null; } },
  trial1Api: {
    async createChallenge() { return {}; },
    async getChallenge() { return null; },
    async submitChallenge() { return {}; },
  },
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function start(communication: any) {
  const server = createServer(createRuntimeRequestHandler({ ...baseDeps, communication }));
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

describe("communication HTTP routes", () => {
  it("routes room creation and private signed room queries to the communication service", async () => {
    const calls: string[] = [];
    const communication = {
      async createRoom(body: unknown) { calls.push("create"); return { room: { id: roomId }, body }; },
      async listRooms(body: unknown) { calls.push("rooms"); return { rooms: [], body }; },
      async listMessages(body: unknown, id: string) { calls.push(`list:${id}`); return { room: { id }, messages: [], body }; },
      async sendMessage(body: unknown, id: string) { calls.push(`send:${id}`); return { message: { id: "m1", room_id: id }, body }; },
    };
    const base = await start(communication);
    const envelope = { payload: {}, signature: {} };

    const create = await post(base, "/api/v1/communication/rooms", envelope);
    const rooms = await post(base, "/api/v1/communication/rooms/query", envelope);
    const list = await post(base, `/api/v1/communication/rooms/${roomId}/messages/query`, envelope);
    const send = await post(base, `/api/v1/communication/rooms/${roomId}/messages`, envelope);

    expect(create.status).toBe(201);
    expect(rooms.status).toBe(200);
    expect(list.status).toBe(200);
    expect(send.status).toBe(201);
    expect(calls).toEqual(["create", "rooms", `list:${roomId}`, `send:${roomId}`]);
  });

  it("maps invalid signature, replay and room access errors to explicit HTTP statuses", async () => {
    const cases = [
      ["INVALID_COMMUNICATION_SIGNATURE", 401],
      ["COMMUNICATION_REPLAY", 409],
      ["COMMUNICATION_ACTION_EXPIRED", 410],
      ["ROOM_ACCESS_DENIED", 403],
      ["ROOM_NOT_FOUND", 404],
    ] as const;

    for (const [code, status] of cases) {
      const communication = {
        async listRooms() { throw new CommunicationError(code, code); },
      };
      const base = await start(communication);
      const response = await post(base, "/api/v1/communication/rooms/query", { payload: {}, signature: {} });
      expect(response.status).toBe(status);
      const body = await response.json() as { error: { code: string; request_id: string } };
      expect(body.error.code).toBe(code);
      expect(body.error.request_id).toBeTruthy();
      await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    }
  });

  it("rejects oversized communication bodies before service execution", async () => {
    const communication = { async createRoom() { throw new Error("must not execute"); } };
    const base = await start(communication);
    const response = await post(base, "/api/v1/communication/rooms", { padding: "x".repeat(17000) });
    expect(response.status).toBe(413);
    expect((await response.json() as { error: { code: string } }).error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
