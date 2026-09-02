import { evaluateFrameTrust, verifyTransport } from "/tclk-transport.js";

void import("/capability-names.js?v=capability-names-v4");
void import("/agent-identicon.js?v=agent-identicon-v1");
void import("/workspace-return-guard.js?v=workspace-return-v1");
void import("/settings-copy.js?v=settings-copy-v1");
void import("/tclk-history-ui.js?v=tclk-history-v1");
void import("/c1-practice-positive.js?v=c1-practice-v1").then(() => import("/practice-ui.js?v=practice-ui-v3"));

const API_BASE = "https://flop-status-production.up.railway.app";
const PENDING_CLOSURE_KEY = "flop-tclk-pending-closure";
let closureTimer = null;
let closureSyncBusy = false;

const tr = () => document.documentElement.lang === "tr";
const copy = (en, trText) => tr() ? trText : en;

function loadPracticeFeedbackStyle() {
  if (document.getElementById("flop-capability-use-feedback-style")) return;
  const link = document.createElement("link");
  link.id = "flop-capability-use-feedback-style";
  link.rel = "stylesheet";
  link.href = "/capability-use-feedback.css?v=practice-feedback-v1";
  document.head.appendChild(link);
}

function loadClosureStyle() {
  if (document.getElementById("flop-tclk-closure-style")) return;
  const style = document.createElement("style");
  style.id = "flop-tclk-closure-style";
  style.textContent = `
    .tclk-closure-status {
      border: 1px solid rgba(111, 147, 136, .22);
      background: rgba(15, 25, 28, .72);
      border-radius: 14px;
      padding: 16px;
      display: grid;
      gap: 10px;
    }
    .tclk-closure-status h3 { margin: 0; font-size: 14px; }
    .tclk-closure-summary { margin: 0; color: #9fb1ad; font-size: 12px; }
    .tclk-closure-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-top: 9px;
      border-top: 1px solid rgba(255,255,255,.06);
      font-size: 12px;
    }
    .tclk-closure-row strong { color: #d9e5e1; font-weight: 650; }
    .tclk-closure-row span[data-signed="true"] { color: #55d99c; }
    .tclk-closure-row span[data-signed="false"] { color: #9da9a6; }
    .tclk-closure-own-status {
      margin: 4px 0 0;
      color: #55d99c;
      font-size: 12px;
      font-weight: 650;
    }
  `;
  document.head.appendChild(style);
}

loadPracticeFeedbackStyle();
loadClosureStyle();

function syncDealProtocolMetadata() {
  const head = document.querySelector(".tclk-workspace .tclk-head");
  const badges = head?.querySelector(".tclk-protocol-badges");
  const kicker = head?.querySelector(".tclk-kicker");
  if (!head || !badges || !kicker) return false;

  kicker.textContent = copy("FLOP LABS PROTOCOL", "FLOP LABS PROTOKOLÜ");
  badges.replaceChildren();
  const protocol = document.createElement("span");
  protocol.textContent = "TCLK 1";
  const rail = document.createElement("span");
  rail.textContent = "PAPERRAIL";
  const alpha = document.createElement("span");
  alpha.className = "alpha";
  alpha.textContent = "ALPHA";
  const lock = document.createElement("span");
  lock.className = "tclk-lock-badge";
  lock.textContent = copy("HASH LOCK", "HASH KİLİDİ");
  badges.append(protocol, rail, alpha, lock);
  return true;
}

function dealRoom(contract) {
  if (!/^0x[0-9a-f]{64}$/.test(contract)) return null;
  return `mb-p-tclk-${contract.slice(2, 18)}`;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}

