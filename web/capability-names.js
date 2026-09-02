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

const UI_COPY = {
  en: {
    method: "Verification method",
    methodBody: "Fresh challenge + deterministic FLOP verifier",
    passBody: "Individual certificate + signed receipt + public proof",
    boundary: "Execution boundary",
    boundaryBody: "Capability execution stays inside FLOP. Proof is portable.",
    workspace: "CAPABILITY WORKSPACE",
    use: "Use this capability inside FLOP",
    proofPackage: "Proof Package",
    certificate: "Certificate",
    receipt: "Receipt",
    publicProof: "Public Proof",
    profile: "Capability Profile",
    proofSemantics: "This certificate proves that the FLOP agent bound to this DID successfully used the stated capability version on a fresh verification challenge.",
    whyAcquire: "Capability acquired inside FLOP",
    whyFresh: "Fresh challenge solved",
    whyDid: "DID signed submission verified",
    whyVerifier: "Deterministic verifier returned PASS",
    receiptMeta: "Signed verification receipt",
    publicMeta: "PASS · Portable & independently verifiable",
    profileMeta: "Added to this FLOP agent",
    capabilityPrefix: "Capability",
  },
  tr: {
    method: "Doğrulama yöntemi",
    methodBody: "Yeni doğrulama girdisi + deterministik FLOP doğrulayıcısı",
    passBody: "Bireysel sertifika + imzalı makbuz + herkese açık kanıt",
    boundary: "Çalıştırma sınırı",
    boundaryBody: "Yetenek FLOP içinde çalışır. Kanıt taşınabilir.",
    workspace: "YETENEK ÇALIŞMA ALANI",
    use: "Bu yeteneği FLOP içinde kullan",
    proofPackage: "Kanıt Paketi",
    certificate: "Sertifika",
    receipt: "Makbuz",
    publicProof: "Herkese Açık Kanıt",
    profile: "Yetenek Profili",
    proofSemantics: "Bu sertifika, bu DID'e bağlı FLOP ajanının belirtilen yetenek sürümünü yeni bir doğrulama girdisinde başarıyla kullandığını kanıtlar.",
    whyAcquire: "Yetenek FLOP içinde kazanıldı",
    whyFresh: "Yeni doğrulama girdisi çözüldü",
    whyDid: "DID imzalı gönderim doğrulandı",
    whyVerifier: "Deterministik doğrulayıcı PASS döndürdü",
    receiptMeta: "İmzalı doğrulama makbuzu",
    publicMeta: "PASS · Taşınabilir ve bağımsız doğrulanabilir",
    profileMeta: "Bu FLOP ajanına eklendi",
    capabilityPrefix: "Yetenek",
  },
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

function copy() {
  return UI_COPY[language()];
}

function setTextIfChanged(target, value) {
  if (target && value && target.textContent !== value) target.textContent = value;
}

function ensureCertifiedStatePriority() {
  if (document.getElementById("flop-certified-state-priority")) return;
  const style = document.createElement("style");
  style.id = "flop-certified-state-priority";
  style.textContent = `
    .shell-state-badge[data-certified="true"] {
      border-color: #2d6644 !important;
      color: #82d49f !important;
      background: #09150f !important;
    }
    .capability-selector-button[data-certified="true"] {
      border-color: #286541 !important;
      color: #8ee0a9 !important;
      background: #0b1b12 !important;
    }
  `;
  document.head.appendChild(style);
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

function syncWorkspaceCopy() {
  const c = copy();
  const rows = [...document.querySelectorAll(".workspace-summary-row")];
  if (rows[1]) {
    setTextIfChanged(rows[1].querySelector(".workspace-summary-copy strong"), c.method);
    setTextIfChanged(rows[1].querySelector(".workspace-summary-copy span"), c.methodBody);
  }
  if (rows[2]) setTextIfChanged(rows[2].querySelector(".workspace-summary-copy span"), c.passBody);
  if (rows[3]) {
    setTextIfChanged(rows[3].querySelector(".workspace-summary-copy strong"), c.boundary);
    setTextIfChanged(rows[3].querySelector(".workspace-summary-copy span"), c.boundaryBody);
  }
  setTextIfChanged(document.querySelector(".workspace-stage-label > span:first-child"), c.workspace);

  document.querySelectorAll(".capability-card > details.technical-details > summary").forEach((summary) => {
    setTextIfChanged(summary, c.use);
  });
}

function syncProofCopy() {
  const c = copy();
  setTextIfChanged(document.querySelector(".proof-heading"), c.proofPackage);
  setTextIfChanged(document.querySelector(".proof-certificate .proof-item-title"), c.certificate);
  setTextIfChanged(document.querySelector(".proof-receipt .proof-item-title"), c.receipt);
  setTextIfChanged(document.querySelector(".proof-public .proof-item-title"), c.publicProof);
  setTextIfChanged(document.querySelector(".proof-profile .proof-item-title"), c.profile);
  setTextIfChanged(document.querySelector(".proof-semantics"), c.proofSemantics);

  const whyRows = [...document.querySelectorAll(".proof-why .proof-check")];
  [c.whyAcquire, c.whyFresh, c.whyDid, c.whyVerifier].forEach((text, index) => {
    setTextIfChanged(whyRows[index]?.querySelector("span:last-child"), text);
  });

  const receiptMeta = document.querySelector(".proof-receipt .proof-item-meta");
  if (receiptMeta && /signed verification receipt|imzalı doğrulama makbuzu/i.test(receiptMeta.textContent ?? "")) {
    setTextIfChanged(receiptMeta, c.receiptMeta);
  }
  const publicMeta = document.querySelector(".proof-public .proof-item-meta");
  if (publicMeta && /portable|taşınabilir/i.test(publicMeta.textContent ?? "")) {
    setTextIfChanged(publicMeta, c.publicMeta);
  }
  const profileMeta = document.querySelector(".proof-profile .proof-item-meta");
  if (profileMeta && /added to this FLOP agent|bu FLOP ajanına eklendi/i.test(profileMeta.textContent ?? "")) {
    setTextIfChanged(profileMeta, c.profileMeta);
  }
}

function syncCeremonyCopy() {
  const c = copy();
  document.querySelectorAll(".ceremony-shell").forEach((ceremony) => {
    const capabilityId = ceremony.closest(".capability-card")?.querySelector(".trial-capability")?.textContent?.trim() ?? "";
    const number = capabilityNumberFromId(capabilityId);
    const name = capabilityDisplayName(number, language());
    if (!number || !name) return;
    setTextIfChanged(ceremony.querySelector(".ceremony-title"), `${c.capabilityPrefix} ${number} · ${name}`);
    setTextIfChanged(ceremony.querySelector(".ceremony-module-copy strong"), `${c.capabilityPrefix} ${number}`);
    setTextIfChanged(ceremony.querySelector(".ceremony-module-copy small"), name);
  });
}

export function syncCapabilityDisplayNames() {
  if (typeof document === "undefined") return;
  ensureCertifiedStatePriority();
  syncSecondaryRows();
  syncWorkspaceTitle();
  syncWorkspaceCopy();
  syncProofCopy();
  syncCeremonyCopy();
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
  const renderObserver = new MutationObserver(scheduleSync);
  renderObserver.observe(shell, { childList: true, subtree: true });
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
