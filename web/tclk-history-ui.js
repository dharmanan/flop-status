const API_BASE = "https://flop-status-production.up.railway.app";
const ACTIVE = new Set(["proposed", "accepted", "locked"]);
const TERMINAL = new Set(["claimed", "refunded", "cancelled"]);
const POLL_MS = 1500;
let syncing = false;

window.__FLOP_TCLK_HISTORY_UI__ = "v3";

const tr = () => document.documentElement.lang === "tr";
const copy = (en, trText) => tr() ? trText : en;

function stateLabel(status) {
  const value = String(status ?? "").toLowerCase();
  const labels = {
    proposed: copy("OPEN OFFER", "TEKLİF AÇIK"),
    accepted: copy("ACCEPTED", "KABUL EDİLDİ"),
    locked: copy("LOCKED", "KİLİTLENDİ"),
    claimed: copy("COMPLETED", "TAMAMLANDI"),
    refunded: copy("REFUNDED", "GERİ ALINDI"),
    cancelled: copy("CANCELLED", "İPTAL EDİLDİ"),
  };
  return labels[value] ?? value.toUpperCase();
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function activeWorkspace() {
  const workspace = document.querySelector(".tclk-workspace");
  if (!workspace || workspace.hidden) return null;
  const mine = workspace.querySelector('.tclk-tabs button[data-tab="mine"]');
  if (!mine?.classList.contains("active")) return null;
  const main = workspace.querySelector(".tclk-main");
  if (!main) return null;
  return { workspace, main };
}

function activeDid() {
  const primary = document.getElementById("did")?.textContent?.trim() ?? "";
  if (primary.startsWith("did:key:")) return primary;

  const sidebar = document.querySelector(".shell-did");
  const fromTitle = sidebar?.getAttribute("title")?.trim() ?? "";
  if (fromTitle.startsWith("did:key:")) return fromTitle;

  const fromText = sidebar?.textContent?.trim() ?? "";
  return fromText.startsWith("did:key:") && !fromText.includes("…") ? fromText : "";
}

async function api(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body?.error?.message ?? `HTTP_${response.status}`);
  return body;
}

async function profileLabel(did) {
  if (!did) return "—";
  try {
    const profile = await window.FLOPAgentProfiles?.profileForDid?.(did);
    return profile ? `${profile.displayName} · @${profile.handle}` : did;
  } catch { return did; }
}

