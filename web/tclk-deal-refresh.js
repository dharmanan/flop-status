const API_BASE = "https://flop-status-production.up.railway.app";
const AUTO_REFRESH_MS = 15_000;
const WAIT_STEP_MS = 250;
const WAIT_LIMIT_MS = 30_000;
const PENDING_STATES = new Set(["proposed", "accepted", "locked"]);

let refreshBusy = false;
let lastAutoCheckAt = 0;
let lastCheckedContract = "";
let lastCheckedAt = 0;

const tr = () => document.documentElement.lang === "tr";
const copy = (en, trText) => tr() ? trText : en;

function loadStyle() {
  if (document.getElementById("flop-tclk-deal-refresh-style")) return;
  const style = document.createElement("style");
  style.id = "flop-tclk-deal-refresh-style";
  style.textContent = `
    .tclk-detail-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .tclk-detail-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tclk-detail-toolbar .tclk-back { margin: 0; }
    .tclk-detail-refresh-status {
      color: #8fa09c;
      font-size: 12px;
      line-height: 1.4;
    }
    .tclk-detail-refresh-status[data-state="working"] { color: #aab9b5; }
    .tclk-detail-refresh-status[data-state="success"] { color: #55d99c; }
    .tclk-detail-refresh-status[data-state="error"] { color: #e8a08d; }
  `;
  document.head.appendChild(style);
}

function visibleWorkspace() {
  const workspace = document.querySelector(".tclk-workspace:not([hidden])");
  return workspace instanceof HTMLElement ? workspace : null;
}

function currentDealContext() {
  const workspace = visibleWorkspace();
  if (!workspace) return null;
  const contract = workspace.querySelector(".proof-contract-slot")?.textContent?.trim() ?? "";
  const stateNode = workspace.querySelector(".tclk-proof-state");
  const protocolState = stateNode?.dataset.protocolState?.trim().toLowerCase() ?? "";
  const did = document.getElementById("did")?.textContent?.trim() ?? "";
  if (!/^0x[0-9a-f]{64}$/.test(contract) || !did.startsWith("did:key:") || !protocolState) return null;
  return { workspace, contract, protocolState, did };
}

function timeLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString(tr() ? "tr-TR" : undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusNode(workspace) {
  return workspace.querySelector(".tclk-detail-refresh-status");
}

function setToolbarStatus(workspace, text, state = "idle") {
  const target = statusNode(workspace);
  if (!target) return;
  target.textContent = text;
  target.dataset.state = state;
}

function defaultToolbarStatus(contract, protocolState) {
  if (lastCheckedContract === contract && lastCheckedAt) {
    return PENDING_STATES.has(protocolState)
      ? copy(`Last check: ${timeLabel(lastCheckedAt)} · auto refresh every 15s`, `Son kontrol: ${timeLabel(lastCheckedAt)} · 15 sn'de bir otomatik yenileniyor`)
      : copy(`Last check: ${timeLabel(lastCheckedAt)}`, `Son kontrol: ${timeLabel(lastCheckedAt)}`);
  }
  return PENDING_STATES.has(protocolState)
    ? copy("Auto refresh is on · every 15s", "Otomatik yenileme açık · 15 sn")
    : copy("Refresh this deal without reloading the page", "Sayfayı yenilemeden bu anlaşmanın durumunu kontrol et");
}

function syncToolbar() {
  const context = currentDealContext();
  if (!context) return;
  const { workspace, contract, protocolState } = context;
  const main = workspace.querySelector(".tclk-main");
  const back = main?.querySelector(":scope > .tclk-back");
  if (!(main instanceof HTMLElement) || !(back instanceof HTMLButtonElement)) return;
  if (main.querySelector(":scope > .tclk-detail-toolbar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "tclk-detail-toolbar";
  const actions = document.createElement("div");
  actions.className = "tclk-detail-toolbar-actions";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "tclk-secondary tclk-detail-refresh-button";
  refresh.textContent = copy("↻ Refresh status", "↻ Durumu yenile");
  const status = document.createElement("span");
  status.className = "tclk-detail-refresh-status";
  status.textContent = defaultToolbarStatus(contract, protocolState);
  status.dataset.state = "idle";

  toolbar.append(actions, status);
  main.insertBefore(toolbar, back);
  actions.append(back, refresh);
  refresh.addEventListener("click", () => void refreshCurrentDeal({ automatic: false }));
}

async function fetchHistory(did) {
  const response = await fetch(`${API_BASE}/api/v1/tclk/history?did=${encodeURIComponent(did)}`, {
    headers: { accept: "application/json" },
  });
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const detail = body?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(String(detail));
  }
  return Array.isArray(body?.deals) ? body.deals : [];
}

function findSummary(deals, contract) {
  return deals.find((deal) => deal?.contractId === contract || deal?.offerId === contract) ?? null;
}

// The only safe way to relocate a card after a refresh: its exact, immutable
// protocol identity. offerId never changes across a deal's lifecycle, so it is
// the one attribute guaranteed present at every state (tclk-deals.js sets it on
// every card). Once a deal has been accepted, contractId exists too and must
// also match — an offerId hit alone is not enough once there is a contract to
// check, otherwise a card whose board data has not yet caught up with acceptance
// could be treated as the same deal it merely used to be. Title, amount, and
// payer are display text — two distinct deals can share all three, so none of
// them may ever decide which card gets clicked. Kept as a pure filter over
// card-like objects (not a raw CSS selector) so this identity rule is directly
// unit-testable without a browser.
export function matchCardByProtocolId(cards, { offerId, contractId }) {
  const matches = cards.filter((card) => {
    if (card?.dataset?.offerId !== offerId) return false;
    if (contractId) return card?.dataset?.contractId === contractId;
    return true;
  });
  return matches.length === 1 ? matches[0] : null;
}

function findExactCard(summary) {
  if (!/^0x[0-9a-f]{64}$/.test(summary?.offerId ?? "")) return null;
  const cards = [...document.querySelectorAll(".tclk-workspace:not([hidden]) .tclk-deal-card")];
  return matchCardByProtocolId(cards, { offerId: summary.offerId, contractId: summary.contractId || null });
}

async function waitFor(predicate, timeoutMs = WAIT_LIMIT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  }
  return null;
}

async function reopenFromMine(summary, contract) {
  const workspace = visibleWorkspace();
  const mine = workspace?.querySelector('.tclk-tabs button[data-tab="mine"]');
  if (!(mine instanceof HTMLButtonElement)) throw new Error(copy("My deals tab was not found.", "Anlaşmalarım sekmesi bulunamadı."));

  mine.click();
  const card = await waitFor(() => findExactCard(summary));
  if (!(card instanceof HTMLElement)) {
    // Fail closed: no exact-id card means no click. Never fall back to matching
    // by title, amount, or payer.
    throw new Error(copy(
      "The exact agreement could not be located by its protocol id after refresh.",
      "Yenilemeden sonra anlaşma kesin protokol kimliğiyle listede bulunamadı.",
    ));
  }

  const open = card.querySelector(".tclk-card-actions button");
  if (!(open instanceof HTMLButtonElement)) throw new Error(copy("The agreement could not be reopened.", "Anlaşma yeniden açılamadı."));
  open.click();

  const reopened = await waitFor(() => {
    const current = document.querySelector(".tclk-workspace:not([hidden]) .proof-contract-slot")?.textContent?.trim() ?? "";
    return current === contract ? true : null;
  });
  if (!reopened) throw new Error(copy("The refreshed agreement did not reopen in time.", "Yenilenen anlaşma zamanında yeniden açılamadı."));
}

async function refreshCurrentDeal({ automatic }) {
  if (refreshBusy) return;
  const context = currentDealContext();
  if (!context) return;
  const { workspace, contract, protocolState, did } = context;
  refreshBusy = true;
  try {
    if (!automatic) setToolbarStatus(workspace, copy("Checking signed TCLK records…", "İmzalı TCLK kayıtları kontrol ediliyor…"), "working");
    const deals = await fetchHistory(did);
    const summary = findSummary(deals, contract);
    if (!summary) throw new Error(copy("This agreement is not yet available in durable history.", "Bu anlaşma henüz kalıcı anlaşma geçmişinde bulunamadı."));

    lastCheckedContract = contract;
    lastCheckedAt = Date.now();
    const nextState = String(summary.status ?? "").toLowerCase();

    if (automatic && nextState === protocolState) {
      setToolbarStatus(workspace, defaultToolbarStatus(contract, protocolState), "idle");
      return;
    }

    if (automatic) {
      setToolbarStatus(workspace, copy("A new signed state was found. Updating…", "Yeni imzalı durum bulundu. Ekran güncelleniyor…"), "success");
    } else {
      setToolbarStatus(workspace, copy("Refreshing this agreement…", "Anlaşma yeniden okunuyor…"), "working");
    }
    await reopenFromMine(summary, contract);
    const updated = currentDealContext();
    if (updated) {
      setToolbarStatus(updated.workspace, defaultToolbarStatus(contract, updated.protocolState), "success");
    }
  } catch (error) {
    const current = currentDealContext();
    const message = error instanceof Error ? error.message : String(error);
    if (current?.contract === contract) {
      setToolbarStatus(current.workspace, `${copy("Refresh failed", "Yenileme başarısız")}: ${message}`, "error");
    }
  } finally {
    refreshBusy = false;
  }
}

async function maybeAutoRefresh() {
  if (refreshBusy || document.hidden) return;
  const context = currentDealContext();
  if (!context || !PENDING_STATES.has(context.protocolState)) return;
  if (Date.now() - lastAutoCheckAt < AUTO_REFRESH_MS) return;
  const disabledAction = context.workspace.querySelector(".tclk-actions-panel button:disabled");
  if (disabledAction) return;
  lastAutoCheckAt = Date.now();
  await refreshCurrentDeal({ automatic: true });
}

function boot() {
  loadStyle();
  const observer = new MutationObserver(() => syncToolbar());
  observer.observe(document.body, { childList: true, subtree: true });
  syncToolbar();
  setInterval(() => {
    syncToolbar();
    void maybeAutoRefresh();
  }, 1000);
}

if (typeof document !== "undefined") boot();
