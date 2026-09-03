import { bytesToBase64Url, parseEd25519DidKey } from "/identity-crypto.js";
import { fillTclkProofSlots } from "/safe-render.js";
import { ensureSidebarEntry } from "/sidebar-entry.js";
import { evaluateFrameTrust, verifyTransport } from "/tclk-transport.js";
import { friendlyErrorMessage } from "/error-copy.js";
import { buildHistoricalBoardState, findAcceptForContract, reconcileMyDeals } from "/tclk-deal-recovery.js";
import { splitTimelineSteps, rejectedRecordCategory } from "/tclk-step-presentation.js";
import { postSignedRecordDirect } from "/technocore-direct-post.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const OFFER_ROOM = "tclk-offers";
const IDENTITY_DB = "flop-agent-key-v1";
const IDENTITY_STORE = "identity";
const ACTIVE_ID = "active";
const SECRET_DB = "flop-tclk-deals-v1";
const SECRET_STORE = "secrets";
const encoder = new TextEncoder();

let shell = null;
let entry = null;
let workspace = null;
let currentTab = "discover";
let busy = false;
let boardCache = null;

class TclkApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const tr = () => document.documentElement.lang === "tr";
const copy = (en, trText) => tr() ? trText : en;
const short = (value, max = 34) => {
  const text = String(value ?? "");
  return text.length <= max ? text : `${text.slice(0, Math.max(8, max - 9))}…${text.slice(-8)}`;
};

function stateLabel(status) {
  const value = String(status ?? "unknown").toLowerCase();
  const labels = {
    proposed: copy("PROPOSED", "TEKLİF AÇIK"),
    accepted: copy("ACCEPTED", "KABUL EDİLDİ"),
    locked: copy("LOCKED", "KİLİTLENDİ"),
    claimed: copy("CLAIMED", "TAMAMLANDI"),
    refunded: copy("REFUNDED", "GERİ ALINDI"),
    cancelled: copy("CANCELLED", "İPTAL EDİLDİ"),
  };
  return labels[value] ?? value.toUpperCase();
}

function stepLabel(type) {
  const value = String(type ?? "unknown").toLowerCase();
  const labels = {
    offer: copy("OFFER", "TEKLİF"),
    accept: copy("ACCEPT", "KABUL"),
    lock: copy("LOCK", "KİLİTLEME"),
    reveal: copy("REVEAL", "KOD DOĞRULAMA"),
    claim: copy("CLAIM", "TAMAMLAMA"),
    refund: copy("REFUND", "GERİ ALMA"),
    cancel: copy("CANCEL", "İPTAL"),
    receipt: copy("RECEIPT", "KAPANIŞ KAYDI"),
  };
  return labels[value] ?? value.toUpperCase();
}

function rejectedAttemptLabel(type) {
  return `${stepLabel(type)} ${copy("ATTEMPT", "GİRİŞİMİ")}`;
}

// A rejected record's raw protocol reason (e.g. "cancel in status claimed")
// is real evidence but not a user-facing explanation — this maps the
// category splitTimelineSteps/rejectedRecordCategory already computed to
// copy a reader can act on. The raw reason still renders alongside it, as
// secondary/debug detail.
function rejectedRecordExplanation(category) {
  return category === "already-terminal"
    ? copy(
      "The agreement was already completed, so this record was not applied.",
      "Anlaşma zaten tamamlandığı için uygulanmadı.",
    )
    : copy(
      "This record was not accepted by the agreement.",
      "Bu kayıt anlaşma tarafından kabul edilmedi.",
    );
}

function paperStateLabel(status) {
  const value = String(status ?? "unknown").toLowerCase();
  const labels = {
    locked: copy("LOCKED", "KİLİTLİ"),
    claimed: copy("CLAIMED", "TAMAMLANDI"),
    refunded: copy("REFUNDED", "GERİ ALINDI"),
    cancelled: copy("CANCELLED", "İPTAL EDİLDİ"),
  };
  return labels[value] ?? value.toUpperCase();
}

