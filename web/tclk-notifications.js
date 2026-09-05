import { base64UrlToBytes, bytesToBase64Url, parseEd25519DidKey } from "/identity-crypto.js";
const API_BASE = "https://flop-status-production.up.railway.app";
const IDENTITY_DB = "flop-agent-key-v1";
const IDENTITY_STORE = "identity";
const ACTIVE_ID = "active";
const TCLK_CLOSURE_EVENT_PREFIX = "flop:event:tclk-closure:v1:";
const encoder = new TextEncoder();
const STORAGE_PREFIX = "flop-tclk-notifications:";
const STORAGE_SCHEMA = 1;
const LEGACY_STORAGE_KEYS = [
  "flop-tclk-notifications-v6:",
  "flop-tclk-notifications-v5:",
  "flop-tclk-accept-notifications-v4:",
];
const SUPPORTED_KINDS = ["accepted", "locked", "completed"];
const POLL_MS = 10_000;
const OPEN_DEAL_WAIT_STEP_MS = 250;
const OPEN_DEAL_WAIT_LIMIT_MS = 30_000;

let activeDid = "";
let polling = false;
let intervalId = null;
let pending = new Map();
let announced = new Set();
let uiEventsBound = false;

function tr() {
  return document.documentElement.lang === "tr";
}

function copy(en, trText) {
  return tr() ? trText : en;
}

function canonicalizeMailboxEnvelope(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeMailboxEnvelope).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeMailboxEnvelope(value[key])}`).join(",")}}`;
  }
  throw new Error("unsupported canonical JSON value");
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openNotificationIdentityDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDENTITY_DB, 1);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function notificationIdentity() {
  const db = await openNotificationIdentityDb();
  try {
    const tx = db.transaction(IDENTITY_STORE, "readonly");
    return await idbRequest(tx.objectStore(IDENTITY_STORE).get(ACTIVE_ID));
  } finally {
    db.close();
  }
}

async function signedInboxAction(did) {
  const id = await notificationIdentity();
  if (!id?.did || !id?.privateKey || id.did !== did) throw new Error("active identity unavailable");
  const payload = {
    version: "1",
    actor_did: id.did,
    nonce: crypto.randomUUID(),
    issued_at: new Date().toISOString(),
    action: "LIST_DIRECT_INBOX",
  };
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "Ed25519" },
    id.privateKey,
    encoder.encode(canonicalizeMailboxEnvelope(payload)),
  ));
  return {
    payload,
    signature: {
      algorithm: "Ed25519",
      encoding: "base64url",
      value: bytesToBase64Url(signature),
    },
  };
}

function normalizeMailboxMessage(raw) {
  return {
    id: raw.id,
    senderDid: raw.senderDid ?? raw.sender_did,
    recipientDid: raw.recipientDid ?? raw.recipient_did,
    nonce: raw.nonce,
    rawText: raw.rawText ?? raw.raw_text,
    senderSignature: raw.senderSignature ?? raw.sender_signature,
    sentAt: raw.sentAt ?? raw.sent_at,
  };
}

async function verifyClosureMessage(message) {
  try {
    const rawKey = parseEd25519DidKey(message.senderDid);
    const key = await crypto.subtle.importKey("raw", rawKey, { name: "Ed25519" }, false, ["verify"]);
    const payload = {
      version: "1",
      actor_did: message.senderDid,
      nonce: message.nonce,
      issued_at: message.sentAt,
      action: "SEND_DIRECT_MESSAGE",
      recipient_did: message.recipientDid,
      text: message.rawText,
    };
    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64UrlToBytes(message.senderSignature),
      encoder.encode(canonicalizeMailboxEnvelope(payload)),
    );
  } catch {
    return false;
  }
}

