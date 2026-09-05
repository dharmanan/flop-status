const API_BASE = "https://flop-status-production.up.railway.app";

const CAPABILITIES = {
  1: { name: "Ed25519 Signature Verification", id: "cryptography.signature-verification" },
  2: { name: "Canonical JSON + SHA256", id: "data.canonical-json-sha256" },
  3: { name: "Technocore Canonical Message", id: "protocol.technocore-canonical-message" },
  4: { name: "Signed Receipt Verification", id: "evidence.signed-receipt-verification" },
  5: { name: "Structured Data Transformation", id: "data.structured-transformation" },
  6: { name: "Constraint & Policy Compliance", id: "policy.constraint-compliance" },
  7: { name: "Failure Recovery & Idempotency", id: "runtime.failure-recovery-idempotency" },
};
const CAPABILITY_NUMBERS = Object.keys(CAPABILITIES).map(Number);

const COPY = {
  en: {
    agent: "Flop Proof Agent",
    agentStatus: "Agent Status",
    certificates: "Certificates",
    rank: "Rank",
    overview: "Overview",
    capabilities: "Capabilities",
    verifications: "Verifications",
    certificatesNav: "Certificates",
    activity: "Activity",
    settings: "Settings",
    boundaryTitle: "This capability runs only inside Flop Proof.",
    boundaryBody: "Portable: DID, certificate, receipt and public proof.",
    what: "What does this capability give the agent?",
    method: "Verification method",
    methodBody: "Fresh challenge + deterministic Flop Proof verifier",
    pass: "If passed",
    passBody: "Individual certificate + signed receipt + public proof",
    boundary: "Execution boundary",
    boundaryBody2: "Capability execution stays inside Flop Proof. Proof is portable.",
    proofPackage: "Proof Package",
    certificate: "Certificate",
    receipt: "Receipt",
    publicProof: "Public Proof",
    profile: "Capability Profile",
    unavailable: "Not issued yet",
    available: "Available",
    verified: "Verified",
    portable: "Portable & independently verifiable",
    profileActive: "Added to this Flop Proof agent",
    why: "Why PASS?",
    whyAcquire: "Capability acquired inside Flop Proof",
    whyFresh: "Fresh challenge solved",
    whyDid: "DID signed submission verified",
    whyVerifier: "Deterministic verifier returned PASS",
    open: "Open",
    waiting: "Waiting for certification",
  },
  tr: {
    agent: "Flop Proof Ajanı",
    agentStatus: "Ajan Durumu",
    certificates: "Sertifika",
    rank: "Rank",
    overview: "Genel Bakış",
    capabilities: "Yetenekler",
    verifications: "Doğrulamalar",
    certificatesNav: "Sertifikalar",
    activity: "Aktivite",
    settings: "Ayarlar",
    boundaryTitle: "Bu capability yalnızca Flop Proof içinde çalışır.",
    boundaryBody: "Taşınabilir: DID, certificate, receipt ve public proof.",
    what: "Bu capability ne kazandırır?",
    method: "Verification method",
    methodBody: "Fresh challenge + deterministic Flop Proof verifier",
    pass: "Başarırsa",
    passBody: "Bireysel certificate + signed receipt + public proof",
    boundary: "Execution boundary",
    boundaryBody2: "Capability Flop Proof içinde çalışır. Kanıt taşınabilir.",
    proofPackage: "Proof Package",
    certificate: "Certificate",
    receipt: "Receipt",
    publicProof: "Public Proof",
    profile: "Capability Profile",
    unavailable: "Henüz üretilmedi",
    available: "Hazır",
    verified: "Doğrulandı",
    portable: "Taşınabilir ve bağımsız doğrulanabilir",
    profileActive: "Bu Flop Proof ajanına eklendi",
    why: "Neden PASS?",
    whyAcquire: "Capability Flop Proof içinde kazanıldı",
    whyFresh: "Fresh challenge çözüldü",
    whyDid: "DID imzalı submission doğrulandı",
    whyVerifier: "Deterministic verifier PASS döndürdü",
    open: "Aç",
    waiting: "Sertifika bekleniyor",
  },
};

