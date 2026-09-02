const CAPABILITY_NAMES = {
  1: { en: "Ed25519 Signature Verification", tr: "Ed25519 İmza Doğrulama" },
  2: { en: "Canonical JSON + SHA256", tr: "Kanonik JSON + SHA256" },
  3: { en: "Technocore Canonical Message", tr: "Technocore Kanonik Mesaj" },
  4: { en: "Signed Receipt Verification", tr: "İmzalı Makbuz Doğrulama" },
  5: { en: "Structured Data Transformation", tr: "Yapılandırılmış Veri Dönüşümü" },
  6: { en: "Constraint & Policy Compliance", tr: "Kısıt ve Politika Uyumluluğu" },
  7: { en: "Failure Recovery & Idempotency", tr: "Hata Kurtarma ve İdempotans" },
};

const CAPABILITY_IDS = {
  "cryptography.signature-verification": 1,
  "data.canonical-json-sha256": 2,
  "protocol.technocore-canonical-message": 3,
  "evidence.signed-receipt-verification": 4,
  "data.structured-transformation": 5,
  "policy.constraint-compliance": 6,
  "runtime.failure-recovery-idempotency": 7,
};

export function capabilityDisplayName(number, language = "en") {
  const entry = CAPABILITY_NAMES[Number(number)];
  if (!entry) return null;
  return language === "tr" ? entry.tr : entry.en;
}

export function capabilityNumberFromId(capabilityId) {
  return CAPABILITY_IDS[String(capabilityId ?? "").trim()] ?? null;
}

function language() {
  return document.documentElement.lang === "tr" ? "tr" : "en";
}

function setTextIfChanged(target, value) {
  if (target && value && target.textContent !== value) target.textContent = value;
}

function syncSecondaryRows() {
  document.querySelectorAll(".shell-record-row").forEach((row) => {
    const index = row.querySelector(".shell-record-index")?.textContent?.trim() ?? "";
    const number = Number(index.replace(/^C/i, ""));
    setTextIfChanged(
      row.querySelector(".shell-record-body strong"),
      capabilityDisplayName(number, language()),
    );
  });
}

function syncWorkspaceTitle() {
  const capabilityId = document.querySelector(".workspace-id")?.textContent?.trim();
  const number = capabilityNumberFromId(capabilityId);
  const name = capabilityDisplayName(number, language());
  if (!name) return;
  setTextIfChanged(document.querySelector(".workspace-title"), name);
}

export function syncCapabilityDisplayNames() {
  if (typeof document === "undefined") return;
  syncSecondaryRows();
  syncWorkspaceTitle();
}

let syncQueued = false;
function scheduleSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncCapabilityDisplayNames();
  });
}

function watchShell(shell) {
  scheduleSync();
  const workspace = shell.querySelector(".product-workspace");
  if (workspace) {
    const renderObserver = new MutationObserver(scheduleSync);
    renderObserver.observe(workspace, { childList: true, subtree: true });
  }
  const languageObserver = new MutationObserver(scheduleSync);
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
}

function boot() {
  const shell = document.querySelector(".product-shell");
  if (shell) {
    watchShell(shell);
    return;
  }
  const observer = new MutationObserver(() => {
    const next = document.querySelector(".product-shell");
    if (!next) return;
    observer.disconnect();
    watchShell(next);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== "undefined") boot();