async function fetchClosureEvents(did) {
  const response = await fetch(`${API_BASE}/api/v1/communication/mailbox/inbox`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(await signedInboxAction(did)),
  });
  if (!response.ok) return [];

  const body = await response.json();
  const messages = (body.messages ?? []).map(normalizeMailboxMessage);
  const candidates = messages.filter((message) => (
    message?.recipientDid === did
    && typeof message.rawText === "string"
    && message.rawText.startsWith(TCLK_CLOSURE_EVENT_PREFIX)
  ));

  const verified = await Promise.all(candidates.map(async (message) => (
    await verifyClosureMessage(message) ? message : null
  )));

  return verified.flatMap((message) => {
    if (!message) return [];
    let event;
    try {
      event = JSON.parse(message.rawText.slice(TCLK_CLOSURE_EVENT_PREFIX.length));
    } catch {
      return [];
    }
    if (
      event?.type !== "tclk_closure_signed"
      || event.actor_did !== message.senderDid
      || typeof event.offer_id !== "string"
      || typeof event.contract_id !== "string"
    ) return [];

    return [{
      notificationKind: "closure",
      notificationKey: `closure|${message.id}`,
      actorDid: message.senderDid,
      offerId: event.offer_id,
      contractId: event.contract_id,
      amount: String(event.amount ?? ""),
      asset: String(event.asset ?? ""),
      updatedAt: message.sentAt,
    }];
  });
}

function eventKey(deal) {
  if (deal.notificationKind === "closure") return deal.notificationKey;
  return [deal.notificationKind, deal.venue, deal.offerId, deal.contractId, deal.payerDid, deal.payeeDid]
    .map((value) => String(value ?? ""))
    .join("|");
}

function notificationActorDid(deal) {
  if (deal.notificationKind === "closure") return deal.actorDid;
  return deal.notificationKind === "locked" ? deal.payerDid : deal.payeeDid;
}

function notificationTitle(deal) {
  if (deal.notificationKind === "closure") {
    return copy("Closure record signed", "Kapanış kaydı imzalandı");
  }
  if (deal.notificationKind === "completed") {
    return copy("Agreement completed", "Anlaşma tamamlandı");
  }
  if (deal.notificationKind === "locked") {
    return copy("PaperRail lock created", "PaperRail kilidi oluşturuldu");
  }
  return copy("Your offer was accepted", "Teklifin kabul edildi");
}

function notificationBody(deal, actor) {
  if (deal.notificationKind === "closure") {
    return copy(
      `${actor} signed the closure record.`,
      `${actor} kapanış kaydını imzaladı.`,
    );
  }
  if (deal.notificationKind === "completed") {
    return copy(
      `${actor} verified the agreement code and completed the deal.`,
      `${actor} anlaşma kodunu doğruladı ve anlaşmayı tamamladı.`,
    );
  }
  if (deal.notificationKind === "locked") {
    return copy(
      `${actor} created the PaperRail lock. It is your turn.`,
      `${actor} PaperRail kilidini oluşturdu. Sıra sende.`,
    );
  }
  return copy(`${actor} accepted your offer.`, `${actor} teklifini kabul etti.`);
}

function storageKey(did) {
  return STORAGE_PREFIX + did;
}

function cleanState(parsed) {
  if (!parsed || !Array.isArray(parsed.seen)) return null;
  return {
    schema: STORAGE_SCHEMA,
    initialized: parsed.initialized === true,
    seen: parsed.seen.filter((value) => typeof value === "string"),
    knownKinds: Array.isArray(parsed.knownKinds)
      ? parsed.knownKinds.filter((value) => SUPPORTED_KINDS.includes(value))
      : [...SUPPORTED_KINDS],
  };
}

function loadState(did) {
  try {
    const current = cleanState(JSON.parse(localStorage.getItem(storageKey(did)) ?? "null"));
    if (current) return current;

    for (const prefix of LEGACY_STORAGE_KEYS) {
      const legacy = cleanState(JSON.parse(localStorage.getItem(prefix + did) ?? "null"));
      if (!legacy) continue;
      saveState(did, legacy);
      return legacy;
    }
  } catch {}

  return {
    schema: STORAGE_SCHEMA,
    initialized: false,
    seen: [],
    knownKinds: [...SUPPORTED_KINDS],
  };
}

function saveState(did, state) {
  localStorage.setItem(storageKey(did), JSON.stringify({
    schema: STORAGE_SCHEMA,
    initialized: state.initialized === true,
    seen: Array.from(new Set(state.seen)).slice(-500),
    knownKinds: Array.from(new Set(state.knownKinds ?? [])).filter((value) => SUPPORTED_KINDS.includes(value)),
  }));
}

function currentIdentityDid() {
  const did = document.getElementById("did")?.textContent?.trim() ?? "";
  return did.startsWith("did:key:") ? did : "";
}

