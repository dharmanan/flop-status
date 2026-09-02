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

function syncStaticCards() {
  for (const number of Object.keys(CAPABILITY_NAMES).map(Number)) {
    const card = document.getElementById(`capability-${number}-status`)?.closest(".capability-card");
    const title = card?.querySelector(".trial-copy strong");
    if (title) title.textContent = capabilityDisplayName(number, language());
  }
}

function syncSecondaryRows() {
  document.querySelectorAll(".shell-record-row").forEach((row) => {
    const index = row.querySelector(".shell-record-index")?.textContent?.trim() ?? "";
    const number = Number(index.replace(/^C/i, ""));
    const title = row.querySelector(".shell-record-body strong");
    const name = capabilityDisplayName(number, language());
    if (title && name) title.textContent = name;
  });
}

function syncWorkspaceTitle() {
  const capabilityId = document.querySelector(".workspace-id")?.textContent?.trim();
  const number = capabilityNumberFromId(capabilityId);
  const title = document.querySelector(".workspace-title");
  const name = capabilityDisplayName(number, language());
  if (title && name) title.textContent = name;
}

export function syncCapabilityDisplayNames() {
  if (typeof document === "undefined") return;
  syncStaticCards();
  syncSecondaryRows();
  syncWorkspaceTitle();
}

function scheduleSync() {
  queueMicrotask(syncCapabilityDisplayNames);
  requestAnimationFrame(() => {
    syncCapabilityDisplayNames();
    requestAnimationFrame(syncCapabilityDisplayNames);
  });
}

function boot() {
  if (document.querySelector(".product-shell")) {
    scheduleSync();
  } else {
    const observer = new MutationObserver(() => {
      if (!document.querySelector(".product-shell")) return;
      observer.disconnect();
      scheduleSync();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.documentElement.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest(".lang-button, .capability-selector-button, .product-nav-item")) scheduleSync();
  });
}

if (typeof document !== "undefined") boot();