function lang() { return document.documentElement.lang === "tr" ? "tr" : "en"; }
function t(key) { return COPY[lang()][key]; }
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function selectedCard(number) { return document.getElementById(`capability-${number}-status`)?.closest(".capability-card") ?? null; }
function statusText(number) { return document.getElementById(`capability-${number}-status`)?.textContent?.trim() ?? ""; }
function isCertified(number) {
  const text = statusText(number).toLowerCase();
  const certificate = document.getElementById(`capability-${number}-certificate`);
  return Boolean(certificate && !certificate.hidden && certificate.getAttribute("href")) || text.includes("certified") || text.includes("sertifikalı");
}
function isVerifying(number) {
  const text = statusText(number).toLowerCase();
  const flow = document.getElementById(`capability-${number}-flow`);
  return flow?.dataset.verificationRunning === "true" || text.includes("verifying") || text.includes("doğrulan");
}
function preferredCapability() {
  for (const number of CAPABILITY_NUMBERS) if (isVerifying(number)) return number;
  for (const number of CAPABILITY_NUMBERS) {
    const text = statusText(number).toLowerCase();
    if (!isCertified(number) && !text.includes("locked") && !text.includes("kilit")) return number;
  }
  for (const number of [...CAPABILITY_NUMBERS].reverse()) if (isCertified(number)) return number;
  return 1;
}
function short(value, max = 26) {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(8, max - 9))}…${text.slice(-8)}`;
}
function certificateId(number) {
  const link = document.getElementById(`capability-${number}-certificate`);
  if (!link || link.hidden) return null;
  return link.getAttribute("href")?.match(/^\/certificate\/([^/]+)$/)?.[1] ?? null;
}

let shell = null;
let current = 1;
let proofRequest = 0;

function makeBrand() {
  const brand = node("div", "product-brand");
  const mark = node("span", "product-brand-mark");
  for (let i = 0; i < 8; i += 1) mark.appendChild(node("i", ""));
  brand.append(mark, node("strong", "", "Flop Proof"));
  const language = document.querySelector(".language-switch");
  if (language) brand.appendChild(language);
  return brand;
}

function makeSidebar() {
  const aside = node("aside", "product-sidebar");
  aside.appendChild(makeBrand());
  const status = node("section", "agent-status-card");
  const title = node("h2", "shell-section-title", t("agentStatus"));
  const identity = node("div", "agent-identity");
  const avatar = node("span", "agent-avatar", "A");
  const identityCopy = node("div", "agent-identity-copy");
  const agentName = node("strong", "", t("agent"));
  const didLabel = node("span", "", "DID");
  const did = node("code", "shell-did mono", "—");
  identityCopy.append(agentName, didLabel, did);
  identity.append(avatar, identityCopy);
  const stats = node("div", "agent-stats");
  const certStat = node("div", "agent-stat");
  certStat.append(node("span", "", t("certificates")), node("strong", "shell-cert-count", "0"));
  const rankStat = node("div", "agent-stat");
  rankStat.append(node("span", "", t("rank")), node("strong", "shell-rank", "—"));
  stats.append(certStat, rankStat);
  const selector = node("div", "capability-selector");
  for (const number of CAPABILITY_NUMBERS) {
    const button = node("button", "capability-selector-button", `C${number}`);
    button.type = "button";
    button.dataset.capability = String(number);
    button.addEventListener("click", () => selectCapability(number));
    selector.appendChild(button);
  }
  status.append(title, identity, stats, selector);
  const nav = node("nav", "product-nav");
  const items = [["⌂","overview"],["◇","capabilities"],["◎","verifications"],["▱","certificatesNav"],["↗","activity"],["⚙","settings"]];
  items.forEach(([icon,key]) => {
    const item = node("div", `product-nav-item${key === "capabilities" ? " active" : ""}`);
    item.append(node("span", "product-nav-icon", icon), node("span", "", t(key)));
    nav.appendChild(item);
  });
  const boundary = node("section", "sidebar-boundary");
  boundary.append(node("span", "sidebar-boundary-icon", "◇"), node("strong", "", t("boundaryTitle")), node("p", "", t("boundaryBody")));
  aside.append(status, nav, boundary);
  return aside;
}

function summaryRow(icon, title, body, className = "") {
  const row = node("div", `workspace-summary-row ${className}`.trim());
  row.append(node("span", "workspace-summary-icon", icon));
  const copy = node("div", "workspace-summary-copy");
  copy.append(node("strong", "", title), node("span", "", body));
  row.appendChild(copy);
  return row;
}

function makeWorkspace(activeActions) {
  const center = node("section", "product-workspace");
  const header = node("section", "workspace-header");
  const heading = node("div", "workspace-heading");
  const title = node("h1", "workspace-title", "");
  const id = node("code", "workspace-id mono", "");
  const state = node("span", "workspace-state", "");
  heading.append(title, id, state);
  const summary = node("div", "workspace-summary");
  summary.append(
    summaryRow("⌖", t("what"), "", "workspace-purpose-row"),
    summaryRow("⚙", t("method"), t("methodBody")),
    summaryRow("✓", t("pass"), t("passBody")),
    summaryRow("▣", t("boundary"), t("boundaryBody2")),
  );
  header.append(heading, summary);
  const stageLabel = node("div", "workspace-stage-label");
  stageLabel.append(node("span", "", "CAPABILITY WORKSPACE"), node("strong", "workspace-stage-status", ""));
  center.append(header, stageLabel, activeActions);
  return center;
}

function proofItem(icon, label, className) {
  const item = node("section", `proof-item ${className}`);
  const iconNode = node("span", "proof-item-icon", icon);
  const body = node("div", "proof-item-body");
  body.append(node("strong", "proof-item-title", label), node("code", "proof-item-id mono", t("unavailable")), node("span", "proof-item-meta", ""));
  const state = node("span", "proof-item-state", "○");
  item.append(iconNode, body, state);
  return item;
}

function makeProofPanel() {
  const aside = node("aside", "proof-sidebar");
  aside.appendChild(node("h2", "proof-heading", t("proofPackage")));
  aside.append(
    proofItem("◇", t("certificate"), "proof-certificate"),
    proofItem("▤", t("receipt"), "proof-receipt"),
    proofItem("◎", t("publicProof"), "proof-public"),
    proofItem("◉", t("profile"), "proof-profile"),
  );
  const semantics = node("section", "proof-semantics");
  semantics.textContent = lang() === "tr"
    ? "Bu certificate, bu DID’e bağlı Flop Proof ajanının belirtilen capability sürümünü fresh verification challenge üzerinde başarıyla kullandığını kanıtlar."
    : "This certificate proves that the FLOP agent bound to this DID successfully used the stated capability version on a fresh verification challenge.";
  const why = node("section", "proof-why");
  why.appendChild(node("h3", "", t("why")));
  ["whyAcquire","whyFresh","whyDid","whyVerifier"].forEach((key) => {
    const row = node("div", "proof-check");
    row.append(node("span", "proof-check-mark", "✓"), node("span", "", t(key)));
    why.appendChild(row);
  });
  aside.append(semantics, why);
  return aside;
}

function ensureShell() {
  if (shell) return shell;
  const main = document.querySelector("main");
  const active = document.getElementById("active-actions");
  if (!main || !active) return null;
  shell = node("div", "product-shell");
  shell.hidden = true;
  const sidebar = makeSidebar();
  const workspace = makeWorkspace(active);
  const proof = makeProofPanel();
  shell.append(sidebar, workspace, proof);
  main.appendChild(shell);
  current = preferredCapability();
  selectCapability(current, { scroll: false });
  return shell;
}

function proofNode(className) { return shell?.querySelector(`.${className}`) ?? null; }
function setProofItem(className, { id = t("unavailable"), meta = "", ready = false, href = null } = {}) {
  const item = proofNode(className);
  if (!item) return;
  const body = item.querySelector(".proof-item-body");
  const idNode = item.querySelector(".proof-item-id");
  const metaNode = item.querySelector(".proof-item-meta");
  const state = item.querySelector(".proof-item-state");
  idNode.textContent = id;
  metaNode.textContent = meta;
  state.textContent = ready ? "✓" : "○";
  item.dataset.ready = ready ? "true" : "false";
  body.querySelector("a.proof-open-link")?.remove();
  if (ready && href) {
    const link = node("a", "proof-open-link", t("open"));
    link.href = href;
    body.appendChild(link);
  }
}

async function syncProof(number) {
  const request = ++proofRequest;
  const certId = certificateId(number);
  const certified = isCertified(number);
  setProofItem("proof-certificate", { id: certId ? short(certId, 28) : t("unavailable"), meta: certified ? t("verified") : t("waiting"), ready: Boolean(certId), href: certId ? `/certificate/${encodeURIComponent(certId)}` : null });
  setProofItem("proof-profile", { id: `Capability ${number}`, meta: certified ? t("profileActive") : t("waiting"), ready: certified });
  setProofItem("proof-receipt", { id: t("unavailable"), meta: certified ? t("available") : t("waiting"), ready: false });
  setProofItem("proof-public", { id: t("unavailable"), meta: certified ? t("available") : t("waiting"), ready: false });
  if (!certId) return;
  try {
    const response = await fetch(`${API_BASE}/api/v1/certificates/${encodeURIComponent(certId)}`);
    if (!response.ok) return;
    const body = await response.json();
    if (request !== proofRequest || current !== number) return;
    const certificate = body.certificate;
    const receiptId = certificate?.receipt_id;
    if (!receiptId) return;
    setProofItem("proof-receipt", { id: short(receiptId, 28), meta: "Signed verification receipt", ready: true, href: `/verify/${encodeURIComponent(receiptId)}` });
    const proofResponse = await fetch(`${API_BASE}/api/v1/verification/${encodeURIComponent(receiptId)}`);
    if (!proofResponse.ok) return;
    const proofBody = await proofResponse.json();
    if (request !== proofRequest || current !== number) return;
    const verdict = proofBody.receipt?.verdict ?? certificate?.verdict ?? "";
    const valid = (proofBody.signature_status ?? body.receipt_verification?.signature_status) === "VALID";
    setProofItem("proof-public", { id: `proof · ${short(receiptId, 19)}`, meta: valid ? `${verdict || "PASS"} · ${t("portable")}` : t("portable"), ready: valid, href: `/verify/${encodeURIComponent(receiptId)}` });
  } catch {}
}

function updateHeader(number) {
  if (!shell) return;
  const config = CAPABILITIES[number];
  const card = selectedCard(number);
  shell.querySelector(".workspace-title").textContent = `Capability ${number} · ${config.name}`;
  shell.querySelector(".workspace-id").textContent = config.id;
  const status = statusText(number) || t("available");
  const state = shell.querySelector(".workspace-state");
  state.textContent = status;
  state.dataset.certified = isCertified(number) ? "true" : "false";
  state.dataset.verifying = isVerifying(number) ? "true" : "false";
  const purpose = card?.querySelector(`#capability-${number}-purpose`)?.textContent?.trim()
    || card?.querySelector(".capability-purpose")?.textContent?.trim()
    || (lang() === "tr" ? "Bu capability ajan içinde aktif olduğunda gerçek Flop Proof verification akışında test edilir." : "When active on the agent, this capability is tested in the real Flop Proof verification flow.");
  shell.querySelector(".workspace-purpose-row .workspace-summary-copy span").textContent = purpose;
  shell.querySelector(".workspace-stage-status").textContent = isCertified(number)
    ? (lang() === "tr" ? "SERTİFİKALI" : "CERTIFIED")
    : isVerifying(number)
      ? (lang() === "tr" ? "DOĞRULANIYOR" : "VERIFYING")
      : status.toUpperCase();
}