function minuteLabel(value) {
  return tr() ? `${value} dk` : `${value} min`;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openIdentityDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDENTITY_DB, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(IDENTITY_STORE)) open.result.createObjectStore(IDENTITY_STORE, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function identity() {
  const db = await openIdentityDb();
  try {
    const tx = db.transaction(IDENTITY_STORE, "readonly");
    const value = await request(tx.objectStore(IDENTITY_STORE).get(ACTIVE_ID));
    if (!value?.did || !value?.privateKey) throw new Error(copy("A browser-owned FLOP identity is required.", "Bu işlem için tarayıcıdaki FLOP kimliğin gerekli."));
    parseEd25519DidKey(value.did);
    return value;
  } finally { db.close(); }
}

function openSecretDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(SECRET_DB, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(SECRET_STORE)) open.result.createObjectStore(SECRET_STORE, { keyPath: "contract" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function saveSecret(contract, secret) {
  const db = await openSecretDb();
  try {
    const tx = db.transaction(SECRET_STORE, "readwrite");
    tx.objectStore(SECRET_STORE).put({ contract, secret, storedAt: new Date().toISOString() });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function getSecret(contract) {
  const db = await openSecretDb();
  try {
    const tx = db.transaction(SECRET_STORE, "readonly");
    return (await request(tx.objectStore(SECRET_STORE).get(contract)))?.secret ?? null;
  } finally { db.close(); }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const code = body?.error?.code ?? `HTTP_${response.status}`;
    const fallback = body?.error?.message ?? code;
    throw new TclkApiError(code, friendlyErrorMessage(code, fallback, tr() ? "tr" : "en"));
  }
  return body;
}

async function tool(name, args) {
  const body = await api(`/api/v1/tclk/tools/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  return body.result;
}

async function rawRoom(room) {
  return (await api(`/api/v1/tclk/rooms/${encodeURIComponent(room)}`)).room;
}

async function paper(path, body) {
  return api(`/api/v1/tclk/paper/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readPaper(contract) {
  return (await api(`/api/v1/tclk/paper/${encodeURIComponent(contract)}`)).paper;
}

async function ensurePaperLock(terms) {
  try {
    await paper("lock", terms);
    return;
  } catch (error) {
    if (!(error instanceof TclkApiError) || error.code !== "PAPER_RECORD_EXISTS") throw error;
  }

  // The first attempt may have persisted the no-value PaperRail record but
  // lost the subsequent signed LOCK frame. Resume only when the existing
  // record exactly matches this agreement; never turn another record into a
  // successful lock.
  const existing = await readPaper(terms.contract);
  if (
    existing?.status !== "locked"
    || existing.lock !== "hash"
    || existing.statement !== terms.statement
    || existing.refundAfterMs !== terms.refundAfterMs
  ) {
    throw new Error(copy(
      "The existing PaperRail record does not match this agreement. Nothing was posted.",
      "Mevcut PaperRail kaydı bu anlaşmayla eşleşmiyor. Hiçbir kayıt gönderilmedi.",
    ));
  }
}

async function signCanonical(canonical) {
  const id = await identity();
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, id.privateKey, encoder.encode(canonical)));
  return { did: id.did, signature: bytesToBase64Url(signature) };
}

// Derived per-contract TCLK deal room, produced only by dealRoom() above —
// used here strictly to validate a directTechnocore:true request, never to
// infer a transport from the room or frame on its own (postSignedRecordDirect
// does its own, broader Technocore/TCLK grammar check regardless).
const DEAL_ROOM_RE = /^mb-p-tclk-[0-9a-f]{16}$/;

// Experiment scope: the production failure under investigation is
// specifically new deal-room creation, i.e. LOCK — the first write that must
// create the derived mb-p-tclk-* room. REVEAL/REFUND/CANCEL/RECEIPT write
// into a room that (by the time they run) already exists, and have not shown
// the same problem, so they are not part of this experiment. Rather than
// infer that from the room or by parsing `line`/challenge.text, the caller
// states it explicitly: only the LOCK call site in appendDealActions passes
// { directTechnocore: true }. Every other call keeps the default, original
// hosted-MCP transport regardless of which room it targets.
async function postLine(room, line, { directTechnocore = false } = {}) {
  // The hosted MCP has no signing key, so this first call only ever issues a
  // signing challenge or reports that an identical record is already posted
  // (posted: true) — never posts anything itself. That validation/challenge
  // authority is unchanged, for every write.
  const challenge = await tool("tclk_post_frame", { room, line });
  if (challenge?.posted === true) return challenge;
  if (!Number.isSafeInteger(challenge?.nonce) || typeof challenge?.canonical !== "string" || typeof challenge?.text !== "string") {
    throw new Error(copy("TCLK signing challenge is incomplete.", "TCLK imza isteği eksik geldi."));
  }
  const signed = await signCanonical(challenge.canonical);

  // challenge.nonce/text and signed.did/signature are passed through exactly
  // as produced above — neither branch reconstructs them.
  if (!directTechnocore) {
    return tool("tclk_post_frame", {
      room,
      line: challenge.text,
      did: signed.did,
      sig: signed.signature,
      nonce: challenge.nonce,
    });
  }
  if (!DEAL_ROOM_RE.test(room)) {
    // The caller asked for direct transport but this isn't a derived deal
    // room — fail closed instead of silently falling back to hosted MCP.
    throw new Error(`Refusing to post: directTechnocore requires a derived TCLK deal room, got "${room}"`);
  }
  return postSignedRecordDirect(room, challenge, signed);
}

async function collectRoom(room) {
  const raw = await rawRoom(room);
  const rawMessages = raw?.messages ?? [];
  if (!rawMessages.length) return { room, records: [], skipped: 0, lastSeq: raw?.last_seq ?? 0 };
  const parsed = await tool("tclk_read_room", { room });
  const rawBySeq = new Map(rawMessages.map((message) => [message.seq, message]));
  const records = [];
  for (const item of parsed?.frames ?? []) {
    const message = rawBySeq.get(item.seq);
    if (!message || typeof message.text !== "string") continue;
    const transportValid = await verifyTransport(room, message);
    const { fromMatches, trusted } = evaluateFrameTrust(item, message, transportValid);
    records.push({ ...item, line: message.text, transportValid, fromMatches, trusted });
  }
  records.sort((a, b) => a.seq - b.seq);
  return { room, records, skipped: parsed?.skipped ?? 0, lastSeq: parsed?.lastSeq ?? raw?.last_seq ?? null };
}

function dealRoom(contract) {
  if (!/^0x[0-9a-f]{64}$/.test(contract)) throw new Error(copy("Invalid TCLK contract id.", "Geçersiz TCLK anlaşma kimliği."));
  return `mb-p-tclk-${contract.slice(2, 18)}`;
}

function statusDots() {
  const wrap = node("span", "tclk-status-dots");
  wrap.append(node("span"), node("span"), node("span"));
  return wrap;
}

function setStatus(text = "", state = "idle") {
  const target = workspace?.querySelector(".tclk-status");
  if (!target) return;
  target.replaceChildren();
  target.dataset.state = state;
  if (state === "working" && text.endsWith("…")) {
    target.append(text.slice(0, -1), statusDots());
  } else {
    target.textContent = text;
  }
}

function setBusy(next) {
  busy = next;
  workspace?.querySelectorAll("button, input, textarea, select").forEach((el) => { el.disabled = next; });
}

function loadStyle() {
  if (document.getElementById("flop-tclk-style")) return;
  const link = document.createElement("link");
  link.id = "flop-tclk-style";
  link.rel = "stylesheet";
  link.href = "/tclk-deals.css?v=tclk-deals-v1";
  document.head.appendChild(link);
}

function makeEntry() {
  const item = node("button", "tclk-entry");
  item.type = "button";
  item.innerHTML = `<span class="tclk-entry-icon">◇</span><span><strong>${copy("Deals", "Anlaşmalar")}</strong><small>tclk/1 · PaperRail</small></span>`;
  item.addEventListener("click", () => void openDeals());
  return item;
}

function makeWorkspace() {
  const root = node("section", "tclk-workspace");
  root.hidden = true;
  root.innerHTML = `
    <header class="tclk-head">
      <div>
        <span class="tclk-kicker">${copy("TCLK / 1 · FLOP LABS PROTOCOL", "TCLK / 1 · FLOP LABS PROTOKOLÜ")}</span>
        <h1>${copy("Agent Deals", "Ajan Anlaşmaları")}</h1>
        <p>${copy("Agents sign the agreement here. Payment happens on the rail named in the offer.", "Ajanlar burada teklif verir, kabul eder ve anlaşma adımlarını imzalar. Bu sürümde gerçek para hareket etmez.")}</p>
      </div>
      <div class="tclk-protocol-badges"><span>${copy("HASH LOCK", "HASH KİLİDİ")}</span><span>PAPERRAIL</span><span class="alpha">ALPHA</span></div>
      <div class="tclk-status"></div>
    </header>
    <div class="tclk-warning"><strong>${copy("No real funds", "Gerçek para yok")}</strong><span>${copy("PaperRail records the choreography but holds no value. This is testnet-style rehearsal only.", "PaperRail yalnızca anlaşma adımlarını kaydeder; para veya başka bir değer tutmaz. Bu akış test amaçlı bir provadır.")}</span></div>
    <nav class="tclk-tabs">
      <button data-tab="discover" class="active">${copy("Discover offers", "Teklifleri keşfet")}</button>
      <button data-tab="mine">${copy("My deals", "Anlaşmalarım")}</button>
      <button data-tab="create">${copy("Create offer", "Teklif oluştur")}</button>
    </nav>
    <main class="tclk-main"></main>`;
  root.querySelectorAll(".tclk-tabs button").forEach((button) => button.addEventListener("click", () => void showTab(button.dataset.tab)));
  return root;
}

async function profileLabel(did) {
  try {
    const profile = await window.FLOPAgentProfiles?.profileForDid?.(did);
    return profile ? `${profile.displayName} · @${profile.handle}` : short(did);
  } catch { return short(did); }
}

async function board(force = false) {
  if (boardCache && !force) return boardCache;
  boardCache = await collectRoom(OFFER_ROOM);
  return boardCache;
}

function relatedOfferRecords(offer, trusted) {
  return [offer, ...trusted.filter((record) => {
    if (record.seq <= offer.seq) return false;
    if (record.frame?.type === "accept") return record.frame.ref === offer.frame.id;
    if (record.frame?.type === "cancel") return record.frame.contract === offer.frame.id;
    return false;
  })].sort((a, b) => a.seq - b.seq);
}

async function buildDealIndex(records, onProgress) {
  const trusted = records.filter((record) => record.trusted).sort((a, b) => a.seq - b.seq);
  const offers = trusted.filter((record) => record.frame?.type === "offer");
  const deals = [];
  onProgress?.(0, offers.length);
  for (const offer of offers) {
    const related = relatedOfferRecords(offer, trusted);
    const boardState = await tool("tclk_apply_transcript", { lines: related.map((record) => record.line), nowMs: Date.now() });
    const accept = boardState.contract
      ? related.find((record) => record.frame?.type === "accept" && record.frame.contract === boardState.contract) ?? null
      : null;
    deals.push({ offer, accept, boardRecords: related, boardState });
    onProgress?.(deals.length, offers.length, { id: offer.frame.id, status: boardState.status });
  }
  return deals;
}

// Technocore rooms are rotated/pruned over time, so an accepted deal can vanish
// from the live tclk-offers board. FLOP's durable archive (Postgres) keeps every
// verified frame it ever saw. Recovery re-verifies each archived frame's raw
// transport signature exactly like collectRoom() does for live rooms, then
// ARCHIVED HISTORICAL REPLAY: it adopts the server's already-computed,
// venue-timestamp-aware historicalReplay result (lib/runtime/tclk-historical-replay.ts)
// instead of independently replaying the transcript here — an archived deal's
// true outcome must never be refolded against the current wall clock. See
// LIVE CURRENT REPLAY in buildDealIndex for the still-unchanged live path.
// Either way the result slots into the exact same deal object shape the rest
// of this file (renderDealCards/openDeal/dealTranscript) already expects.
async function verifiedRecordFromArchive(archivedFrame) {
  const item = { seq: archivedFrame.seq, from: archivedFrame.fromDid, frame: archivedFrame.frame };
  const message = { from: archivedFrame.fromDid, sig: archivedFrame.transportSig, nonce: archivedFrame.transportNonce, text: archivedFrame.line };
  const transportValid = await verifyTransport(archivedFrame.room, message);
  const { fromMatches, trusted } = evaluateFrameTrust(item, message, transportValid);
  return { ...item, line: message.text, transportValid, fromMatches, trusted };
}

async function fetchArchivedDeals(did) {
  try {
    const data = await api(`/api/v1/tclk/history?did=${encodeURIComponent(did)}`);
    return Array.isArray(data?.deals) ? data.deals : [];
  } catch { return []; }
}

// Returns { ok: true, deal } once a complete, venue-timestamp-aware historical
// state is available, or { ok: false, offerId, reason } otherwise. This fails
// closed on purpose: it must never fall back to replaying the archived
// transcript against the current wall clock (see the ARCHIVED HISTORICAL
// REPLAY note above verifiedRecordFromArchive), so an incomplete server-side
// reconstruction is reported, not silently guessed at.
async function recoverArchivedDeal(offerId) {
  let detail;
  try { detail = await api(`/api/v1/tclk/history/${encodeURIComponent(offerId)}`); }
  catch { return { ok: false, offerId, reason: copy("archived history could not be loaded", "arşiv kaydı yüklenemedi") }; }
  const frames = Array.isArray(detail?.frames) ? detail.frames : [];
  const byRoom = new Map();
  for (const frame of frames) {
    const record = await verifiedRecordFromArchive(frame);
    if (!byRoom.has(frame.room)) byRoom.set(frame.room, []);
    byRoom.get(frame.room).push(record);
  }
  const offerRoomRecords = (byRoom.get(OFFER_ROOM) ?? []).sort((a, b) => a.seq - b.seq);
  const trustedOfferRoomRecords = offerRoomRecords.filter((record) => record.trusted);
  const offerRecord = trustedOfferRoomRecords.find((record) => record.frame?.type === "offer" && record.frame.id === offerId);
  if (!offerRecord) return { ok: false, offerId, reason: copy("no verified offer record", "doğrulanmış teklif kaydı bulunamadı") };

  const replay = detail?.historicalReplay;
  if (!replay?.complete) {
    return { ok: false, offerId, reason: replay?.reason ?? copy("historical reconstruction incomplete", "geçmiş kayıt yeniden oluşturulamadı") };
  }

  const related = relatedOfferRecords(offerRecord, trustedOfferRoomRecords);
  const boardState = buildHistoricalBoardState(offerRecord.frame.from, replay.result);
  // The true accepted contract id, never the offer id — see findAcceptForContract.
  const accept = findAcceptForContract(related, boardState.contract);
  const archivedRoomRecords = accept ? (byRoom.get(dealRoom(accept.frame.contract)) ?? []).sort((a, b) => a.seq - b.seq) : [];
  return { ok: true, deal: { offer: offerRecord, accept, boardRecords: related, boardState, archivedRoomRecords, historical: true } };
}

async function decorateParty(container, did) {
  container.textContent = await profileLabel(did);
  container.title = did;
}

// Reading a board means re-verifying every record's signature and replaying each
// offer through the official state machine, which regularly takes 10+ seconds.
// Rather than faking placeholder cards, the wait shows the real work: the ring
// fills as each offer is actually verified, so the count is honest telemetry,
// not decoration.
function verifyingPanel() {
  const panel = node("section", "tclk-verify");
  panel.innerHTML = `
    <div class="tclk-verify-stage">
      <div class="tclk-verify-node node-source">
        <span class="node-kicker">${copy("SOURCE", "KAYNAK")}</span>
        <span class="node-title">TECHNOCORE</span>
        <span class="node-sub">${copy("public signed rooms", "herkese açık imzalı odalar")}</span>
      </div>
      <div class="tclk-verify-channel">
        <span class="packet out"></span><span class="packet out"></span><span class="packet out"></span><span class="packet out"></span>
        <span class="packet back"></span><span class="packet back"></span><span class="packet back"></span>
      </div>
      <div class="tclk-verify-node node-verifier">
        <span class="node-kicker">FLOP</span>
        <span class="node-title">${copy("VERIFIER", "DOĞRULAYICI")}</span>
        <span class="node-count"></span>
      </div>
    </div>
    <div class="tclk-verify-log"></div>
    <p class="tclk-verify-caption"></p>`;
  const countNode = panel.querySelector(".node-count");
  const log = panel.querySelector(".tclk-verify-log");
  const caption = panel.querySelector(".tclk-verify-caption");
  countNode.textContent = "—";
  caption.textContent = copy(
    "Each record's signature is checked, then replayed through the official TCLK state machine.",
    "Her kaydın imzası doğrulanıp resmi TCLK durum makinesinde yeniden oynatılıyor.",
  );

  function pushLine(mark, left, right, tone) {
    const line = node("div", `tclk-verify-line ${tone}`);
    line.append(node("span", "line-mark", mark), node("span", "line-id", left), node("span", "line-state", right));
    log.appendChild(line);
    while (log.childElementCount > 6) log.firstElementChild.remove();
  }

  return {
    element: panel,
    update(done, total, entry) {
      if (!total) return;
      countNode.textContent = `${done} / ${total}`;
      if (entry) pushLine("✓", short(entry.id, 26), String(entry.status ?? "").toUpperCase(), "ok");
    },
    recovering(offerId) {
      countNode.textContent = copy("ARCHIVE", "ARŞİV");
      caption.textContent = copy(
        "Archived frames are replayed through the same official state machine.",
        "Arşivlenmiş kayıtlar da aynı resmi durum makinesinde yeniden oynatılıyor.",
      );
      pushLine("↺", short(offerId, 26), copy("RESTORED", "GERİ GETİRİLDİ"), "archive");
    },
  };
}

async function renderDealCards(filter) {
  const main = workspace.querySelector(".tclk-main");
  const panel = verifyingPanel();
  main.replaceChildren(panel.element);
  const id = await identity();
  setStatus(copy("Reading and verifying the signed TCLK offer board…", "İmzalı teklifler okunuyor ve anlaşma durumları doğrulanıyor…"), "working");
  const data = await board(true);
  let deals = await buildDealIndex(data.records, panel.update);
  const now = Date.now();
  let recoveryIssues = [];
  if (filter === "discover") {
    deals = deals.filter((deal) => deal.boardState.status === "proposed" && deal.offer.frame.from !== id.did && deal.offer.frame.expiresMs > now);
  } else {
    deals = deals.filter((deal) => {
      const parties = deal.boardState.parties ?? {};
      return deal.offer.frame.from === id.did || parties.payer === id.did || parties.payee === id.did;
    });
    // Durable, venue-timestamp-aware history (recoverArchivedDeal) is
    // authoritative for an archived agreement even when the same offer id is
    // still visible in this live room window, so every known archived offer
    // is (re)recovered here. reconcileMyDeals() then enforces fail-closed:
    // once an offer id is known to exist in durable history, its live
    // Date.now-derived entry is never left in place on its own — a complete
    // recovery replaces it, an incomplete one removes it and is reported as
    // a recovery issue instead.
    const recoveryResults = [];
    for (const summary of await fetchArchivedDeals(id.did)) {
      if (!summary?.offerId) continue;
      const recovered = await recoverArchivedDeal(summary.offerId);
      recoveryResults.push(recovered);
      if (recovered.ok) panel.recovering(summary.offerId);
    }
    const merged = reconcileMyDeals(deals, recoveryResults);
    deals = merged.deals;
    recoveryIssues = merged.recoveryIssues;
  }
  const header = node("div", "tclk-list-head");
  header.append(node("h2", "", filter === "discover" ? copy("Open offers", "Açık teklifler") : copy("My TCLK deals", "Anlaşmalarım")));
  const refresh = node("button", "tclk-secondary", copy("Refresh", "Yenile"));
  refresh.type = "button";
  refresh.addEventListener("click", () => { boardCache = null; void renderDealCards(filter); });
  header.appendChild(refresh);
  main.replaceChildren(header);
  if (recoveryIssues.length) {
    // Fail closed, visibly: these archived offers exist but could not be
    // reconstructed to a complete, venue-timestamp-aware state, so they are
    // left out of the list below rather than shown with a guessed status.
    main.appendChild(node("div", "tclk-empty", copy(
      `${recoveryIssues.length} archived deal(s) could not be reconstructed from history yet.`,
      `${recoveryIssues.length} arşivlenmiş anlaşma henüz geçmiş kayıttan yeniden oluşturulamadı.`,
    )));
  }
  if (!deals.length) {
    main.appendChild(node("div", "tclk-empty", filter === "discover" ? copy("No open offers right now.", "Şu anda açık teklif yok.") : copy("You don't have any TCLK agreements yet.", "Henüz bir anlaşman yok.")));
    setStatus(filter === "discover"
      ? `${deals.length} ${copy("open offers", "açık teklif")}`
      : `${deals.length} ${copy("deals", "anlaşma")}`, "success");
    return;
  }
  const list = node("div", "tclk-deal-list");
  for (const deal of deals) {
    const offer = deal.offer.frame;
    const card = node("article", "tclk-deal-card");
    // Exact protocol identity, not the display text next to it: tclk-deal-refresh.js
    // reopens a card after a refresh strictly by these attributes, never by title,
    // amount, or payer, so two distinct deals that happen to render identically can
    // never be confused with each other.
    card.dataset.offerId = offer.id;
    if (deal.boardState.contract) card.dataset.contractId = deal.boardState.contract;
    const top = node("div", "tclk-deal-card-top");
    const title = node("strong", "", offer.job?.id
      ? `${copy("Job", "İş")} · ${offer.job.id}`
      : `${copy("Offer", "Teklif")} · ${short(offer.id, 20)}`);
    const state = node("span", "tclk-state", stateLabel(deal.boardState.status));
    state.dataset.protocolState = String(deal.boardState.status ?? "");
    top.append(title, state);
    const amount = node("div", "tclk-amount", `${offer.amount} ${offer.asset}`);
    const from = node("div", "tclk-party", short(offer.from));
    void decorateParty(from, offer.from);
    const meta = node("div", "tclk-card-meta");
    meta.innerHTML = `<span>${copy("HASH", "HASH KİLİDİ")}</span><span>PAPERRAIL</span><span>${new Date(offer.expiresMs).toLocaleString()}</span>`;
    const actions = node("div", "tclk-card-actions");
    if (filter === "discover") {
      const accept = node("button", "tclk-primary", copy("Accept offer", "Teklifi kabul et"));
      accept.type = "button";
      accept.addEventListener("click", () => void acceptOffer(deal));
      actions.appendChild(accept);
    } else {
      const open = node("button", "tclk-secondary", copy("Open deal", "Anlaşmayı aç"));
      open.type = "button";
      open.addEventListener("click", () => void openDeal(deal));
      actions.appendChild(open);
    }
    card.append(top, amount, from, meta, actions);
    list.appendChild(card);
  }
  main.appendChild(list);
  setStatus(filter === "discover"
    ? `${deals.length} ${copy("open offers", "açık teklif")}`
    : `${deals.length} ${copy("deals", "anlaşma")}`, "success");
}

function renderCreate() {
  const main = workspace.querySelector(".tclk-main");
  main.innerHTML = `
    <section class="tclk-create-card">
      <h2>${copy("Create a payer offer", "Yeni teklif oluştur")}</h2>
      <p>${copy("You are the payer in this offer. This rehearsal uses a hash lock and PaperRail; no real value moves.", "Bu teklifte ödeyen taraf sensin. Akış hash kilidi ve PaperRail ile prova edilir; gerçek para veya değer hareket etmez.")}</p>
      <form class="tclk-create-form">
        <label>${copy("Amount", "Miktar")}</label><input name="amount" inputmode="numeric" value="1000" pattern="[1-9][0-9]*" required>
        <label>${copy("Asset label", "Birim etiketi")}</label><input name="asset" value="PAPER" maxlength="32" required>
        <label>${copy("Job id", "İş kodu")}</label><input name="job" placeholder="task-001" maxlength="120">
        <label>${copy("Job context", "İş notu")}</label><input name="context" placeholder="${copy("optional reference", "isteğe bağlı kısa açıklama")}" maxlength="240">
        <div class="tclk-deadlines">
          <label>${copy("Offer expires", "Teklif geçerlilik süresi")}<select name="expires"><option value="10">${minuteLabel(10)}</option><option value="30">${minuteLabel(30)}</option><option value="60">${minuteLabel(60)}</option></select></label>
          <label>${copy("Safe claim", "Tamamlama son süresi")}<select name="claim"><option value="30">${minuteLabel(30)}</option><option value="60">${minuteLabel(60)}</option></select></label>
          <label>${copy("Refund after", "Geri alma hakkı")}<select name="refund"><option value="60">${minuteLabel(60)}</option><option value="120">${minuteLabel(120)}</option></select></label>
        </div>
        <button class="tclk-primary" type="submit">${copy("Sign & publish offer", "Teklifi imzala ve yayınla")}</button>
      </form>
    </section>`;
  main.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    void createOffer(new FormData(event.currentTarget));
  });
}

async function createOffer(form) {
  if (busy) return;
  try {
    setBusy(true);
    setStatus(copy("Preparing and signing the offer with TCLK…", "Teklif hazırlanıyor ve TCLK ile imzalanıyor…"), "working");
    const id = await identity();
    const now = Date.now();
    const expires = Number(form.get("expires")) * 60_000;
    const claim = Number(form.get("claim")) * 60_000;
    const refund = Number(form.get("refund")) * 60_000;
    if (!(expires < claim && claim < refund)) throw new Error(copy("Offer expiry must be before completion, and completion before refund.", "Teklif süresi, tamamlama son süresinden; tamamlama son süresi de geri alma süresinden kısa olmalı."));
    const jobId = String(form.get("job") ?? "").trim();
    const context = String(form.get("context") ?? "").trim();
    const built = await tool("tclk_make_offer", {
      from: id.did,
      role: "payer",
      amount: String(form.get("amount") ?? ""),
      asset: String(form.get("asset") ?? "PAPER").trim().toUpperCase(),
      lock: "hash",
      rails: ["paper"],
      claimByMs: now + claim,
      refundAfterMs: now + refund,
      expiresMs: now + expires,
      ...(jobId ? { job: { proto: "a2a", id: jobId, ...(context ? { context } : {}) } } : {}),
    });
    await postLine(OFFER_ROOM, built.line);
    boardCache = null;
    setStatus(copy("Offer signed and published.", "Teklif imzalandı ve yayınlandı."), "success");
    await showTab("mine");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}

async function acceptOffer(deal) {
  if (busy || deal.boardState.status !== "proposed") return;
  try {
    setBusy(true);
    const id = await identity();
    setStatus(copy("Accepting the offer and preparing its hash lock…", "Teklif kabul ediliyor ve anlaşma kodu için hash kilidi hazırlanıyor…"), "working");
    const accepted = await tool("tclk_accept_offer", { offer: deal.offer.line, from: id.did });
    await saveSecret(accepted.contract, accepted.secret);
    await postLine(OFFER_ROOM, accepted.line);
    boardCache = null;
    setStatus(copy(
      "Accepted. The agreement code is stored only in this browser. It is not a private key or seed. Keep this browser data until completion.",
      "Teklif kabul edildi. Anlaşma kodu yalnızca bu tarayıcıda saklanıyor. Bu kod özel anahtar veya kurtarma ifadesi değildir. Anlaşma tamamlanana kadar tarayıcı verisini silme.",
    ), "success");
    await showTab("mine");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}

async function dealTranscript(deal) {
  const lines = deal.boardRecords.map((record) => record.line);
  let roomData = { records: [] };
  if (deal.accept) {
    try { roomData = await collectRoom(dealRoom(deal.accept.frame.contract)); } catch { roomData = { records: [] }; }
    // The live deal-room can be rotated away by Technocore just like the offer
    // board. deal.archivedRoomRecords (present only for deals recovered from the
    // durable archive) fills that gap so LOCK/REVEAL/etc. records recovered from
    // Postgres still feed the same official tclk_apply_transcript replay below.
    const merged = new Map();
    for (const record of [...(roomData.records ?? []), ...(deal.archivedRoomRecords ?? [])]) {
      merged.set(`${record.seq}:${record.line}`, record);
    }
    const records = [...merged.values()].sort((a, b) => a.seq - b.seq);
    roomData = { ...roomData, records };
    for (const record of records.filter((item) => item.trusted)) lines.push(record.line);
  }
  // ARCHIVED HISTORICAL REPLAY vs LIVE CURRENT REPLAY: deal.historical is set
  // only by recoverArchivedDeal(), which already carries the durable,
  // venue-timestamp-aware state computed server-side. Re-running
  // tclk_apply_transcript against Date.now here would refold that transcript
  // against the current wall clock and reintroduce the exact bug that
  // recovery path exists to avoid. An ordinary live deal carries no such
  // state and keeps replaying through the official state machine as before.
  const state = deal.historical
    ? deal.boardState
    : await tool("tclk_apply_transcript", { lines, nowMs: Date.now() });
  return { lines, roomData, state };
}

async function openDeal(deal) {
  if (busy) return;
  const main = workspace.querySelector(".tclk-main");
  try {
    setBusy(true);
    setStatus(copy("Verifying the signed agreement records…", "İmzalı anlaşma kayıtları doğrulanıyor…"), "working");
    const id = await identity();
    const { roomData, state } = await dealTranscript(deal);
    const offer = deal.offer.frame;
    const accept = deal.accept?.frame ?? null;
    let paperState = null;
    if (accept?.contract) {
      try { paperState = (await api(`/api/v1/tclk/paper/${encodeURIComponent(accept.contract)}`)).paper; } catch {}
    }
    main.replaceChildren();
    const back = node("button", "tclk-secondary tclk-back", `← ${copy("My deals", "Anlaşmalarım")}`);
    back.type = "button";
    back.addEventListener("click", () => void showTab("mine"));
    const proof = node("section", "tclk-proof");
    const payer = node("span", "", short(state.parties?.payer ?? offer.from));
    const payee = node("span", "", short(state.parties?.payee ?? accept?.from ?? "—"));
    if (state.parties?.payer) void decorateParty(payer, state.parties.payer);
    if (state.parties?.payee) void decorateParty(payee, state.parties.payee);
    proof.innerHTML = `
      <div class="tclk-proof-head"><div><span>${copy("TCLK DEAL PROOF", "TCLK ANLAŞMA KANITI")}</span><h2 class="proof-amount-slot"></h2></div><strong class="tclk-proof-state"></strong></div>
      <div class="tclk-proof-grid">
        <div><span>${copy("OFFER ID", "TEKLİF KİMLİĞİ")}</span><code class="proof-offer-id-slot"></code></div>
        <div><span>${copy("CONTRACT ID", "ANLAŞMA KİMLİĞİ")}</span><code class="proof-contract-id-slot"></code></div>
        <div class="payer-slot"><span>${copy("PAYER", "ÖDEYEN")}</span></div>
        <div class="payee-slot"><span>${copy("PAYEE", "ÖDEMEYİ ALAN")}</span></div>
        <div><span>${copy("RAIL", "KANAL")}</span><strong class="proof-rail-slot"></strong></div>
        <div><span>${copy("TRANSPORT", "İLETİŞİM KATMANI")}</span><strong>TECHNOCORE</strong></div>
        <div><span>${copy("VALUE", "GERÇEK DEĞER")}</span><strong>${copy("NONE · PAPER ONLY", "YOK · SADECE PROVA")}</strong></div>
      </div>
      <div class="tclk-proof-note">${copy("The signed transcript proves who performed each step. PaperRail does not prove payment or hold value.", "İmzalı kayıtlar hangi tarafın hangi adımı yaptığını doğrular. PaperRail gerçek ödeme yapmaz ve para ya da başka bir değer tutmaz.")}</div>
      <code class="proof-contract-slot" hidden></code>`;
    fillTclkProofSlots(proof, offer, state);
    const proofState = proof.querySelector(".tclk-proof-state");
    proofState.dataset.protocolState = String(state.status ?? "");
    proofState.textContent = stateLabel(state.status);
    proof.querySelector(".payer-slot").appendChild(payer);
    proof.querySelector(".payee-slot").appendChild(payee);

    const timeline = node("section", "tclk-timeline");
    timeline.appendChild(node("h3", "", copy("Agreement steps", "Anlaşma adımları")));
    // A rejected signed record (most notably a cancel attempt that arrives
    // after the agreement already reached a terminal state) is evidence that
    // something was submitted, not a step in the normal agreement flow. It
    // must never be numbered alongside OFFER/ACCEPT/LOCK/REVEAL/RECEIPT as if
    // it were one — see splitTimelineSteps and the "Rejected records" section
    // below. A genuinely applied cancel (step.ok === true) stays right here.
    const { applied, rejected } = splitTimelineSteps(state.steps);
    applied.forEach((step, position) => {
      const row = node("div", "tclk-step ok");
      row.append(node("span", "", `${position + 1}`), node("strong", "", stepLabel(step.type)), node("em", "", copy("APPLIED", "TAMAMLANDI")));
      timeline.appendChild(row);
    });
    // tclk_apply_transcript (server v0.1.0) folds every record against a single
    // caller-supplied nowMs, not each record's own original moment. Replaying an
    // old transcript later can reject a step purely because of when the replay
    // ran, not because of what actually happened — this covers "offer has
    // expired" as well as the refund-window guards ("refund window is open",
    // "refund window not open yet"). That REJECTED result is real and official —
    // but it is not proof of the deal's original outcome, so a clock-sensitive
    // rejection gets an explicit caveat instead of being presented as settled
    // history. A complete ARCHIVED HISTORICAL REPLAY (deal.historical) already
    // evaluated every step at its own authoritative venue timestamp, never at
    // "now", so that caveat would misrepresent it and is skipped entirely.
    let hasClockDependentRejection = false;
    for (const step of rejected) {
      if (!deal.historical && /expir|refund window/i.test(String(step.reason ?? ""))) hasClockDependentRejection = true;
    }
    if (hasClockDependentRejection) {
      timeline.appendChild(node("p", "tclk-action-note", copy(
        "This was re-evaluated against the current time, not the moment each step actually happened. A step rejected here for a timing reason may have been valid when it was originally signed — this is not a certified record of the deal's original outcome.",
        "Bu değerlendirme, her adımın gerçekleştiği an yerine şu anki zamana göre yeniden yapıldı. Burada zamanlama nedeniyle reddedilen bir adım, aslında imzalandığı anda geçerli olmuş olabilir — bu, anlaşmanın gerçek geçmişinin kesinleşmiş bir kaydı değildir.",
      )));
    }

    // Rejected signed records are kept fully visible as evidence — just not
    // inside the numbered agreement flow above (see splitTimelineSteps).
    let rejectedRecords = null;
    if (rejected.length) {
      rejectedRecords = node("section", "tclk-rejected-records");
      rejectedRecords.appendChild(node("h3", "", copy("Rejected records", "Reddedilen kayıtlar")));
      for (const step of rejected) {
        // Categorized from this step's own rejection reason, not the deal's
        // eventual final status: a mid-flow rejection in a deal that later
        // completed normally must not be mislabeled as "already completed".
        const category = rejectedRecordCategory(step);
        const record = node("div", "tclk-rejected-record");
        record.append(
          node("strong", "", rejectedAttemptLabel(step.type)),
          node("em", "", copy("REJECTED", "REDDEDİLDİ")),
          node("p", "", rejectedRecordExplanation(category)),
        );
        if (step.reason) record.appendChild(node("small", "", step.reason));
        rejectedRecords.appendChild(record);
      }
    }

    const checks = node("section", "tclk-proof-checks");
    const trustedBoardRecords = deal.boardRecords.filter((record) => record.trusted).length;
    const trustedRoomRecords = roomData.records?.filter((record) => record.trusted).length ?? 0;
    const rejectedRoomRecords = roomData.records?.filter((record) => !record.trusted).length ?? 0;
    checks.innerHTML = `<h3>${copy("Proof checks", "Kanıt kontrolleri")}</h3>
      <div><span>✓</span>${trustedBoardRecords} ${copy("verified offer-board records", "imzası doğrulanmış teklif kaydı")}</div>
      <div><span>✓</span>${copy("TCLK state sequence verified in recorded order", "TCLK durum zinciri kayıt sırasına göre doğrulandı")}</div>
      <div><span>✓</span>${trustedRoomRecords} ${copy("verified agreement-room records", "imzası doğrulanmış anlaşma kaydı")}</div>
      ${rejectedRoomRecords ? `<div class="warn"><span>!</span>${copy(`${rejectedRoomRecords} records ignored because transport verification failed`, `İletim doğrulaması başarısız olduğu için ${rejectedRoomRecords} kayıt yok sayıldı`)}</div>` : ""}`;

    const actions = node("section", "tclk-actions-panel");
    actions.appendChild(node("h3", "", copy("What you can do now", "Şimdi ne yapabilirsin?")));
    await appendDealActions(actions, { deal, state, paperState, id });
    main.append(back, proof, timeline, ...(rejectedRecords ? [rejectedRecords] : []), checks, actions);
    setStatus(copy("Agreement proof verified from signed records.", "Anlaşma kanıtı imzalı kayıtlardan doğrulandı."), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}

async function appendDealActions(container, context) {
  const { deal, state, paperState, id } = context;
  const offer = deal.offer.frame;
  const accept = deal.accept?.frame ?? null;
  const contract = state.contract ?? accept?.contract ?? offer.id;
  const room = accept ? dealRoom(accept.contract) : OFFER_ROOM;
  const isPayer = state.parties?.payer === id.did || (!accept && offer.from === id.did);
  const isPayee = state.parties?.payee === id.did || accept?.from === id.did;

  if (state.status === "proposed" && offer.from === id.did) {
    container.appendChild(node("p", "tclk-action-note", copy("Your offer is open. You can cancel it until another agent accepts it.", "Teklifin açık. Başka bir ajan kabul edene kadar iptal edebilirsin.")));
    addAction(container, copy("Cancel offer", "Teklifi iptal et"), async () => {
      const built = await tool("tclk_make_cancel", { from: id.did, contract: offer.id, reason: "cancelled by offer owner" });
      await postLine(OFFER_ROOM, built.line);
    });
  }

  if (state.status === "accepted" && isPayer && accept) {
    container.appendChild(node("p", "tclk-action-note", copy("The offer was accepted. Your turn: create the PaperRail lock.", "Teklif kabul edildi. Sıra sende: anlaşmayı PaperRail üzerinde kilitle.")));
    addAction(container, copy("Create PaperRail lock", "PaperRail kilidini oluştur"), async () => {
      await ensurePaperLock({ contract: accept.contract, statement: accept.statement, refundAfterMs: offer.refundAfterMs });
      const built = await tool("tclk_make_lock", { from: id.did, contract: accept.contract, rail: "paper", ref: accept.contract });
      // LOCK is the first write that must create the derived per-contract
      // deal room — the one write this experiment targets. See postLine().
      await postLine(room, built.line, { directTechnocore: true });
    });
  }

  if (state.status === "accepted" && isPayee && !isPayer && accept) {
    container.appendChild(node("p", "tclk-action-note", copy("You accepted the offer. The payer must create the PaperRail lock before you can continue.", "Teklifi kabul ettin. Devam edebilmen için şimdi ödeyen tarafın PaperRail kilidini oluşturması gerekiyor.")));
  }

  if (state.status === "accepted" && (isPayer || isPayee) && accept) {
    addAction(container, copy("Cancel agreement", "Anlaşmayı iptal et"), async () => {
      const built = await tool("tclk_make_cancel", { from: id.did, contract, reason: "cancelled by party" });
      await postLine(room, built.line);
    });
  }

  if (state.status === "locked" && isPayee && accept) {
    let secret = await getSecret(accept.contract);
    container.appendChild(node("p", "tclk-action-note", copy(
      "The PaperRail lock is ready. Verify the agreement code to complete the deal. This code belongs only to this agreement; it is not a private key, wallet key, or seed phrase.",
      "PaperRail kilidi hazır. Anlaşmayı tamamlamak için anlaşma kodunu doğrula. Bu kod yalnızca bu anlaşmaya aittir; özel anahtar, cüzdan anahtarı veya kurtarma ifadesi değildir.",
    )));
    const importRow = node("div", "tclk-secret-import");
    const secretInput = node("input", "mono");
    secretInput.placeholder = copy("Agreement code if this browser no longer has it", "Bu tarayıcıda yoksa anlaşma kodu");
    if (secret) secretInput.value = secret;
    const save = node("button", "tclk-secondary", copy("Save agreement code in this browser", "Anlaşma kodunu bu tarayıcıda sakla"));
    save.type = "button";
    save.addEventListener("click", async () => {
      secret = secretInput.value.trim();
      if (!/^0x[0-9a-f]{64}$/.test(secret)) return setStatus(copy("Agreement code format is invalid.", "Anlaşma kodunun biçimi geçersiz."), "error");
      await saveSecret(accept.contract, secret);
      setStatus(copy("Agreement code stored in this browser.", "Anlaşma kodu bu tarayıcıda saklandı."), "success");
    });
    importRow.append(secretInput, save);
    container.appendChild(importRow);
    addAction(container, copy("Verify agreement code & complete deal", "Anlaşma kodunu doğrula ve tamamla"), async () => {
      secret = (await getSecret(accept.contract)) ?? secretInput.value.trim();
      if (!/^0x[0-9a-f]{64}$/.test(secret)) throw new Error(copy("This browser does not have the agreement code.", "Bu tarayıcıda bu anlaşmaya ait kod bulunmuyor."));
      const built = await tool("tclk_make_reveal", { from: id.did, contract: accept.contract, secret });
      await postLine(room, built.line);
      await paper("claim", { contract: accept.contract, secret });
    });
  }

  if (state.status === "locked" && isPayer && accept) {
    if (Date.now() >= offer.refundAfterMs) {
      container.appendChild(node("p", "tclk-action-note", copy("The other party has not completed the agreement and the refund window is now open.", "Karşı taraf anlaşmayı henüz tamamlamadı. Geri alma süresi açıldı.")));
      addAction(container, copy("Refund PaperRail", "PaperRail kaydını geri al"), async () => {
        await paper("refund", { contract: accept.contract });
        const built = await tool("tclk_make_refund", { from: id.did, contract: accept.contract, reason: "refund window open" });
        await postLine(room, built.line);
      });
    } else {
      container.appendChild(node("p", "tclk-action-note", `${copy("Waiting for the other party to verify the agreement code and complete the deal. Refund becomes available", "Karşı tarafın anlaşma kodunu doğrulayıp işlemi tamamlaması bekleniyor. Geri alma hakkın şu tarihte açılır")}: ${new Date(offer.refundAfterMs).toLocaleString()}`));
    }
  }

  if (["claimed", "refunded", "cancelled"].includes(state.status) && (isPayer || isPayee) && accept) {
    addAction(container, copy("Sign closure record", "Kapanış kaydını imzala"), async () => {
      const built = await tool("tclk_make_receipt", {
        from: id.did,
        contract: accept.contract,
        outcome: state.status,
        ...(state.rail ? { rail: state.rail } : {}),
        ...(state.railRef ? { ref: state.railRef } : {}),
      });
      await postLine(room, built.line);
    });
  }

  if (paperState) {
    const paperCard = node("div", "tclk-paper-state");
    paperCard.append(
      node("span", "", copy("PAPERRAIL RECORD", "PAPERRAIL KAYDI")),
      node("strong", "", paperStateLabel(paperState.status)),
      node("small", "", copy("Rehearsal record only. It is not payment proof.", "Bu yalnızca prova kaydıdır; ödeme kanıtı değildir.")),
    );
    container.appendChild(paperCard);
  }

  if (!container.querySelector(".tclk-action-button") && !container.querySelector(".tclk-secret-import") && !container.querySelector(".tclk-action-note")) {
    container.appendChild(node("p", "tclk-action-note", copy("There is nothing you need to do in the current state.", "Şu anda senden beklenen bir işlem yok.")));
  }
}

function addAction(container, label, handler) {
  const button = node("button", "tclk-primary tclk-action-button", label);
  button.type = "button";
  button.addEventListener("click", async () => {
    if (busy) return;
    try {
      setBusy(true);
      setStatus(`${label}…`, "working");
      await handler();
      boardCache = null;
      setStatus(copy("Action completed. Refreshing the agreement…", "İşlem tamamlandı. Anlaşma kaydı yenileniyor…"), "success");
      await showTab("mine");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), "error");
    } finally { setBusy(false); }
  });
  container.appendChild(button);
}

async function showTab(tab) {
  if (!["discover", "mine", "create"].includes(tab)) return;
  currentTab = tab;
  workspace.querySelectorAll(".tclk-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "create") renderCreate();
  else await renderDealCards(tab === "discover" ? "discover" : "mine");
}

function hideDeals() {
  if (!workspace || workspace.hidden) return;
  workspace.hidden = true;
  shell?.classList.remove("tclk-mode");
  entry?.classList.remove("active");
}

async function openDeals() {
  if (!shell || !workspace) return;
  shell.querySelector(".communication-workspace")?.setAttribute("hidden", "");
  shell.querySelector(".mailbox-workspace")?.setAttribute("hidden", "");
  shell.classList.remove("network-mode", "mailbox-mode");
  shell.querySelector(".network-entry")?.classList.remove("active");
  shell.querySelector(".mailbox-entry")?.classList.remove("active");
  shell.querySelectorAll(".product-nav-item").forEach((item) => item.classList.remove("active"));
  for (const selector of [".workspace-header", ".workspace-stage-label", "#active-actions", ".workspace-secondary-view"]) {
    shell.querySelector(selector)?.classList.add("shell-view-hidden");
  }
  entry.classList.add("active");
  shell.classList.add("tclk-mode");
  workspace.hidden = false;
  await showTab(currentTab);
}

function bind(nextShell) {
  shell = nextShell;
  loadStyle();
  const sidebar = shell.querySelector(".product-sidebar");
  const productNav = shell.querySelector(".product-nav");
  const productWorkspace = shell.querySelector(".product-workspace");
  if (!sidebar || !productNav || !productWorkspace) return;
  entry = ensureSidebarEntry(sidebar, entry, makeEntry, [".mailbox-entry", ".network-entry", ".product-nav"]);
  if (!workspace?.isConnected) {
    workspace = makeWorkspace();
    productWorkspace.appendChild(workspace);
  }
  if (shell.dataset.tclkNavBound !== "true") {
    shell.dataset.tclkNavBound = "true";
    shell.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(".tclk-entry")) return;
      if (target.closest(".product-nav-item, .capability-selector-button, .network-entry, .mailbox-entry")) hideDeals();
    }, { capture: true });
  }
}

function boot() {
  const current = document.querySelector(".product-shell");
  if (current) return bind(current);
  const observer = new MutationObserver(() => {
    const next = document.querySelector(".product-shell");
    if (!next) return;
    observer.disconnect();
    bind(next);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.documentElement.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest(".lang-button")) return;
  queueMicrotask(() => {
    if (entry) {
      entry.querySelector("strong").textContent = copy("Deals", "Anlaşmalar");
      entry.querySelector("small").textContent = "tclk/1 · PaperRail";
    }
    if (workspace && !workspace.hidden) {
      const replacement = makeWorkspace();
      workspace.replaceWith(replacement);
      workspace = replacement;
      workspace.hidden = false;
      void showTab(currentTab);
    }
    if (shell) bind(shell);
  });
});

boot();
