const API_BASE = "https://flop-status-production.up.railway.app";
const TERMINAL = new Set(["claimed", "refunded", "cancelled"]);
let timer = null;
let busy = false;

const tr = () => document.documentElement.lang === "tr";
const copy = (en, trText) => tr() ? trText : en;

function stateLabel(status) {
  const value = String(status ?? "").toLowerCase();
  const labels = {
    claimed: copy("COMPLETED", "TAMAMLANDI"),
    refunded: copy("REFUNDED", "GERİ ALINDI"),
    cancelled: copy("CANCELLED", "İPTAL EDİLDİ"),
  };
  return labels[value] ?? value.toUpperCase();
}

function activeDid() {
  return document.getElementById("did")?.textContent?.trim() ?? "";
}

async function profileLabel(did) {
  if (!did) return "—";
  try {
    const profile = await window.FLOPAgentProfiles?.profileForDid?.(did);
    return profile ? `${profile.displayName} · @${profile.handle}` : did;
  } catch { return did; }
}

function loadStyle() {
  if (document.getElementById("flop-tclk-history-style")) return;
  const style = document.createElement("style");
  style.id = "flop-tclk-history-style";
  style.textContent = `
    .tclk-history-section { margin-top: 28px; display: grid; gap: 12px; }
    .tclk-history-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
    .tclk-history-head h2 { margin: 0; font-size: 16px; }
    .tclk-history-head p { margin: 0; color: #84928f; font-size: 12px; }
    .tclk-history-list { display: grid; gap: 12px; }
    .tclk-history-card {
      border: 1px solid rgba(121, 149, 159, .24);
      background: rgba(11, 18, 21, .7);
      border-radius: 12px;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .tclk-history-card-top, .tclk-history-card-bottom {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .tclk-history-card-title { font-size: 13px; font-weight: 700; }
    .tclk-history-state {
      border: 1px solid rgba(61, 158, 103, .65); color: #72dfa2;
      border-radius: 999px; padding: 4px 9px; font: 700 10px/1 ui-monospace, monospace;
    }
    .tclk-history-amount { font-size: 24px; font-weight: 760; letter-spacing: -.03em; }
    .tclk-history-meta { color: #84928f; font-size: 11px; }
    .tclk-history-detail {
      border: 1px solid rgba(121, 149, 159, .24); border-radius: 14px;
      padding: 20px; display: grid; gap: 18px;
    }
    .tclk-history-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .tclk-history-detail-grid > div { border: 1px solid rgba(121,149,159,.18); border-radius: 10px; padding: 12px; display: grid; gap: 5px; }
    .tclk-history-detail-grid span { color: #748582; font: 700 10px/1.2 ui-monospace, monospace; letter-spacing: .08em; }
    .tclk-history-detail-grid strong, .tclk-history-detail-grid code { overflow-wrap: anywhere; }
    .tclk-history-note { margin: 0; color: #97a6a3; font-size: 12px; line-height: 1.55; }
    @media (max-width: 760px) { .tclk-history-detail-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

async function api(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

async function openHistoryDeal(deal) {
  const main = document.querySelector(".tclk-workspace:not([hidden]) .tclk-main");
  if (!main) return;
  const payer = await profileLabel(deal.payerDid);
  const payee = await profileLabel(deal.payeeDid);
  main.replaceChildren();

  const back = node("button", "tclk-secondary tclk-back", `← ${copy("My deals", "Anlaşmalarım")}`);
  back.type = "button";
  back.addEventListener("click", () => document.querySelector('.tclk-tabs button[data-tab="mine"]')?.click());

  const detail = node("section", "tclk-history-detail");
  const head = node("div", "tclk-history-card-top");
  const amount = node("div", "tclk-history-amount", `${deal.amount} ${deal.asset}`);
  const state = node("span", "tclk-history-state", stateLabel(deal.status));
  head.append(amount, state);

  const grid = node("div", "tclk-history-detail-grid");
  const entries = [
    [copy("AGREEMENT ID", "ANLAŞMA KİMLİĞİ"), deal.contractId ?? deal.offerId],
    [copy("PAYER", "ÖDEYEN"), payer],
    [copy("PAYEE", "ÖDEMEYİ ALAN"), payee],
    [copy("JOB", "İŞ"), deal.jobId ?? "—"],
    [copy("JOB NOTE", "İŞ NOTU"), deal.jobContext ?? "—"],
    [copy("LAST UPDATED", "SON GÜNCELLEME"), new Date(deal.updatedAt).toLocaleString()],
  ];
  for (const [label, value] of entries) {
    const cell = node("div");
    cell.append(node("span", "", label), node("strong", "", value));
    grid.appendChild(cell);
  }

  const note = node("p", "tclk-history-note", copy(
    "This is a durable FLOP archive entry built from transport-verified, signed TCLK records. PostgreSQL is an index and archive only; the official TCLK state machine remains the protocol authority.",
    "Bu kayıt, taşıma imzası doğrulanmış TCLK kayıtlarından oluşturulan kalıcı FLOP arşividir. PostgreSQL yalnızca indeks ve arşiv görevi görür; protokol durumunun otoritesi resmi TCLK state machine olmaya devam eder.",
  ));
  detail.append(head, grid, note);
  main.append(back, detail);
}

async function renderHistory() {
  if (busy) return;
  const workspace = document.querySelector(".tclk-workspace:not([hidden])");
  const mine = workspace?.querySelector('.tclk-tabs button[data-tab="mine"].active');
  const main = workspace?.querySelector(".tclk-main");
  if (!workspace || !mine || !main) return;
  if (main.querySelector(".tclk-history-detail")) return;

  const did = activeDid();
  if (!did.startsWith("did:key:")) return;
  busy = true;
  try {
    const body = await api(`/api/v1/tclk/history?did=${encodeURIComponent(did)}`);
    const history = Array.isArray(body?.deals) ? body.deals.filter((deal) => TERMINAL.has(String(deal?.status))) : [];
    main.querySelector(".tclk-history-section")?.remove();
    if (!history.length) return;

    const empty = main.querySelector(".tclk-empty");
    if (empty) empty.textContent = copy("You have no active agreements.", "Aktif anlaşman yok.");

    const section = node("section", "tclk-history-section");
    const head = node("div", "tclk-history-head");
    const titleWrap = node("div");
    titleWrap.append(
      node("h2", "", copy("Completed history", "Tamamlanan anlaşmalar")),
      node("p", "", copy("Durable signed agreement archive", "Kalıcı imzalı anlaşma geçmişi")),
    );
    head.appendChild(titleWrap);
    const list = node("div", "tclk-history-list");

    for (const deal of history) {
      const card = node("article", "tclk-history-card");
      const top = node("div", "tclk-history-card-top");
      top.append(
        node("strong", "tclk-history-card-title", deal.jobId ? `${copy("Job", "İş")} · ${deal.jobId}` : copy("Archived agreement", "Arşivlenmiş anlaşma")),
        node("span", "tclk-history-state", stateLabel(deal.status)),
      );
      const amount = node("div", "tclk-history-amount", `${deal.amount} ${deal.asset}`);
      const bottom = node("div", "tclk-history-card-bottom");
      bottom.append(
        node("span", "tclk-history-meta", new Date(deal.updatedAt).toLocaleString()),
      );
      const open = node("button", "tclk-secondary", copy("Open record", "Kaydı aç"));
      open.type = "button";
      open.addEventListener("click", () => void openHistoryDeal(deal));
      bottom.appendChild(open);
      card.append(top, amount, bottom);
      list.appendChild(card);
    }
    section.append(head, list);
    main.appendChild(section);

    const status = workspace.querySelector(".tclk-status");
    const liveCount = main.querySelectorAll(".tclk-deal-card").length;
    if (status) status.textContent = copy(
      `${liveCount} active · ${history.length} completed`,
      `${liveCount} aktif · ${history.length} tamamlanmış`,
    );
  } catch {
    // History is supplemental to the live TCLK surface. A temporary archive read failure
    // must not break offer discovery or live deal actions.
  } finally {
    busy = false;
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void renderHistory(), 120);
}

loadStyle();
const observer = new MutationObserver(schedule);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('.tclk-tabs button[data-tab="mine"], .tclk-list-head .tclk-secondary')) schedule();
}, true);
schedule();
