const API_BASE = "https://flop-status-production.up.railway.app";
const STORAGE_PREFIX = "flop-tclk-accept-notifications-v2:";
const POLL_MS = 10_000;

let activeDid = "";
let polling = false;
let intervalId = null;
let pending = new Map();
let announced = new Set();

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
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.seen)) return { version: 2, seen: [] };
    return { version: 2, seen: parsed.seen.filter((value) => typeof value === "string") };
  } catch {
    return { version: 2, seen: [] };
  }
}

function saveState(did, state) {
  localStorage.setItem(storageKey(did), JSON.stringify({
    version: 2,
    seen: Array.from(new Set(state.seen)).slice(-500),
  }));
}

function currentIdentityDid() {
  const did = document.getElementById("did")?.textContent?.trim() ?? "";
  return did.startsWith("did:key:") ? did : "";
}

function acceptedForPayer(deal, did) {
  return deal
    && deal.payerDid === did
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
  return deals.filter((deal) => acceptedForPayer(deal, did));
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

function ensureStyle() {
  if (document.getElementById("flop-tclk-notification-style")) return;
  const style = document.createElement("style");
  style.id = "flop-tclk-notification-style";
  style.textContent = `
    .tclk-entry { position: relative; }
    .tclk-notification-badge {
      position: absolute;
      top: 8px;
      right: 9px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      display: grid;
      place-items: center;
      border: 1px solid #5f88ff;
      border-radius: 999px;
      background: #173c9b;
      color: #fff;
      font-size: 10px;
      font-weight: 750;
      line-height: 1;
    }
    .tclk-accept-toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 1200;
      width: min(360px, calc(100vw - 32px));
      padding: 16px;
      border: 1px solid #2c3d4d;
      border-radius: 12px;
      background: #0b1116;
      color: #e6edf3;
      box-shadow: 0 18px 48px rgba(0,0,0,.4);
    }
    .tclk-accept-toast-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .tclk-accept-toast strong {
      display: block;
      font-size: 14px;
      line-height: 1.25;
    }
    .tclk-accept-toast p {
      margin: 7px 0 0;
      color: #93a1ad;
      font-size: 12px;
      line-height: 1.45;
    }
    .tclk-accept-toast-close {
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: #73808b;
      font-size: 18px;
      line-height: 1;
    }
    .tclk-accept-toast-action {
      margin-top: 13px;
      min-height: 38px;
      padding: 9px 13px;
      border: 1px solid #3b4b59;
      border-radius: 8px;
      background: #eef2f5;
      color: #11161a;
      font-size: 12px;
      font-weight: 700;
    }
    @media (max-width: 640px) {
      .tclk-accept-toast { right: 16px; bottom: 16px; }
    }
  `;
  document.head.appendChild(style);
}

function updateBadge() {
  const entry = document.querySelector(".tclk-entry");
  if (!entry) return;
  let badge = entry.querySelector(".tclk-notification-badge");
  if (!pending.size) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "tclk-notification-badge";
    badge.setAttribute("aria-label", copy("Unread deal notifications", "Okunmamış anlaşma bildirimleri"));
    entry.appendChild(badge);
  }
  badge.textContent = pending.size > 9 ? "9+" : String(pending.size);
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
  updateBadge();
}

function dismissToast(toast) {
  if (toast?.isConnected) toast.remove();
}

async function openDeal(deal, key, toast) {
  markSeen([key]);
  dismissToast(toast);

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

async function showToast(deal, key) {
  if (announced.has(key)) return;
  announced.add(key);
  ensureStyle();

  document.querySelector(".tclk-accept-toast")?.remove();
  const actor = await profileLabel(deal.payeeDid);

  const toast = document.createElement("section");
  toast.className = "tclk-accept-toast";
  toast.setAttribute("role", "status");

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

  toast.append(head, action);
  document.body.appendChild(toast);
}

async function poll() {
  if (polling || document.hidden) return;
  const did = currentIdentityDid();
  if (!did) {
    activeDid = "";
    pending.clear();
    announced.clear();
    updateBadge();
    return;
  }

  if (did !== activeDid) {
    activeDid = did;
    pending.clear();
    announced.clear();
  }

  polling = true;
  try {
    const deals = await fetchAccepted(did);
    const state = loadState(did);
    const seen = new Set(state.seen);
    pending = new Map(
      deals
        .filter((deal) => !seen.has(eventKey(deal)))
        .map((deal) => [eventKey(deal), deal]),
    );
    updateBadge();

    const newest = [...pending.entries()]
      .sort((a, b) => Date.parse(b[1].updatedAt ?? "0") - Date.parse(a[1].updatedAt ?? "0"))[0];
    if (newest) await showToast(newest[1], newest[0]);
  } catch {
    // Notifications are non-blocking. TCLK itself must remain usable if this poll fails.
  } finally {
    polling = false;
  }
}

function bindEntryRead() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(".tclk-entry") || !pending.size) return;
    markSeen([...pending.keys()]);
    document.querySelector(".tclk-accept-toast")?.remove();
  });
}

function boot() {
  ensureStyle();
  bindEntryRead();
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