function ensureStyle() {
  if (document.getElementById("flop-tclk-history-v3-style")) return;
  const style = document.createElement("style");
  style.id = "flop-tclk-history-v3-style";
  style.textContent = `
    .tclk-archive-list { display:grid; gap:12px; margin-top:12px; }
    .tclk-archive-heading { margin:22px 0 8px; display:grid; gap:4px; }
    .tclk-archive-heading h3 { margin:0; font-size:14px; }
    .tclk-archive-heading p { margin:0; color:#84928f; font-size:11px; }
    .tclk-archive-card { border:1px solid rgba(121,149,159,.24); background:rgba(11,18,21,.7); border-radius:12px; padding:16px; display:grid; gap:12px; }
    .tclk-archive-top,.tclk-archive-bottom { display:flex; align-items:center; justify-content:space-between; gap:14px; }
    .tclk-archive-title { font-size:13px; font-weight:700; }
    .tclk-archive-state { border:1px solid rgba(90,136,255,.65); color:#9bb7ff; border-radius:999px; padding:4px 9px; font:700 10px/1 ui-monospace,monospace; }
    .tclk-archive-state[data-state="proposed"] { border-color:rgba(181,143,69,.7); color:#d8b66c; }
    .tclk-archive-state[data-state="claimed"],.tclk-archive-state[data-state="refunded"],.tclk-archive-state[data-state="cancelled"] { border-color:rgba(61,158,103,.65); color:#72dfa2; }
    .tclk-archive-amount { font-size:24px; font-weight:760; letter-spacing:-.03em; }
    .tclk-archive-meta { color:#84928f; font-size:11px; overflow-wrap:anywhere; }
    .tclk-archive-detail { border:1px solid rgba(121,149,159,.24); border-radius:14px; padding:20px; display:grid; gap:18px; }
    .tclk-archive-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .tclk-archive-detail-grid > div { border:1px solid rgba(121,149,159,.18); border-radius:10px; padding:12px; display:grid; gap:5px; }
    .tclk-archive-detail-grid span { color:#748582; font:700 10px/1.2 ui-monospace,monospace; letter-spacing:.08em; }
    .tclk-archive-detail-grid strong { overflow-wrap:anywhere; }
    .tclk-archive-note { margin:0; color:#97a6a3; font-size:12px; line-height:1.55; }
    @media (max-width:760px) { .tclk-archive-detail-grid { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

function archiveState(status) {
  const el = node("span", "tclk-archive-state", stateLabel(status));
  el.dataset.state = String(status ?? "").toLowerCase();
  return el;
}

async function openArchiveDeal(deal) {
  const ctx = activeWorkspace();
  if (!ctx) return;
  const { main } = ctx;
  const payer = await profileLabel(deal.payerDid);
  const payee = await profileLabel(deal.payeeDid);

  main.replaceChildren();
  const back = node("button", "tclk-secondary tclk-back", `← ${copy("My deals", "Anlaşmalarım")}`);
  back.type = "button";
  back.addEventListener("click", () => document.querySelector('.tclk-tabs button[data-tab="mine"]')?.click());

  const detail = node("section", "tclk-archive-detail");
  const top = node("div", "tclk-archive-top");
  top.append(node("div", "tclk-archive-amount", `${deal.amount} ${deal.asset}`), archiveState(deal.status));

  const grid = node("div", "tclk-archive-detail-grid");
  const values = [
    [copy("AGREEMENT ID", "ANLAŞMA KİMLİĞİ"), deal.contractId ?? deal.offerId],
    [copy("PAYER", "ÖDEYEN"), payer],
    [copy("PAYEE", "ÖDEMEYİ ALAN"), payee],
    [copy("JOB", "İŞ"), deal.jobId ?? "—"],
    [copy("JOB NOTE", "İŞ NOTU"), deal.jobContext ?? "—"],
    [copy("LAST UPDATED", "SON GÜNCELLEME"), new Date(deal.updatedAt).toLocaleString()],
  ];
  for (const [label, value] of values) {
    const cell = node("div");
    cell.append(node("span", "", label), node("strong", "", value));
    grid.appendChild(cell);
  }

  const me = activeDid();
  let noteText = copy(
    "This record was recovered from FLOP's durable, transport-verified TCLK archive.",
    "Bu kayıt FLOP'un kalıcı ve taşıma imzası doğrulanmış TCLK arşivinden geri yüklendi.",
  );
  if (deal.status === "accepted") {
    noteText = me === deal.payerDid
      ? copy("The offer is accepted. Your next protocol step is to create the PaperRail lock.", "Teklif kabul edildi. Sıradaki protokol adımın PaperRail kilidini oluşturmak.")
      : copy("The offer is accepted. Waiting for the payer to create the PaperRail lock.", "Teklif kabul edildi. Ödeyen tarafın PaperRail kilidini oluşturması bekleniyor.");
  }
  detail.append(top, grid, node("p", "tclk-archive-note", noteText));
  main.append(back, detail);
}

function cardFor(deal) {
  const card = node("article", "tclk-archive-card");
  card.dataset.offerId = deal.offerId ?? "";

  const top = node("div", "tclk-archive-top");
  top.append(
    node("strong", "tclk-archive-title", deal.jobId ? `${copy("Job", "İş")} · ${deal.jobId}` : `${copy("Agreement", "Anlaşma")} · ${String(deal.offerId ?? "").slice(0, 12)}…`),
    archiveState(deal.status),
  );

  const amount = node("div", "tclk-archive-amount", `${deal.amount} ${deal.asset}`);
  const bottom = node("div", "tclk-archive-bottom");
  bottom.append(node("span", "tclk-archive-meta", new Date(deal.updatedAt).toLocaleString()));
  const open = node("button", "tclk-secondary", copy("Open record", "Kaydı aç"));
  open.type = "button";
  open.addEventListener("click", () => void openArchiveDeal(deal));
  bottom.appendChild(open);

  card.append(top, amount, bottom);
  return card;
}

function appendGroup(main, title, subtitle, deals) {
  if (!deals.length) return;
  const heading = node("div", "tclk-archive-heading");
  heading.append(node("h3", "", title), node("p", "", subtitle));
  const list = node("div", "tclk-archive-list");
  for (const deal of deals) list.appendChild(cardFor(deal));
  main.append(heading, list);
}

async function syncMine() {
  if (syncing) return;
  const ctx = activeWorkspace();
  if (!ctx) return;
  const did = activeDid();
  if (!did.startsWith("did:key:")) return;

  syncing = true;
  try {
    const body = await api(`/api/v1/tclk/history?did=${encodeURIComponent(did)}`);
    const deals = Array.isArray(body?.deals) ? body.deals : [];
    const { workspace, main } = ctx;

    main.querySelectorAll(".tclk-archive-heading,.tclk-archive-list").forEach((el) => el.remove());

    if (!deals.length) return;

    const liveText = [...main.querySelectorAll(".tclk-deal-card")].map((card) => card.textContent ?? "").join("\n");
    const active = deals.filter((deal) => ACTIVE.has(String(deal.status).toLowerCase()) && (!deal.jobId || !liveText.includes(deal.jobId)));
    const completed = deals.filter((deal) => TERMINAL.has(String(deal.status).toLowerCase()) && (!deal.jobId || !liveText.includes(deal.jobId)));

    if (active.length || completed.length) main.querySelector(".tclk-empty")?.remove();

    appendGroup(
      main,
      copy("Active agreements", "Aktif anlaşmalar"),
      copy("Recovered from the durable signed TCLK archive", "Kalıcı imzalı TCLK arşivinden geri yüklendi"),
      active,
    );
    appendGroup(
      main,
      copy("Completed history", "Tamamlanan anlaşmalar"),
      copy("Durable signed agreement archive", "Kalıcı imzalı anlaşma geçmişi"),
      completed,
    );

    const liveCount = main.querySelectorAll(".tclk-deal-card").length;
    const status = workspace.querySelector(".tclk-status");
    if (status) {
      status.textContent = copy(
        `${liveCount + active.length} active · ${completed.length} completed`,
        `${liveCount + active.length} aktif · ${completed.length} tamamlanmış`,
      );
      status.dataset.state = "success";
    }
  } catch (error) {
    const ctxNow = activeWorkspace();
    const status = ctxNow?.workspace.querySelector(".tclk-status");
    if (status) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = copy(`Archive error: ${message}`, `Arşiv hatası: ${message}`);
      status.dataset.state = "error";
    }
  } finally {
    syncing = false;
  }
}

ensureStyle();

setInterval(() => void syncMine(), POLL_MS);

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('.tclk-tabs button[data-tab="mine"], .tclk-list-head .tclk-secondary, .tclk-entry')) return;
  setTimeout(() => void syncMine(), 250);
  setTimeout(() => void syncMine(), 1200);
}, true);

setTimeout(() => void syncMine(), 500);
setTimeout(() => void syncMine(), 1800);
