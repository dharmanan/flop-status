void import("/communication-nav.js?v=agent-network-v4");

const VIEWS = ["overview", "capabilities", "verifications", "certificates", "activity", "settings"];
const CAPABILITIES = {
  1: "Ed25519 Signature Verification",
  2: "Canonical JSON + SHA256",
  3: "Technocore Canonical Message",
  4: "Signed Receipt Verification",
  5: "Structured Data Transformation",
  6: "Constraint & Policy Compliance",
  7: "Failure Recovery & Idempotency",
};
const CAPABILITY_NUMBERS = Object.keys(CAPABILITIES).map(Number);

const COPY = {
  en: {
    overview: "Agent Overview",
    overviewIntro: "Current Flop Proof identity, rank and capability state.",
    capabilities: "Capabilities",
    verifications: "Verifications",
    verificationsIntro: "Live verification and stored verification records use the same real proof data.",
    certificates: "Certificates",
    certificatesIntro: "Individual capability certificates already issued to this DID.",
    activity: "Activity",
    activityIntro: "This agent's real activity — nothing staged or fabricated.",
    settings: "Settings",
    settingsIntro: "Local identity and language controls.",
    did: "DID",
    rank: "Rank",
    certificateCount: "Certificates",
    capabilityState: "Capability state",
    openCapability: "Open capability",
    watchRecord: "Watch verification record",
    openCertificate: "Open certificate",
    certified: "Certified",
    verifying: "Verifying",
    locked: "Locked",
    available: "Available",
    noCertificate: "Not certified yet",
    currentOperation: "Current operation",
    noOperation: "No active operation",
    localIdentity: "Local identity",
    custody: "Key custody",
    language: "Language",
    disconnect: "Disconnect local identity",
    executionBoundary: "Execution boundary",
    boundaryBody: "Capability execution stays inside Flop Proof. DID, certificate, receipt and public proof are portable.",
  },
  tr: {
    overview: "Ajan Genel Bakış",
    overviewIntro: "Mevcut Flop Proof kimliği, rank ve capability durumu.",
    capabilities: "Yetenekler",
    verifications: "Doğrulamalar",
    verificationsIntro: "Canlı doğrulama ve kayıtlı doğrulama aynı gerçek proof verisini kullanır.",
    certificates: "Sertifikalar",
    certificatesIntro: "Bu DID için üretilmiş bireysel capability certificate'ları.",
    activity: "Aktivite",
    activityIntro: "Bu ajanın gerçek etkinliği — hiçbir şey kurgulanmaz.",
    settings: "Ayarlar",
    settingsIntro: "Yerel kimlik ve dil kontrolleri.",
    did: "DID",
    rank: "Rank",
    certificateCount: "Sertifika",
    capabilityState: "Capability durumu",
    openCapability: "Capability'yi aç",
    watchRecord: "Doğrulama kaydını izle",
    openCertificate: "Certificate'ı aç",
    certified: "Sertifikalı",
    verifying: "Doğrulanıyor",
    locked: "Kilitli",
    available: "Hazır",
    noCertificate: "Henüz sertifikalı değil",
    currentOperation: "Mevcut işlem",
    noOperation: "Aktif işlem yok",
    localIdentity: "Yerel kimlik",
    custody: "Anahtar saklama",
    language: "Dil",
    disconnect: "Yerel kimliği ayır",
    executionBoundary: "Execution boundary",
    boundaryBody: "Capability Flop Proof içinde çalışır. DID, certificate, receipt ve public proof taşınabilir.",
  },
};

let currentView = "capabilities";
let secondary = null;
let boundShell = null;
let sourceObserver = null;
let refreshQueued = false;

function lang() { return document.documentElement.lang === "tr" ? "tr" : "en"; }
function t(key) { return COPY[lang()][key]; }
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function status(number) { return document.getElementById(`capability-${number}-status`)?.textContent?.trim() ?? ""; }
function certificateLink(number) { return document.getElementById(`capability-${number}-certificate`) ?? null; }
function certified(number) {
  const link = certificateLink(number);
  const text = status(number).toLowerCase();
  return Boolean(link && !link.hidden && link.getAttribute("href")) || text.includes("certified") || text.includes("sertifikalı");
}
function verifying(number) {
  const flow = document.getElementById(`capability-${number}-flow`);
  const text = status(number).toLowerCase();
  return flow?.dataset.verificationRunning === "true" || text.includes("verifying") || text.includes("doğrulan");
}
function normalizedState(number) {
  const text = status(number).toLowerCase();
  if (certified(number)) return t("certified");
  if (verifying(number)) return t("verifying");
  if (text.includes("locked") || text.includes("kilit")) return t("locked");
  return status(number) || t("available");
}
function did() { return document.getElementById("did")?.textContent?.trim() || "—"; }
function rank() {
  const el = document.getElementById("rank-progress");
  return el && !el.hidden && el.textContent?.trim() ? el.textContent.trim() : "—";
}
function certificateCount() {
  const text = document.getElementById("certificate-progress")?.textContent ?? "0";
  return text.match(/\d+/)?.[0] ?? "0";
}

