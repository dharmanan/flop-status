import type { IncomingMessage, ServerResponse } from "node:http";
import { TclkMcpClient, TclkMcpError, type TclkToolName } from "./tclk-mcp-client.js";
import { TclkPaperRailAdapter } from "./tclk-paper-rail.js";
import { resolveTechnocoreUrl } from "./tclk-env.js";
import type { RawTclkMessage, TclkDealHistoryService } from "./tclk-deal-history-service.js";

const MAX_TCLK_BODY_BYTES = 1_048_576;
const TECHNOCORE_READ_TIMEOUT_MS = 12_000;
const TCLK_ROOM_RE = /^(?:tclk-offers|mb-p-tclk-[0-9a-f]{16})$/;
const TERMINAL_TCLK_STATES = new Set(["claimed", "refunded", "cancelled"]);
const OFFER_ID_RE = /^0x[0-9a-f]{64}$/;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const TOOL_NAMES = new Set<TclkToolName>([
  "tclk_make_offer",
  "tclk_accept_offer",
  "tclk_make_lock",
  "tclk_make_reveal",
  "tclk_make_refund",
  "tclk_make_cancel",
  "tclk_make_receipt",
  "tclk_post_frame",
  "tclk_read_room",
  "tclk_decode",
  "tclk_apply_transcript",
  "tclk_verify_secret",
  "tclk_whoami",
]);

let historySyncInFlight: Promise<void> | null = null;
let historySyncQueued = false;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, HEADERS);
  response.end(JSON.stringify(body));
}

export async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const declared = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > MAX_TCLK_BODY_BYTES) {
    request.resume();
    throw Object.assign(new Error("TCLK request body too large"), { status: 413, code: "PAYLOAD_TOO_LARGE" });
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_TCLK_BODY_BYTES) throw Object.assign(new Error("TCLK request body too large"), { status: 413, code: "PAYLOAD_TOO_LARGE" });
    chunks.push(buffer);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body must be an object");
    return value as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("request body must be valid JSON object"), { status: 400, code: "INVALID_JSON" });
  }
}

interface RawRoom {
  room?: unknown;
  messages?: unknown;
  last_seq?: unknown;
}

