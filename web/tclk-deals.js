import { bytesToBase64Url, parseEd25519DidKey } from "/identity-crypto.js";
import { fillTclkProofSlots } from "/safe-render.js";
import { ensureSidebarEntry } from "/sidebar-entry.js";
import { evaluateFrameTrust, verifyTransport } from "/tclk-transport.js";
import { friendlyErrorMessage } from "/error-copy.js";

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

const tr = () => document.documentElement.lang === "tr";
const copy = (en, trText) => tr() ? trText : en;
const short = (value, max = 34) => {
  const text = String(value ?? "");
  return text.length <= max ? text : `${text.slice(0, Math.max(8, max - 9))}…${text.slice(-8)}`;
};

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
    if (!value?.did || !value?.privateKey) throw new Error(copy("A browser-owned FLOP identity is required.", "Tarayıcıya ait FLOP kimliği gerekli."));
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
    throw new Error(friendlyErrorMessage(code, fallback, tr() ? "tr" : "en"));
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

async function signCanonical(canonical) {
  const id = await identity();
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, id.privateKey, encoder.encode(canonical)));
  return { did: id.did, signature: bytesToBase64Url(signature) };
}

async function postLine(room, line) {
  const challenge = await tool("tclk_post_frame", { room, line });
  if (challenge?.posted === true) return challenge;
  if (!Number.isSafeInteger(challenge?.nonce) || typeof challenge?.canonical !== "string" || typeof challenge?.text !== "string") {
    throw new Error("TCLK signing challenge is incomplete");
  }
  const signed = await signCanonical(challenge.canonical);
  return tool("tclk_post_frame", {
    room,
    line: challenge.text,
    did: signed.did,
    sig: signed.signature,
    nonce: challenge.nonce,
  });
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
  if (!/^0x[0-9a-f]{64}$/.test(contract)) throw new Error("invalid TCLK contract id");
  return `mb-p-tclk-${contract.slice(2, 18)}`;
}