function loadStyle() {
  if (document.getElementById("flop-product-navigation-style")) return;
  const link = document.createElement("link");
  link.id = "flop-product-navigation-style";
  link.rel = "stylesheet";
  link.href = "/app-shell-navigation.css?v=workspace-navigation-v3";
  document.head.appendChild(link);
}

function heading(title, intro) {
  const head = node("header", "shell-screen-head");
  head.append(node("h1", "shell-screen-title", title), node("p", "shell-screen-intro", intro));
  return head;
}

function stateBadge(number) {
  const badge = node("span", "shell-state-badge", normalizedState(number));
  badge.dataset.certified = certified(number) ? "true" : "false";
  badge.dataset.verifying = verifying(number) ? "true" : "false";
  return badge;
}

function openCapability(number, replay = false) {
  showView("capabilities");
  const selector = document.querySelector(`.capability-selector-button[data-capability="${number}"]`);
  selector?.click();
  if (replay) queueMicrotask(() => document.getElementById(`replay-capability-${number}`)?.click());
}

function capabilityRow(number, action = "open") {
  const row = node("article", "shell-record-row");
  const index = node("span", "shell-record-index", `C${number}`);
  const body = node("div", "shell-record-body");
  body.append(node("strong", "", CAPABILITIES[number]), node("code", "mono", document.querySelector(`#capability-${number}-status`)?.closest(".capability-card")?.querySelector(".trial-capability")?.textContent?.trim() || ""));
  const actions = node("div", "shell-record-actions");
  actions.appendChild(stateBadge(number));
  if (action === "open") {
    const button = node("button", "shell-action-button", t("openCapability"));
    button.type = "button";
    button.addEventListener("click", () => openCapability(number));
    actions.appendChild(button);
  }
  if (action === "verification" && certified(number)) {
    const button = node("button", "shell-action-button", t("watchRecord"));
    button.type = "button";
    button.addEventListener("click", () => openCapability(number, true));
    actions.appendChild(button);
  } else if (action === "verification" && verifying(number)) {
    const button = node("button", "shell-action-button", t("openCapability"));
    button.type = "button";
    button.addEventListener("click", () => openCapability(number));
    actions.appendChild(button);
  }
  if (action === "certificate") {
    const link = certificateLink(number);
    const href = link && !link.hidden ? link.getAttribute("href") : null;
    if (href) {
      const anchor = node("a", "shell-action-link", t("openCertificate"));
      anchor.href = href;
      actions.appendChild(anchor);
    } else {
      actions.appendChild(node("span", "shell-empty-action", t("noCertificate")));
    }
  }
  row.append(index, body, actions);
  return row;
}

function overviewScreen() {
  const view = node("section", "shell-screen");
  view.appendChild(heading(t("overview"), t("overviewIntro")));
  const stats = node("div", "shell-overview-stats");
  [[t("did"), did()], [t("certificateCount"), certificateCount()], [t("rank"), rank()]].forEach(([label, value]) => {
    const card = node("div", "shell-overview-stat");
    card.append(node("span", "", label), node("strong", label === t("did") ? "mono" : "", value));
    stats.appendChild(card);
  });
  view.appendChild(stats);
  const section = node("section", "shell-screen-section");
  section.appendChild(node("h2", "shell-screen-section-title", t("capabilityState")));
  for (const number of CAPABILITY_NUMBERS) section.appendChild(capabilityRow(number));
  view.appendChild(section);
  const boundary = node("section", "shell-boundary-card");
  boundary.append(node("strong", "", t("executionBoundary")), node("p", "", t("boundaryBody")));
  view.appendChild(boundary);
  return view;
}

function verificationsScreen() {
  const view = node("section", "shell-screen");
  view.appendChild(heading(t("verifications"), t("verificationsIntro")));
  const section = node("section", "shell-screen-section");
  for (const number of CAPABILITY_NUMBERS) section.appendChild(capabilityRow(number, "verification"));
  view.appendChild(section);
  return view;
}

function certificatesScreen() {
  const view = node("section", "shell-screen");
  view.appendChild(heading(t("certificates"), t("certificatesIntro")));
  const section = node("section", "shell-screen-section");
  for (const number of CAPABILITY_NUMBERS) section.appendChild(capabilityRow(number, "certificate"));
  view.appendChild(section);
  return view;
}

function activityScreen() {
  const view = node("section", "shell-screen");
  view.appendChild(heading(t("activity"), t("activityIntro")));
  const operation = document.getElementById("operation-status")?.textContent?.trim();
  const op = node("section", "shell-operation-card");
  op.append(node("span", "", t("currentOperation")), node("strong", "", operation || t("noOperation")));
  view.appendChild(op);
  const section = node("section", "shell-screen-section");
  for (const number of CAPABILITY_NUMBERS) section.appendChild(capabilityRow(number));
  view.appendChild(section);
  return view;
}