function notificationForDeal(deal, did) {
  const hasAcceptedParties = deal
    && typeof deal.payerDid === "string"
    && typeof deal.payeeDid === "string"
    && deal.payerDid.startsWith("did:key:")
    && deal.payeeDid.startsWith("did:key:")
    && deal.payerDid !== deal.payeeDid
    && typeof deal.contractId === "string"
    && deal.contractId.startsWith("0x");

  if (!hasAcceptedParties) return null;

  if (deal.payerDid === did && deal.status === "claimed") {
    return { ...deal, notificationKind: "completed" };
  }

  if (deal.payerDid === did && deal.status !== "proposed") {
    return { ...deal, notificationKind: "accepted" };
  }

  if (deal.payeeDid === did && deal.status === "locked") {
    return { ...deal, notificationKind: "locked" };
  }

  return null;
}

async function fetchNotifications(did) {
  const response = await fetch(`${API_BASE}/api/v1/tclk/history?did=${encodeURIComponent(did)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return [];
  const body = await response.json();
  const deals = Array.isArray(body?.deals) ? body.deals : [];
  return deals.map((deal) => notificationForDeal(deal, did)).filter(Boolean);
}

async function profileLabel(did) {
  try {
    const profile = await window.FLOPAgentProfiles?.profileForDid?.(did);
    if (profile?.handle) return `@${profile.handle}`;
    if (profile?.displayName) return profile.displayName;
  } catch {}
  const text = String(did ?? "");
  return text.length <= 24 ? text : `${text.slice(0, 12)}…${text.slice(-8)}`;
}

function loadStyle() {
  if (document.getElementById("flop-tclk-notification-style")) return;
  const link = document.createElement("link");
  link.id = "flop-tclk-notification-style";
  link.rel = "stylesheet";
  link.href = "/tclk-notifications.css?v=tclk-notifications-v3";
  document.head.appendChild(link);
}

function bellSvg() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const bell = document.createElementNS(ns, "path");
  bell.setAttribute("d", "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9");
  bell.setAttribute("fill", "none");
  bell.setAttribute("stroke", "currentColor");
  bell.setAttribute("stroke-width", "1.7");
  bell.setAttribute("stroke-linecap", "round");
  bell.setAttribute("stroke-linejoin", "round");

  const clapper = document.createElementNS(ns, "path");
  clapper.setAttribute("d", "M10 20h4");
  clapper.setAttribute("fill", "none");
  clapper.setAttribute("stroke", "currentColor");
  clapper.setAttribute("stroke-width", "1.7");
  clapper.setAttribute("stroke-linecap", "round");

  svg.append(bell, clapper);
  return svg;
}

function ensureBell() {
  const brand = document.querySelector(".product-brand");
  if (!brand) return null;

  let center = brand.querySelector(".tclk-notification-center");
  if (center) return center;

  center = document.createElement("span");
  center.className = "tclk-notification-center";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tclk-notification-bell";
  button.setAttribute("aria-label", copy("Notifications", "Bildirimler"));
  button.setAttribute("aria-expanded", "false");
  button.appendChild(bellSvg());

  const badge = document.createElement("span");
  badge.className = "tclk-notification-count";
  badge.hidden = true;
  button.appendChild(badge);

  const panel = document.createElement("section");
  panel.className = "tclk-notification-panel";
  panel.hidden = true;

  center.append(button, panel);
  const language = brand.querySelector(".language-switch");
  brand.insertBefore(center, language);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) void renderPanel();
  });

  return center;
}

function updateBell() {
  const center = ensureBell();
  if (!center) return;
  const button = center.querySelector(".tclk-notification-bell");
  const badge = center.querySelector(".tclk-notification-count");
  if (!(button instanceof HTMLButtonElement) || !(badge instanceof HTMLElement)) return;

  const count = pending.size;
  button.classList.toggle("has-unread", count > 0);
  badge.hidden = count === 0;
  badge.textContent = count > 9 ? "9+" : String(count);
  badge.setAttribute("aria-label", copy(`${count} unread notifications`, `${count} okunmamış bildirim`));

  const panel = center.querySelector(".tclk-notification-panel");
  if (panel && !panel.hidden) void renderPanel();
}

function ringBell() {
  const button = ensureBell()?.querySelector(".tclk-notification-bell");
  if (!(button instanceof HTMLButtonElement)) return;
  button.classList.remove("is-ringing");
  void button.offsetWidth;
  button.classList.add("is-ringing");
  button.addEventListener("animationend", () => button.classList.remove("is-ringing"), { once: true });
}

function markSeen(keys) {
  const did = activeDid;
  if (!did || !keys.length) return;
  const state = loadState(did);
  state.seen.push(...keys);
  saveState(did, state);
  for (const key of keys) {
    pending.delete(key);
    announced.delete(key);
  }
  updateBell();
}

function dismissToast(toast) {
  if (toast?.isConnected) toast.remove();
}

async function openDeal(deal, key, toast) {
  markSeen([key]);
  dismissToast(toast);
  const panel = document.querySelector(".tclk-notification-panel");
  if (panel) panel.hidden = true;
  document.querySelector(".tclk-notification-bell")?.setAttribute("aria-expanded", "false");

  const entry = document.querySelector(".tclk-entry");
  if (!(entry instanceof HTMLButtonElement)) return;
  entry.click();

  const mine = document.querySelector('.tclk-workspace .tclk-tabs button[data-tab="mine"]');
  if (mine instanceof HTMLButtonElement) mine.click();

  const offerId = String(deal.offerId ?? "");
  const contractId = String(deal.contractId ?? "");
  const start = Date.now();
  const findCard = () => {
    const cards = Array.from(document.querySelectorAll(".tclk-workspace:not([hidden]) .tclk-deal-card"));
    const matches = cards.filter((card) => {
      if (card.dataset.offerId !== offerId) return false;
      if (contractId && card.dataset.contractId !== contractId) return false;
      return true;
    });
    return matches.length === 1 ? matches[0] : null;
  };

  let card = findCard();
  while (!card && Date.now() - start < OPEN_DEAL_WAIT_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, OPEN_DEAL_WAIT_STEP_MS));
    card = findCard();
  }
  if (!card) return;

  card.scrollIntoView({ behavior: "smooth", block: "center" });
  const open = card.querySelector(".tclk-card-actions button");
  if (open instanceof HTMLButtonElement) open.click();
}

async function renderPanel() {
  const center = ensureBell();
  const panel = center?.querySelector(".tclk-notification-panel");
  if (!(panel instanceof HTMLElement)) return;

  panel.replaceChildren();

  const head = document.createElement("div");
  head.className = "tclk-notification-panel-head";
  const title = document.createElement("strong");
  title.textContent = copy("Notifications", "Bildirimler");
  head.appendChild(title);
  panel.appendChild(head);

  if (!pending.size) {
    const empty = document.createElement("p");
    empty.className = "tclk-notification-empty";
    empty.textContent = copy("No new notifications.", "Yeni bildirim yok.");
    panel.appendChild(empty);
    return;
  }

  const entries = [...pending.entries()].sort(
    (a, b) => Date.parse(b[1].updatedAt ?? "0") - Date.parse(a[1].updatedAt ?? "0"),
  );

  for (const [key, deal] of entries) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "tclk-notification-item";

    const itemTitle = document.createElement("strong");
    itemTitle.textContent = notificationTitle(deal);

    const meta = document.createElement("span");
    meta.textContent = deal.amount && deal.asset ? `${deal.amount} ${deal.asset}` : copy("Deal update", "Anlaşma güncellemesi");

    item.append(itemTitle, meta);
    item.addEventListener("click", () => void openDeal(deal, key, null));
    panel.appendChild(item);

    void profileLabel(notificationActorDid(deal)).then((actor) => {
      if (!item.isConnected) return;
      meta.textContent = deal.amount && deal.asset
        ? `${actor} · ${deal.amount} ${deal.asset}`
        : actor;
    });
  }
}

async function showToast(deal, key) {
  if (announced.has(key)) return;
  announced.add(key);

  document.querySelector(".tclk-accept-toast")?.remove();
  const actor = await profileLabel(notificationActorDid(deal));

  const toast = document.createElement("section");
  toast.className = "tclk-accept-toast";
  toast.setAttribute("role", "status");

  const icon = document.createElement("span");
  icon.className = "tclk-accept-toast-icon";
  icon.appendChild(bellSvg());

  const content = document.createElement("div");
  content.className = "tclk-accept-toast-content";

  const head = document.createElement("div");
  head.className = "tclk-accept-toast-head";

  const copyWrap = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = notificationTitle(deal);
  const body = document.createElement("p");
  body.textContent = notificationBody(deal, actor);
  copyWrap.append(title, body);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "tclk-accept-toast-close";
  close.setAttribute("aria-label", copy("Close notification", "Bildirimi kapat"));
  close.textContent = "×";
  close.addEventListener("click", () => {
    markSeen([key]);
    dismissToast(toast);
  });
  head.append(copyWrap, close);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "tclk-accept-toast-action";
  action.textContent = copy("Open deal", "Anlaşmayı aç");
  action.addEventListener("click", () => void openDeal(deal, key, toast));

  content.append(head, action);
  toast.append(icon, content);
  document.body.appendChild(toast);
}

async function poll() {
  if (polling || document.hidden) return;
  ensureBell();

  const did = currentIdentityDid();
  if (!did) {
    activeDid = "";
    pending.clear();
    announced.clear();
    updateBell();
    return;
  }

  if (did !== activeDid) {
    activeDid = did;
    pending.clear();
    announced.clear();
  }

  polling = true;
  try {
    const previousKeys = new Set(pending.keys());
    const deals = await fetchNotifications(did);
    let closureEvents = [];
    try {
      closureEvents = await fetchClosureEvents(did);
    } catch {
      // Closure events are additive. Failure here must never suppress the
      // already-working accepted/locked/completed notifications.
    }
    const state = loadState(did);

    // First successful sync establishes one durable baseline for this DID.
    // Adding a new notification type later must not reset the whole baseline.
    if (!state.initialized) {
      state.initialized = true;
      state.knownKinds = [...SUPPORTED_KINDS];
      state.seen.push(...deals.map(eventKey));
      saveState(did, state);
      pending.clear();
      announced.clear();
      updateBell();
      return;
    }

    // A newly introduced notification kind gets its own one-time baseline.
    // Existing kinds keep their read/unread history untouched.
    const knownKinds = new Set(state.knownKinds ?? []);
    const newKinds = SUPPORTED_KINDS.filter((kind) => !knownKinds.has(kind));
    if (newKinds.length) {
      state.seen.push(...deals.filter((deal) => newKinds.includes(deal.notificationKind)).map(eventKey));
      state.knownKinds = [...knownKinds, ...newKinds];
      saveState(did, state);
    }

    const seen = new Set(state.seen);
    const allNotifications = [...deals, ...closureEvents];
    pending = new Map(
      allNotifications
        .filter((deal) => !seen.has(eventKey(deal)))
        .map((deal) => [eventKey(deal), deal]),
    );

    const newEntries = [...pending.entries()].filter(([key]) => !previousKeys.has(key));
    updateBell();

    if (newEntries.length) ringBell();

    const newest = newEntries
      .sort((a, b) => Date.parse(b[1].updatedAt ?? "0") - Date.parse(a[1].updatedAt ?? "0"))[0]
      ?? [...pending.entries()]
        .filter(([key]) => !announced.has(key))
        .sort((a, b) => Date.parse(b[1].updatedAt ?? "0") - Date.parse(a[1].updatedAt ?? "0"))[0];

    if (newest) await showToast(newest[1], newest[0]);
  } catch {
    // Notifications are non-blocking. TCLK itself must remain usable if this poll fails.
  } finally {
    polling = false;
  }
}

function bindUiEvents() {
  if (uiEventsBound) return;
  uiEventsBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".tclk-notification-center")) return;
    const panel = document.querySelector(".tclk-notification-panel");
    if (panel) panel.hidden = true;
    document.querySelector(".tclk-notification-bell")?.setAttribute("aria-expanded", "false");
  });

  document.documentElement.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".lang-button")) return;
    queueMicrotask(() => {
      const oldCenter = document.querySelector(".tclk-notification-center");
      if (oldCenter && !oldCenter.closest(".product-brand")) oldCenter.remove();
      ensureBell();
      updateBell();
    });
  });
}

function boot() {
  loadStyle();
  bindUiEvents();
  ensureBell();
  updateBell();
  void poll();

  intervalId = window.setInterval(() => void poll(), POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void poll();
  });

  const didNode = document.getElementById("did");
  if (didNode) {
    const observer = new MutationObserver(() => void poll());
    observer.observe(didNode, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener("beforeunload", () => {
    if (intervalId !== null) window.clearInterval(intervalId);
  }, { once: true });
}

if (typeof document !== "undefined") boot();