async function readRawRoom(room: string): Promise<RawRoom> {
  if (!TCLK_ROOM_RE.test(room)) {
    throw Object.assign(new Error("raw proxy is limited to official TCLK offer/deal rooms"), { status: 400, code: "INVALID_TCLK_ROOM" });
  }

  // Resolved per call (not module load) so the raw-room proxy and the
  // PaperRail adapter always read the same live TECHNOCORE_URL — and so
  // importing this module never fails just because it is unconfigured.
  const technocoreUrl = resolveTechnocoreUrl();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TECHNOCORE_READ_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${technocoreUrl}/r/${room}?format=json`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw Object.assign(
        new Error(`Technocore did not respond within ${TECHNOCORE_READ_TIMEOUT_MS / 1000} seconds.`),
        { status: 503, code: "TECHNOCORE_READ_TIMEOUT" },
      );
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw Object.assign(
      new Error(`Technocore room read could not connect: ${reason}`),
      { status: 503, code: "TECHNOCORE_READ_UNAVAILABLE" },
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) return { room, messages: [], last_seq: 0 };
  if (!response.ok) {
    if (response.status === 503) {
      throw Object.assign(
        new Error("Technocore is temporarily unavailable: HTTP 503 Service Unavailable."),
        { status: 503, code: "TECHNOCORE_HTTP_503" },
      );
    }
    throw Object.assign(
      new Error(`Technocore room read failed: HTTP ${response.status}`),
      { status: 502, code: "TECHNOCORE_READ_FAILED" },
    );
  }
  return response.json() as Promise<RawRoom>;
}

function rawMessages(room: RawRoom): RawTclkMessage[] {
  if (!Array.isArray(room.messages)) return [];
  return room.messages.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    if (!Number.isSafeInteger(item.seq) || typeof item.from !== "string" || typeof item.sig !== "string" || typeof item.text !== "string") return [];
    if (typeof item.nonce !== "number" && typeof item.nonce !== "string") return [];
    return [{
      seq: Number(item.seq),
      from: item.from,
      sig: item.sig,
      nonce: item.nonce,
      text: item.text,
      ts: item.ts,
    }];
  });
}

function reportHistory(message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.message : error === undefined ? "" : String(error);
  console.warn(`[tclk-history] ${message}${detail ? `: ${detail}` : ""}`);
}

async function archiveRoom(history: TclkDealHistoryService | undefined, roomName: string, room: RawRoom): Promise<void> {
  if (!history) return;
  try { await history.ingestRoom(roomName, rawMessages(room)); } catch (error) { reportHistory(`archive failed for ${roomName}`, error); }
}

async function backfillDealRooms(history: TclkDealHistoryService | undefined): Promise<void> {
  if (!history) return;
  try {
    const rooms = await history.listDealRoomsForSync(100);
    for (const roomName of rooms) {
      try {
        const room = await readRawRoom(roomName);
        await archiveRoom(history, roomName, room);
      } catch (error) { reportHistory(`deal-room backfill failed for ${roomName}`, error); }
    }
  } catch (error) { reportHistory("deal-room backfill could not list rooms", error); }
}

async function syncHistory(history: TclkDealHistoryService, offerRoom?: RawRoom): Promise<void> {
  const room = offerRoom ?? await readRawRoom("tclk-offers");
  await archiveRoom(history, "tclk-offers", room);
  await backfillDealRooms(history);
  await history.reconcileArchivedDeals();
}

function startHistorySync(history: TclkDealHistoryService | undefined, offerRoom?: RawRoom): Promise<void> | null {
  if (!history) return null;
  if (historySyncInFlight) {
    // A sync is already running, so this trigger's snapshot cannot be handled
    // right now. Dropping it is how a freshly posted offer used to be lost: by
    // the next trigger it had already rotated out of Technocore's window. Queue
    // one follow-up pass instead, which re-reads the room when it starts.
    historySyncQueued = true;
    return historySyncInFlight;
  }
  historySyncInFlight = syncHistory(history, offerRoom)
    .catch((error) => reportHistory("history sync failed", error))
    .finally(() => {
      historySyncInFlight = null;
      if (!historySyncQueued) return;
      historySyncQueued = false;
      startHistorySync(history);
    });
  return historySyncInFlight;
}

function scheduleHistorySync(history: TclkDealHistoryService | undefined, offerRoom?: RawRoom): void {
  void startHistorySync(history, offerRoom);
}

async function waitForHistorySync(history: TclkDealHistoryService, timeoutMs = 2500): Promise<void> {
  const sync = startHistorySync(history);
  if (!sync) return;
  await Promise.race([
    sync,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function scheduleRoomArchive(history: TclkDealHistoryService | undefined, roomName: string, room: RawRoom): void {
  if (!history) return;
  if (roomName === "tclk-offers") {
    scheduleHistorySync(history, room);
    return;
  }
  void archiveRoom(history, roomName, room);
}

export function createTclkAwareHandler(
  fallback: (request: IncomingMessage, response: ServerResponse) => void,
  mcp = new TclkMcpClient(),
  paper = new TclkPaperRailAdapter(mcp),
  history?: TclkDealHistoryService,
) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://runtime.local");
      const path = url.pathname;
      if (!path.startsWith("/api/v1/tclk")) {
        fallback(request, response);
        return;
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204, HEADERS);
        response.end();
        return;
      }
      try {
        if (request.method === "GET" && path === "/api/v1/tclk/status") {
          const upstream = await mcp.call("tclk_whoami", {});
          json(response, 200, { protocol: "tclk/1", mode: "alpha-paper-only", real_value: false, mcp: upstream });
          return;
        }

        if (request.method === "GET" && path === "/api/v1/tclk/history") {
          if (!history) {
            json(response, 503, { error: { code: "TCLK_HISTORY_UNAVAILABLE", message: "Durable TCLK history is not configured." } });
            return;
          }
          const did = url.searchParams.get("did")?.trim() ?? "";
          if (!did.startsWith("did:key:")) {
            json(response, 400, { error: { code: "INVALID_DID", message: "A did:key query parameter is required." } });
            return;
          }

          let deals = await history.listByDid(did);
          const needsBackfill = deals.length === 0 || deals.some((deal) => !TERMINAL_TCLK_STATES.has(deal.status));
          if (needsBackfill) {
            // waitForHistorySync() already ends its own reconcileArchivedDeals()
            // pass (see syncHistory), whether it ran to completion or this wait
            // timed out on it — so this re-read only needs the resulting DB
            // state, not another full, competing reconciliation pass moments
            // after the first.
            await waitForHistorySync(history);
            deals = await history.listByDid(did, { reconcile: false });
          } else {
            scheduleHistorySync(history);
          }

          json(response, 200, { deals, syncing: historySyncInFlight !== null });
          return;
        }

        const historyDetailMatch = path.match(/^\/api\/v1\/tclk\/history\/(0x[0-9a-f]{64})$/);
        if (request.method === "GET" && historyDetailMatch) {
          if (!history) {
            json(response, 503, { error: { code: "TCLK_HISTORY_UNAVAILABLE", message: "Durable TCLK history is not configured." } });
            return;
          }
          const offerId = historyDetailMatch[1] ?? "";
          if (!OFFER_ID_RE.test(offerId)) {
            json(response, 400, { error: { code: "INVALID_OFFER_ID", message: "A valid TCLK offer id is required." } });
            return;
          }
          const entry = await history.getByOfferId(offerId);
          if (!entry) {
            json(response, 404, { error: { code: "TCLK_HISTORY_NOT_FOUND", message: "Archived TCLK deal was not found." } });
            return;
          }
          json(response, 200, entry);
          return;
        }

        const rawRoomMatch = path.match(/^\/api\/v1\/tclk\/rooms\/([a-z0-9_-]+)$/);
        if (request.method === "GET" && rawRoomMatch) {
          const roomName = rawRoomMatch[1] ?? "";
          const room = await readRawRoom(roomName);
          json(response, 200, { room });
          scheduleRoomArchive(history, roomName, room);
          return;
        }

        const toolMatch = path.match(/^\/api\/v1\/tclk\/tools\/([a-z0-9_]+)$/);
        if (request.method === "POST" && toolMatch) {
          const tool = toolMatch[1] as TclkToolName;
          if (!TOOL_NAMES.has(tool)) {
            json(response, 404, { error: { code: "TCLK_TOOL_NOT_ALLOWED", message: "TCLK tool is not exposed by FLOP." } });
            return;
          }
          const body = await readJson(request);
          const result = await mcp.call(tool, body);
          json(response, 200, { result });

          if (tool === "tclk_post_frame" && (result as { posted?: unknown })?.posted === true && history) {
            const roomName = typeof body.room === "string" ? body.room : "";
            if (TCLK_ROOM_RE.test(roomName)) {
              // The client already has its response, so this await costs it nothing.
              // Archiving the record that was just posted is done here rather than
              // queued behind the shared sync: Technocore keeps only a short window
              // of each room, and a deferred pass can arrive after the record is gone.
              try {
                await archiveRoom(history, roomName, await readRawRoom(roomName));
              } catch (error) {
                reportHistory(`post-frame archive failed for ${roomName}`, error);
              }
              scheduleHistorySync(history);
            }
          }
          return;
        }

        if (request.method === "POST" && path === "/api/v1/tclk/paper/lock") {
          const body = await readJson(request);
          json(response, 200, {
            paper: await paper.lock({
              contract: String(body.contract ?? ""),
              statement: String(body.statement ?? ""),
              refundAfterMs: Number(body.refundAfterMs),
            }),
            warning: "PaperRail holds no value. This record is rehearsal evidence only.",
          });
          return;
        }

        if (request.method === "POST" && path === "/api/v1/tclk/paper/claim") {
          const body = await readJson(request);
          json(response, 200, {
            paper: await paper.claim(String(body.contract ?? ""), String(body.secret ?? "")),
            warning: "PaperRail holds no value. This record is rehearsal evidence only.",
          });
          return;
        }

        if (request.method === "POST" && path === "/api/v1/tclk/paper/refund") {
          const body = await readJson(request);
          json(response, 200, {
            paper: await paper.refund(String(body.contract ?? "")),
            warning: "PaperRail holds no value. This record is rehearsal evidence only.",
          });
          return;
        }

        if (request.method === "GET" && path.startsWith("/api/v1/tclk/paper/")) {
          const contract = decodeURIComponent(path.slice("/api/v1/tclk/paper/".length));
          json(response, 200, { paper: await paper.read(contract) });
          return;
        }

        json(response, 404, { error: { code: "NOT_FOUND", message: "TCLK route not found." } });
      } catch (error) {
        if (error instanceof TclkMcpError) {
          const status = error.code === "TCLK_MCP_UNAVAILABLE" ? 503 : 400;
          json(response, status, { error: { code: error.code, message: error.message } });
          return;
        }
        const typed = error as { status?: number; code?: string; message?: string };
        json(response, typed.status ?? 400, { error: { code: typed.code ?? "TCLK_REQUEST_FAILED", message: typed.message ?? "TCLK request failed." } });
      }
    })();
  };
}