function settingsScreen() {
  const view = node("section", "shell-screen");
  view.appendChild(heading(t("settings"), t("settingsIntro")));
  const identity = node("section", "shell-settings-card");
  identity.append(node("span", "shell-settings-label", t("localIdentity")), node("code", "mono shell-settings-did", did()));
  const custody = document.getElementById("custody")?.textContent?.trim();
  if (custody) identity.append(node("span", "shell-settings-label", t("custody")), node("p", "", custody));
  const disconnect = node("button", "shell-danger-button", t("disconnect"));
  disconnect.type = "button";
  disconnect.addEventListener("click", () => document.getElementById("reset-identity")?.click());
  identity.appendChild(disconnect);
  view.appendChild(identity);

  const languageCard = node("section", "shell-settings-card");
  languageCard.appendChild(node("span", "shell-settings-label", t("language")));
  const row = node("div", "shell-language-row");
  for (const code of ["en", "tr"]) {
    const button = node("button", "shell-action-button", code.toUpperCase());
    button.type = "button";
    button.dataset.active = lang() === code ? "true" : "false";
    button.addEventListener("click", () => document.querySelector(`.lang-button[data-lang="${code}"]`)?.click());
    row.appendChild(button);
  }
  languageCard.appendChild(row);
  view.appendChild(languageCard);
  return view;
}

function buildView(view) {
  if (view === "overview") return overviewScreen();
  if (view === "verifications") return verificationsScreen();
  if (view === "certificates") return certificatesScreen();
  if (view === "activity") return activityScreen();
  if (view === "settings") return settingsScreen();
  return null;
}

function showCapabilities(show) {
  const workspace = boundShell?.querySelector(".product-workspace");
  if (!workspace) return;
  for (const selector of [".workspace-header", ".workspace-stage-label", "#active-actions"]) {
    const el = workspace.querySelector(selector);
    if (el) el.classList.toggle("shell-view-hidden", !show);
  }
}

function setNavActive(view) {
  boundShell?.querySelectorAll(".product-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
}

function renderSecondary() {
  if (!secondary || currentView === "capabilities") return;
  const next = buildView(currentView);
  if (next) secondary.replaceChildren(next);
}

function showView(view) {
  if (!VIEWS.includes(view) || !boundShell) return;
  currentView = view;
  boundShell.dataset.view = view;
  setNavActive(view);
  const capabilities = view === "capabilities";
  showCapabilities(capabilities);
  if (capabilities) {
    if (secondary) secondary.hidden = true;
    return;
  }
  if (!secondary) {
    secondary = node("div", "workspace-secondary-view");
    boundShell.querySelector(".product-workspace")?.appendChild(secondary);
  }
  secondary.hidden = false;
  renderSecondary();
}

function bindNav(shell) {
  boundShell = shell;
  shell.querySelectorAll(".product-nav-item").forEach((item, index) => {
    const view = VIEWS[index];
    item.dataset.view = view;
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    if (item.dataset.boundNav !== "true") {
      item.dataset.boundNav = "true";
      item.addEventListener("click", () => showView(view));
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showView(view);
        }
      });
    }
  });
  shell.querySelectorAll(".capability-selector-button").forEach((button) => {
    if (button.dataset.boundWorkspaceNav !== "true") {
      button.dataset.boundWorkspaceNav = "true";
      button.addEventListener("click", () => showView("capabilities"));
    }
  });
  setNavActive(currentView);
}

function refreshFromSource() {
  const shell = document.querySelector(".product-shell");
  if (!shell) return;
  bindNav(shell);
  if (currentView !== "capabilities" && secondary && !secondary.hidden) renderSecondary();
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    refreshFromSource();
  });
}

function observeSource() {
  sourceObserver?.disconnect();
  const active = document.getElementById("active-actions");
  if (!active) return;
  sourceObserver = new MutationObserver(queueRefresh);
  sourceObserver.observe(active, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true,
    attributeFilter: ["hidden", "href", "class"],
  });
}

function boot() {
  loadStyle();
  const shell = document.querySelector(".product-shell");
  if (shell) {
    bindNav(shell);
    observeSource();
    showView(currentView);
    return;
  }
  const observer = new MutationObserver(() => {
    const next = document.querySelector(".product-shell");
    if (!next) return;
    observer.disconnect();
    bindNav(next);
    observeSource();
    showView(currentView);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.documentElement.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest(".lang-button")) return;
  queueMicrotask(() => queueMicrotask(() => {
    const shell = document.querySelector(".product-shell");
    if (shell) bindNav(shell);
    if (currentView !== "capabilities") renderSecondary();
  }));
});

boot();
