const API_BASE = "https://flop-status-production.up.railway.app";
const STORAGE_PREFIX = "flop-tclk-accept-notifications-v3:";
const POLL_MS = 10_000;

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

function eventKey(deal) {
  return [deal.venue, deal.offerId, deal.contractId, deal.payeeDid].map((value) => String(value ?? "")).join("|");
}

function storageKey(did) {
  return STORAGE_PREFIX + did;
}

function loadState(did) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(did)) ?? "null");
    if (!parsed || parsed.version !== 3 || !Array.isArray(parsed.seen)) return { version: 3, seen: [] };
    return { version: 3, seen: parsed.seen.filter((value) => typeof value === "string") };
  } catch {
    return { version: 3, seen: [] };
  }
}

function saveState(did, state) {
  localStorage.setItem(storageKey(did), JSON.stringify({
    version: 3,
    seen: Array.from(new Set(state.seen)).slice(-500),
  }));
}

function currentIdentityDid() {
  const did = document.getElementById("did")?.textContent?.trim() ?? "";
  return did.startsWith("did:key:") ? did : "";
}

function acceptedForOfferOwner(deal, did) {
  return deal
    && deal.payerDid === did
    && deal.payeeDid !== did
    && typeof deal.payeeDid === "string"
    && deal.payeeDid.startsWith("did:key:")
    && typeof deal.contractId === "string"
    && deal.contractId.startsWith("0x")
    && deal.status !== "proposed";
}

async function fetchAccepted(did) {
  const response = await fetch(`${API_BASE}/api/v1/tclk/history?did=${encodeURIComponent(did)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return [];
  const body = await response.json();
  const deals = Array.isArray(body?.deals) ? body.deals : [];
  return deals.filter((deal) => acceptedForOfferOwner(deal, did));
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
  const start = Date.now();
  const findCard = () => {
    const cards = Array.from(document.querySelectorAll(".tclk-workspace .tclk-deal-card"));
    return cards.find((card) => card.dataset.offerId === offerId) ?? null;
  };

  let card = findCard();
  while (!card && Date.now() - start < 6000) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    card = findCard();
  }
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.querySelector(".tclk-card-actions button")?.click();
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
    itemTitle.textContent = copy("Your offer was accepted", "Teklifin kabul edildi");

    const meta = document.createElement("span");
    meta.textContent = deal.amount && deal.asset ? `${deal.amount} ${deal.asset}` : copy("Deal update", "Anlaşma güncellemesi");

    item.append(itemTitle, meta);
    item.addEventListener("click", () => void openDeal(deal, key, null));
    panel.appendChild(item);

    void profileLabel(deal.payeeDid).then((actor) => {
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
  const actor = await profileLabel(deal.payeeDid);

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
  title.textContent = copy("Your offer was accepted", "Teklifin kabul edildi");
  const body = document.createElement("p");
  body.textContent = copy(
    `${actor} accepted your offer.`,
    `${actor} teklifini kabul etti.`,
  );
  copyWrap.append(title, body);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "tclk-accept-toast-close";
  close.setAttribute("aria-label", copy("Close notification", "Bildirimi kapat"));
  close.textContent = "×";
  close.addEventListener("click", () => dismissToast(toast));
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
    const deals = await fetchAccepted(did);
    const state = loadState(did);
    const seen = new Set(state.seen);
    pending = new Map(
      deals
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