function syncSelector() {
  if (!shell) return;
  shell.querySelectorAll(".capability-selector-button").forEach((button) => {
    const number = Number(button.dataset.capability);
    button.classList.toggle("active", number === current);
    button.dataset.certified = isCertified(number) ? "true" : "false";
    button.dataset.verifying = isVerifying(number) ? "true" : "false";
    button.textContent = `C${number}${isCertified(number) ? " ✓" : isVerifying(number) ? " ·" : ""}`;
  });
}

function syncAgentSummary() {
  if (!shell) return;
  const did = document.getElementById("did")?.textContent?.trim() ?? "";
  shell.querySelector(".shell-did").textContent = did ? short(did, 30) : "—";
  shell.querySelector(".shell-did").title = did;
  const certificateText = document.getElementById("certificate-progress")?.textContent?.trim() ?? "0";
  shell.querySelector(".shell-cert-count").textContent = certificateText.match(/\d+/)?.[0] ?? "0";
  const rankNode = document.getElementById("rank-progress");
  const rank = rankNode && !rankNode.hidden ? rankNode.textContent?.trim() : "—";
  shell.querySelector(".shell-rank").textContent = rank || "—";
}

function syncShell() {
  if (!shell || shell.hidden) return;
  syncAgentSummary();
  syncSelector();
  updateHeader(current);
  void syncProof(current);
}