async function tool(name, args) {
  const body = await api(`/api/v1/tclk/tools/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  return body.result;
}

async function trustedClosureReceipts(contract) {
  const room = dealRoom(contract);
  if (!room) return [];
  const raw = (await api(`/api/v1/tclk/rooms/${encodeURIComponent(room)}`)).room;
  const rawMessages = raw?.messages ?? [];
  if (!rawMessages.length) return [];
  const parsed = await tool("tclk_read_room", { room });
  const rawBySeq = new Map(rawMessages.map((message) => [message.seq, message]));
  const receipts = [];

  for (const item of parsed?.frames ?? []) {
    if (item.frame?.type !== "receipt" || item.frame?.contract !== contract) continue;
    const message = rawBySeq.get(item.seq);
    if (!message || typeof message.text !== "string") continue;
    const transportValid = await verifyTransport(room, message);
    const { trusted } = evaluateFrameTrust(item, message, transportValid);
    if (!trusted) continue;
    receipts.push({ ...item.frame, seq: item.seq });
  }

  return receipts;
}

function activeDid() {
  return document.getElementById("did")?.textContent?.trim() ?? "";
}

function detailParty(selector) {
  const value = document.querySelector(`${selector} > span:last-child`);
  return {
    did: value?.title?.trim() ?? "",
    label: value?.textContent?.trim() ?? "—",
  };
}

function closureButton() {
  return [...document.querySelectorAll(".tclk-actions-panel .tclk-action-button")].find((button) => {
    const text = button.textContent?.trim() ?? "";
    return /Publish terminal receipt|Terminal receipt yayınla|Sign closure record|Kapanış kaydını imzala/i.test(text);
  }) ?? null;
}

function renameClosureButton() {
  const button = closureButton();
  if (!button) return;
  button.textContent = copy("Sign closure record", "Kapanış kaydını imzala");
}

function renderClosureStatus(contract, receipts) {
  const proof = document.querySelector(".tclk-proof");
  const actions = document.querySelector(".tclk-actions-panel");
  const stateElement = proof?.querySelector(".tclk-proof-state");
  const state = stateElement?.dataset.protocolState?.trim().toLowerCase() || stateElement?.textContent?.trim().toLowerCase() || "";
  if (!proof || !actions || !["claimed", "refunded", "cancelled"].includes(state)) return;

  const payer = detailParty(".payer-slot");
  const payee = detailParty(".payee-slot");
  const signedBy = new Set(receipts.map((receipt) => receipt.from).filter(Boolean));
  const parties = [
    { role: copy("PAYER", "ÖDEYEN"), ...payer },
    { role: copy("PAYEE", "ÖDEMEYİ ALAN"), ...payee },
  ];
  const signedCount = parties.filter((party) => party.did && signedBy.has(party.did)).length;

  let section = document.querySelector(".tclk-closure-status");
  if (!section) {
    section = document.createElement("section");
    section.className = "tclk-closure-status";
    actions.parentElement?.insertBefore(section, actions);
  }
  section.replaceChildren();

  const title = document.createElement("h3");
  title.textContent = copy("Closure records", "Kapanış kayıtları");
  const summary = document.createElement("p");
  summary.className = "tclk-closure-summary";
  summary.textContent = copy(
    `${signedCount} / 2 closure records signed`,
    `${signedCount} / 2 kapanış kaydı imzalandı`,
  );
  section.append(title, summary);

  for (const party of parties) {
    const row = document.createElement("div");
    row.className = "tclk-closure-row";
    const who = document.createElement("strong");
    who.textContent = `${party.role} · ${party.label}`;
    const status = document.createElement("span");
    const signed = Boolean(party.did && signedBy.has(party.did));
    status.dataset.signed = signed ? "true" : "false";
    status.textContent = signed ? copy("SIGNED ✓", "İMZALANDI ✓") : copy("PENDING", "BEKLİYOR");
    row.append(who, status);
    section.appendChild(row);
  }

  const me = activeDid();
  const ownSigned = Boolean(me && signedBy.has(me));
  const button = closureButton();
  if (ownSigned && button) button.hidden = true;

  const existing = actions.querySelector(".tclk-closure-own-status");
  if (existing) existing.remove();
  if (ownSigned) {
    const note = document.createElement("p");
    note.className = "tclk-closure-own-status";
    note.textContent = copy("✓ Your closure record is signed and published.", "✓ Kapanış kaydın imzalandı ve yayınlandı.");
    actions.appendChild(note);
  } else if (button) {
    button.hidden = false;
    button.textContent = copy("Sign closure record", "Kapanış kaydını imzala");
  }

  section.dataset.contract = contract;
}

async function syncClosureUi() {
  if (closureSyncBusy) return;
  const contract = document.querySelector(".proof-contract-slot")?.textContent?.trim() ?? "";
  renameClosureButton();
  if (!/^0x[0-9a-f]{64}$/.test(contract)) return;

  closureSyncBusy = true;
  try {
    const receipts = await trustedClosureReceipts(contract);
    renderClosureStatus(contract, receipts);
  } catch {
    renameClosureButton();
  } finally {
    closureSyncBusy = false;
  }
}

async function confirmPendingClosure() {
  const raw = sessionStorage.getItem(PENDING_CLOSURE_KEY);
  if (!raw) return;
  let pending = null;
  try { pending = JSON.parse(raw); } catch { sessionStorage.removeItem(PENDING_CLOSURE_KEY); return; }
  if (!pending?.contract || !pending?.did) return;

  try {
    const receipts = await trustedClosureReceipts(pending.contract);
    if (!receipts.some((receipt) => receipt.from === pending.did)) return;
    sessionStorage.removeItem(PENDING_CLOSURE_KEY);
    const status = document.querySelector(".tclk-status");
    if (status) {
      status.textContent = copy("Closure record signed and published.", "Kapanış kaydın imzalandı ve yayınlandı.");
      status.dataset.state = "success";
    }
  } catch {}
}

function scheduleClosureSync(delay = 100) {
  clearTimeout(closureTimer);
  closureTimer = setTimeout(() => {
    syncDealProtocolMetadata();
    void syncClosureUi();
    void confirmPendingClosure();
  }, delay);
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest(".tclk-action-button") : null;
  if (!target) return;
  const text = target.textContent?.trim() ?? "";
  if (!/Publish terminal receipt|Terminal receipt yayınla|Sign closure record|Kapanış kaydını imzala/i.test(text)) return;

  const contract = document.querySelector(".proof-contract-slot")?.textContent?.trim() ?? "";
  const did = activeDid();
  if (/^0x[0-9a-f]{64}$/.test(contract) && did) {
    sessionStorage.setItem(PENDING_CLOSURE_KEY, JSON.stringify({ contract, did, at: Date.now() }));
    setTimeout(() => void confirmPendingClosure(), 600);
    setTimeout(() => void confirmPendingClosure(), 1400);
    setTimeout(() => void confirmPendingClosure(), 2800);
  }
}, true);

const observer = new MutationObserver(() => scheduleClosureSync());
observer.observe(document.body, { childList: true, subtree: true });
scheduleClosureSync(0);