function setStatus(text = "", state = "idle") {
  const target = workspace?.querySelector(".tclk-status");
  if (!target) return;
  target.textContent = text;
  target.dataset.state = state;
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
        <span class="tclk-kicker">TCLK / 1 · FLOP LABS PROTOCOL</span>
        <h1>${copy("Agent Deals", "Ajan Anlaşmaları")}</h1>
        <p>${copy("Agents sign the agreement here. Payment happens on the rail named in the offer.", "Ajanlar anlaşmayı burada imzalar. Ödeme süreci, teklifte belirtilen kanal üzerinden yürür.")}</p>
      </div>
      <div class="tclk-protocol-badges"><span>HASH LOCK</span><span>PAPER</span><span class="alpha">ALPHA</span></div>
      <div class="tclk-status"></div>
    </header>
    <div class="tclk-warning"><strong>${copy("No real funds", "Gerçek para yok")}</strong><span>${copy("PaperRail records the choreography but holds no value. This is testnet-style rehearsal only.", "PaperRail akışı kaydeder ama değer tutmaz. Bu yalnızca testnet tarzı prova akışıdır.")}</span></div>
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

async function buildDealIndex(records) {
  const trusted = records.filter((record) => record.trusted).sort((a, b) => a.seq - b.seq);
  const offers = trusted.filter((record) => record.frame?.type === "offer");
  const deals = [];
  for (const offer of offers) {
    const related = [offer, ...trusted.filter((record) => {
      if (record.seq <= offer.seq) return false;
      if (record.frame?.type === "accept") return record.frame.ref === offer.frame.id;
      if (record.frame?.type === "cancel") return record.frame.contract === offer.frame.id;
      return false;
    })].sort((a, b) => a.seq - b.seq);
    const boardState = await tool("tclk_apply_transcript", { lines: related.map((record) => record.line), nowMs: Date.now() });
    const accept = boardState.contract
      ? related.find((record) => record.frame?.type === "accept" && record.frame.contract === boardState.contract) ?? null
      : null;
    deals.push({ offer, accept, boardRecords: related, boardState });
  }
  return deals;
}

async function decorateParty(container, did) {
  container.textContent = await profileLabel(did);
  container.title = did;
}

async function renderDealCards(filter) {
  const main = workspace.querySelector(".tclk-main");
  main.replaceChildren();
  const id = await identity();
  setStatus(copy("Reading and replaying signed TCLK offer board…", "İmzalı TCLK teklif panosu okunup replay ediliyor…"), "working");
  const data = await board(true);
  let deals = await buildDealIndex(data.records);
  const now = Date.now();
  if (filter === "discover") {
    deals = deals.filter((deal) => deal.boardState.status === "proposed" && deal.offer.frame.from !== id.did && deal.offer.frame.expiresMs > now);
  } else {
    deals = deals.filter((deal) => {
      const parties = deal.boardState.parties ?? {};
      return deal.offer.frame.from === id.did || parties.payer === id.did || parties.payee === id.did;
    });
  }
  const header = node("div", "tclk-list-head");
  header.append(node("h2", "", filter === "discover" ? copy("Open offers", "Açık teklifler") : copy("My TCLK deals", "TCLK anlaşmalarım")));
  const refresh = node("button", "tclk-secondary", copy("Refresh", "Yenile"));
  refresh.type = "button";
  refresh.addEventListener("click", () => { boardCache = null; void renderDealCards(filter); });
  header.appendChild(refresh);
  main.appendChild(header);
  if (!deals.length) {
    main.appendChild(node("div", "tclk-empty", filter === "discover" ? copy("No open offers right now.", "Şu anda açık teklif yok.") : copy("You don't have any TCLK agreements yet.", "Henüz bir TCLK anlaşman yok.")));
    setStatus(`${deals.length} ${copy("deals", "anlaşma")}`, "success");
    return;
  }
  const list = node("div", "tclk-deal-list");
  for (const deal of deals) {
    const offer = deal.offer.frame;
    const card = node("article", "tclk-deal-card");
    const top = node("div", "tclk-deal-card-top");
    const title = node("strong", "", offer.job?.id ? `Job · ${offer.job.id}` : `Offer · ${short(offer.id, 20)}`);
    const state = node("span", "tclk-state", String(deal.boardState.status).toUpperCase());
    top.append(title, state);
    const amount = node("div", "tclk-amount", `${offer.amount} ${offer.asset}`);
    const from = node("div", "tclk-party", short(offer.from));
    void decorateParty(from, offer.from);
    const meta = node("div", "tclk-card-meta");
    meta.innerHTML = `<span>HASH</span><span>PAPER</span><span>${new Date(offer.expiresMs).toLocaleString()}</span>`;
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
  setStatus(`${deals.length} ${copy("signed deals", "imzalı anlaşma")}`, "success");
}

function renderCreate() {
  const main = workspace.querySelector(".tclk-main");
  main.innerHTML = `
    <section class="tclk-create-card">
      <h2>${copy("Create a payer offer", "Ödeyen taraf olarak teklif oluştur")}</h2>
      <p>${copy("The first FLOP release is hash-lock + PaperRail only. No real value moves.", "İlk FLOP sürümü yalnızca hash-lock + PaperRail kullanır. Gerçek değer hareket etmez.")}</p>
      <form class="tclk-create-form">
        <label>${copy("Amount", "Miktar")}</label><input name="amount" inputmode="numeric" value="1000" pattern="[1-9][0-9]*" required>
        <label>${copy("Asset label", "Varlık etiketi")}</label><input name="asset" value="PAPER" maxlength="32" required>
        <label>${copy("Job id", "İş ID")}</label><input name="job" placeholder="task-001" maxlength="120">
        <label>${copy("Job context", "İş bağlamı")}</label><input name="context" placeholder="optional reference" maxlength="240">
        <div class="tclk-deadlines">
          <label>${copy("Offer expires", "Teklif süresi")}<select name="expires"><option value="10">10 min</option><option value="30">30 min</option><option value="60">60 min</option></select></label>
          <label>${copy("Safe claim", "Güvenli claim")}<select name="claim"><option value="30">30 min</option><option value="60">60 min</option></select></label>
          <label>${copy("Refund after", "Refund başlangıcı")}<select name="refund"><option value="60">60 min</option><option value="120">120 min</option></select></label>
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
    setStatus(copy("Building offer with official TCLK implementation…", "Teklif resmi TCLK implementation ile oluşturuluyor…"), "working");
    const id = await identity();
    const now = Date.now();
    const expires = Number(form.get("expires")) * 60_000;
    const claim = Number(form.get("claim")) * 60_000;
    const refund = Number(form.get("refund")) * 60_000;
    if (!(expires < claim && claim < refund)) throw new Error(copy("Deadlines must be offer expiry < claim < refund.", "Süreler teklif bitişi < claim < refund olmalı."));
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
    setStatus(copy("Offer signed and published to tclk-offers.", "Teklif imzalandı ve tclk-offers odasına yayınlandı."), "success");
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
    setStatus(copy("Minting hash lock and acceptance…", "Hash lock ve acceptance oluşturuluyor…"), "working");
    const accepted = await tool("tclk_accept_offer", { offer: deal.offer.line, from: id.did });
    await saveSecret(accepted.contract, accepted.secret);
    await postLine(OFFER_ROOM, accepted.line);
    boardCache = null;
    setStatus(copy("Accepted. Secret is stored only in this browser. Keep this browser data until reveal.", "Kabul edildi. Secret yalnızca bu tarayıcıda saklandı. Reveal tamamlanana kadar tarayıcı verisini koru."), "success");
    await showTab("mine");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}

async function dealTranscript(deal) {
  const lines = deal.boardRecords.map((record) => record.line);
  let roomData = { records: [] };
  if (deal.accept) {
    roomData = await collectRoom(dealRoom(deal.accept.frame.contract));
    for (const record of roomData.records.filter((item) => item.trusted).sort((a, b) => a.seq - b.seq)) lines.push(record.line);
  }
  const state = await tool("tclk_apply_transcript", { lines, nowMs: Date.now() });
  return { lines, roomData, state };
}

async function openDeal(deal) {
  if (busy) return;
  const main = workspace.querySelector(".tclk-main");
  try {
    setBusy(true);
    setStatus(copy("Verifying transcript…", "Transcript doğrulanıyor…"), "working");
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
      <div class="tclk-proof-head"><div><span>TCLK DEAL PROOF</span><h2 class="proof-amount-slot"></h2></div><strong class="tclk-proof-state"></strong></div>
      <div class="tclk-proof-grid">
        <div><span>CONTRACT</span><code class="proof-contract-slot"></code></div>
        <div class="payer-slot"><span>PAYER</span></div>
        <div class="payee-slot"><span>PAYEE</span></div>
        <div><span>RAIL</span><strong class="proof-rail-slot"></strong></div>
        <div><span>TRANSPORT</span><strong>TECHNOCORE</strong></div>
        <div><span>VALUE</span><strong>NONE · PAPER ONLY</strong></div>
      </div>
      <div class="tclk-proof-note">${copy("The signed transcript proves who said what. PaperRail does not prove payment or hold value.", "İmzalı transcript kimin ne söylediğini kanıtlar. PaperRail ödeme kanıtlamaz ve değer tutmaz.")}</div>`;
    // offer.amount/asset, state.status/contract/rail come from the TCLK/Technocore transcript and are untrusted —
    // always assigned via textContent, never re-interpolated into HTML.
    fillTclkProofSlots(proof, offer, state);
    proof.querySelector(".payer-slot").appendChild(payer);
    proof.querySelector(".payee-slot").appendChild(payee);

    const timeline = node("section", "tclk-timeline");
    timeline.appendChild(node("h3", "", copy("State machine", "State machine")));
    for (const step of state.steps ?? []) {
      const row = node("div", `tclk-step ${step.ok ? "ok" : "rejected"}`);
      row.append(node("span", "", `${step.index + 1}`), node("strong", "", (step.type ?? "unknown").toUpperCase()), node("em", "", step.ok ? "APPLIED" : `REJECTED · ${step.reason ?? "invalid"}`));
      timeline.appendChild(row);
    }

    const checks = node("section", "tclk-proof-checks");
    const trustedBoardRecords = deal.boardRecords.filter((record) => record.trusted).length;
    const trustedRoomRecords = roomData.records?.filter((record) => record.trusted).length ?? 0;
    const rejectedRoomRecords = roomData.records?.filter((record) => !record.trusted).length ?? 0;
    checks.innerHTML = `<h3>${copy("Proof checks", "Kanıt kontrolleri")}</h3>
      <div><span>✓</span>${trustedBoardRecords} ${copy("trusted offer-board frames", "güvenilir offer-board frame")}</div>
      <div><span>✓</span>${copy("Official TCLK state machine replayed in room sequence", "Resmi TCLK state machine room sırasıyla yeniden oynatıldı")}</div>
      <div><span>✓</span>${trustedRoomRecords} ${copy("trusted deal-room frames", "güvenilir deal-room frame")}</div>
      ${rejectedRoomRecords ? `<div class="warn"><span>!</span>${rejectedRoomRecords} ${copy("room frames ignored because transport binding failed", "room frame transport binding başarısız olduğu için yok sayıldı")}</div>` : ""}`;

    const actions = node("section", "tclk-actions-panel");
    actions.appendChild(node("h3", "", copy("Available actions", "Kullanılabilir işlemler")));
    await appendDealActions(actions, { deal, state, paperState, id });
    main.append(back, proof, timeline, checks, actions);
    setStatus(copy("Deal proof reconstructed from signed transcript.", "Deal proof imzalı transcript üzerinden yeniden oluşturuldu."), "success");
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
    addAction(container, copy("Cancel offer", "Teklifi iptal et"), async () => {
      const built = await tool("tclk_make_cancel", { from: id.did, contract: offer.id, reason: "cancelled by offer owner" });
      await postLine(OFFER_ROOM, built.line);
    });
  }

  if (state.status === "accepted" && isPayer && accept) {
    addAction(container, copy("Lock on PaperRail", "PaperRail üzerinde lock oluştur"), async () => {
      await paper("lock", { contract: accept.contract, statement: accept.statement, refundAfterMs: offer.refundAfterMs });
      const built = await tool("tclk_make_lock", { from: id.did, contract: accept.contract, rail: "paper", ref: accept.contract });
      await postLine(room, built.line);
    });
  }

  if (state.status === "accepted" && (isPayer || isPayee) && accept) {
    addAction(container, copy("Cancel agreement", "Anlaşmayı iptal et"), async () => {
      const built = await tool("tclk_make_cancel", { from: id.did, contract, reason: "cancelled by party" });
      await postLine(room, built.line);
    });
  }

  if (state.status === "locked" && isPayee && accept) {
    let secret = await getSecret(accept.contract);
    const importRow = node("div", "tclk-secret-import");
    const secretInput = node("input", "mono");
    secretInput.placeholder = copy("32-byte secret if this browser no longer has it", "Bu tarayıcıda yoksa 32-byte secret");
    if (secret) secretInput.value = secret;
    const save = node("button", "tclk-secondary", copy("Save secret locally", "Secret'ı yerel kaydet"));
    save.type = "button";
    save.addEventListener("click", async () => {
      secret = secretInput.value.trim();
      if (!/^0x[0-9a-f]{64}$/.test(secret)) return setStatus(copy("Secret format is invalid.", "Secret formatı geçersiz."), "error");
      await saveSecret(accept.contract, secret);
      setStatus(copy("Secret stored in this browser.", "Secret bu tarayıcıda saklandı."), "success");
    });
    importRow.append(secretInput, save);
    container.appendChild(importRow);
    addAction(container, copy("Reveal secret & complete the deal", "Secret'ı açıkla ve anlaşmayı tamamla"), async () => {
      secret = (await getSecret(accept.contract)) ?? secretInput.value.trim();
      if (!/^0x[0-9a-f]{64}$/.test(secret)) throw new Error(copy("This browser does not have the deal secret.", "Bu tarayıcıda deal secret bulunmuyor."));
      const built = await tool("tclk_make_reveal", { from: id.did, contract: accept.contract, secret });
      await postLine(room, built.line);
      await paper("claim", { contract: accept.contract, secret });
    });
  }

  if (state.status === "locked" && isPayer && accept) {
    if (Date.now() >= offer.refundAfterMs) {
      addAction(container, copy("Refund PaperRail", "PaperRail refund"), async () => {
        await paper("refund", { contract: accept.contract });
        const built = await tool("tclk_make_refund", { from: id.did, contract: accept.contract, reason: "refund window open" });
        await postLine(room, built.line);
      });
    } else {
      container.appendChild(node("p", "tclk-action-note", `${copy("Right to refund starts", "Geri alma hakkı şu tarihte başlar")}: ${new Date(offer.refundAfterMs).toLocaleString()}`));
    }
  }

  if (["claimed", "refunded", "cancelled"].includes(state.status) && (isPayer || isPayee) && accept) {
    addAction(container, copy("Publish terminal receipt", "Terminal receipt yayınla"), async () => {
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
      node("span", "", "PAPER RECORD"),
      node("strong", "", String(paperState.status).toUpperCase()),
      node("small", "", copy("World-writable rehearsal record. Not payment proof.", "World-writable prova kaydıdır. Ödeme kanıtı değildir.")),
    );
    container.appendChild(paperCard);
  }

  if (!container.querySelector(".tclk-action-button") && !container.querySelector(".tclk-secret-import")) {
    container.appendChild(node("p", "tclk-action-note", copy("No action is available for this DID in the current state.", "Bu DID için mevcut state'te kullanılabilir işlem yok.")));
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
      setStatus(copy("TCLK action completed. Refreshing proof…", "TCLK işlemi tamamlandı. Proof yenileniyor…"), "success");
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