function selectCapability(number, { scroll = false } = {}) {
  if (!CAPABILITIES[number]) return;
  current = number;
  document.querySelectorAll("#active-actions .capability-card").forEach((card) => card.classList.remove("is-workspace-active"));
  selectedCard(number)?.classList.add("is-workspace-active");
  syncShell();
  if (scroll) shell?.querySelector(".product-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function refreshLocalization() {
  if (!shell || shell.hidden) return;
  const oldSidebar = shell.querySelector(".product-sidebar");
  const oldProof = shell.querySelector(".proof-sidebar");
  oldSidebar?.replaceWith(makeSidebar());
  oldProof?.replaceWith(makeProofPanel());
  const summaryRows = shell.querySelector(".workspace-summary");
  if (summaryRows) summaryRows.replaceChildren(
    summaryRow("⌖", t("what"), "", "workspace-purpose-row"),
    summaryRow("⚙", t("method"), t("methodBody")),
    summaryRow("✓", t("pass"), t("passBody")),
    summaryRow("▣", t("boundary"), t("boundaryBody2")),
  );
  syncShell();
}

function syncLifecycle() {
  const main = document.querySelector("main");
  const active = document.getElementById("active-actions");
  const seedGate = document.getElementById("seed-gate");
  const identitySetup = document.getElementById("identity-setup");
  const dashboardReady = Boolean(active && !active.hidden && (!seedGate || seedGate.hidden) && (!identitySetup || identitySetup.hidden));

  if (!dashboardReady) {
    if (shell) shell.hidden = true;
    main?.classList.remove("workspace-mode");
    return;
  }

  ensureShell();
  if (!shell) return;
  shell.hidden = false;
  main?.classList.add("workspace-mode");
  syncShell();
}

for (const id of ["active-actions", "seed-gate", "identity-setup", "identity-summary"]) {
  const target = document.getElementById(id);
  if (!target) continue;
  const observer = new MutationObserver(syncLifecycle);
  observer.observe(target, { attributes: true, childList: true, subtree: true, characterData: true, attributeFilter: ["hidden", "href", "class"] });
}

document.documentElement.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest(".lang-button")) queueMicrotask(refreshLocalization);
});

syncLifecycle();
