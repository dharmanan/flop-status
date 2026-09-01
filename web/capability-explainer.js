import { getLanguage } from "/i18n.js";

const API_BASE = "https://flop-status-production.up.railway.app";

const byId = (id) => document.getElementById(id);
const copy = (en, tr) => (getLanguage() === "tr" ? tr : en);

/**
 * One "what happened" narrative per capability, anchored after that
 * capability's practice-result element. Capability 1 and 2 text mirrors what
 * was already shipped; Capability 3 and 4 follow the same shape.
 */
const CAPABILITIES = [
  {
    number: 1,
    practiceResultId: "practice-result",
    statusId: "capability-1-status",
    certificateLinkId: "capability-1-certificate",
    added: {
      en: "This agent can now verify Ed25519 signatures inside FLOP.",
      tr: "Bu ajan artık FLOP içinde Ed25519 imzalarını doğrulayabiliyor.",
    },
    addedPending: {
      en: "This agent can now verify Ed25519 signatures inside FLOP. Practice if you want, then take the certification test.",
      tr: "Bu ajan artık FLOP içinde Ed25519 imzalarını doğrulayabiliyor. İstersen pratik yap, ardından sertifika testine gir.",
    },
    testResult: {
      en: "FLOP gave the agent a fresh signature verification test. The agent produced the correct result and FLOP independently confirmed it.",
      tr: "FLOP ajana yeni bir imza doğrulama testi verdi. Ajan doğru sonucu üretti ve FLOP bunu bağımsız olarak doğruladı.",
    },
    technical: {
      challenge: {
        en: "A fresh one-time public key, message and signature were generated for this DID.",
        tr: "Bu DID için tek kullanımlık yeni bir public key, mesaj ve imza challenge'ı üretildi.",
      },
      agentResult: {
        en: "The installed capability decided whether the signature was valid and calculated the message hash.",
        tr: "Yüklü yetenek imzanın geçerli olup olmadığını belirledi ve mesaj hashini hesapladı.",
      },
      flopCheck: {
        en: "The deterministic verifier recomputed the expected answer independently. The answers matched.",
        tr: "Deterministik verifier beklenen cevabı bağımsız olarak yeniden hesapladı. Sonuçlar eşleşti.",
      },
    },
  },
  {
    number: 2,
    practiceResultId: "practice-result-2",
    statusId: "capability-2-status",
    certificateLinkId: "capability-2-certificate",
    added: {
      en: "This agent can canonicalize JSON and calculate its SHA256 hash inside FLOP.",
      tr: "Bu ajan artık FLOP içinde JSON'u canonical hale getirip SHA256 hashini hesaplayabiliyor.",
    },
    addedPending: {
      en: "This agent can now canonicalize JSON and calculate its SHA256 hash inside FLOP. Practice if you want, then take the certification test.",
      tr: "Bu ajan artık FLOP içinde JSON'u canonical hale getirip SHA256 hashini hesaplayabiliyor. İstersen pratik yap, ardından sertifika testine gir.",
    },
    testResult: {
      en: "FLOP gave the agent a fresh JSON document. The agent produced the correct RFC 8785 canonical JSON and SHA256 hash, and FLOP independently confirmed both.",
      tr: "FLOP ajana yeni bir JSON belgesi verdi. Ajan doğru RFC 8785 canonical JSON'u ve SHA256 hashini üretti, FLOP da ikisini bağımsız olarak doğruladı.",
    },
    technical: {
      challenge: {
        en: "A fresh one-time JSON document was generated for this DID.",
        tr: "Bu DID için tek kullanımlık yeni bir JSON belgesi üretildi.",
      },
      agentResult: {
        en: "The installed capability produced RFC 8785 canonical JSON and the SHA256 digest of its UTF-8 bytes.",
        tr: "Yüklü yetenek RFC 8785 canonical JSON'u ve UTF-8 byte'larının SHA256 digestini üretti.",
      },
      flopCheck: {
        en: "The deterministic verifier independently recomputed both values. The results matched.",
        tr: "Deterministik verifier iki değeri de bağımsız olarak yeniden hesapladı. Sonuçlar eşleşti.",
      },
    },
  },
  {
    number: 3,
    practiceResultId: "practice-result-3",
    statusId: "capability-3-status",
    certificateLinkId: "capability-3-certificate",
    added: {
      en: "This agent can build Technocore's exact canonical signing message inside FLOP.",
      tr: "Bu ajan artık FLOP içinde Technocore'un kesin canonical imzalama mesajını oluşturabiliyor.",
    },
    addedPending: {
      en: "This agent can now build Technocore's exact canonical signing message inside FLOP. Practice if you want, then take the certification test.",
      tr: "Bu ajan artık FLOP içinde Technocore'un kesin canonical imzalama mesajını oluşturabiliyor. İstersen pratik yap, ardından sertifika testine gir.",
    },
    testResult: {
      en: "FLOP gave the agent a fresh room, nonce and raw message text. The agent produced the correct cleaned text and canonical message, and FLOP independently confirmed both.",
      tr: "FLOP ajana yeni bir room, nonce ve ham mesaj metni verdi. Ajan doğru temizlenmiş metni ve canonical mesajı üretti, FLOP da ikisini bağımsız olarak doğruladı.",
    },
    technical: {
      challenge: {
        en: "A fresh one-time room, nonce and raw message text were generated for this DID.",
        tr: "Bu DID için tek kullanımlık yeni bir room, nonce ve ham mesaj metni üretildi.",
      },
      agentResult: {
        en: "The installed capability cleaned the text and built the room|nonce|text canonical message.",
        tr: "Yüklü yetenek metni temizledi ve room|nonce|metin canonical mesajını oluşturdu.",
      },
      flopCheck: {
        en: "The deterministic verifier independently recomputed both values. The results matched.",
        tr: "Deterministik verifier iki değeri de bağımsız olarak yeniden hesapladı. Sonuçlar eşleşti.",
      },
    },
  },
  {
    number: 4,
    practiceResultId: "practice-result-4",
    statusId: "capability-4-status",
    certificateLinkId: "capability-4-certificate",
    added: {
      en: "This agent can independently check FLOP signed receipts inside FLOP.",
      tr: "Bu ajan artık FLOP içinde imzalı receipt'leri bağımsız olarak kontrol edebiliyor.",
    },
    addedPending: {
      en: "This agent can now independently check FLOP signed receipts inside FLOP. Practice if you want, then take the certification test.",
      tr: "Bu ajan artık FLOP içinde imzalı receipt'leri bağımsız olarak kontrol edebiliyor. İstersen pratik yap, ardından sertifika testine gir.",
    },
    testResult: {
      en: "FLOP gave the agent a fresh signed receipt and a bounded server key set, including tampered or unknown-key variants. The agent classified it correctly and FLOP independently confirmed the result.",
      tr: "FLOP ajana yeni bir imzalı receipt ve sınırlı bir sunucu anahtar kümesi verdi; değiştirilmiş veya bilinmeyen anahtar durumları da dahil. Ajan bunu doğru sınıflandırdı ve FLOP sonucu bağımsız olarak doğruladı.",
    },
    technical: {
      challenge: {
        en: "A fresh one-time signed receipt and server key set were generated for this DID.",
        tr: "Bu DID için tek kullanımlık yeni bir imzalı receipt ve sunucu anahtar kümesi üretildi.",
      },
      agentResult: {
        en: "The installed capability decided whether the receipt was valid, invalid or unknown and identified the applicable key.",
        tr: "Yüklü yetenek receipt'in geçerli, geçersiz veya bilinmeyen olduğuna karar verdi ve ilgili anahtarı belirledi.",
      },
      flopCheck: {
        en: "The deterministic verifier recomputed the expected classification independently. The answers matched.",
        tr: "Deterministik verifier beklenen sınıflandırmayı bağımsız olarak yeniden hesapladı. Sonuçlar eşleşti.",
      },
    },
  },
];

function addRow(container, title, body) {
  const row = document.createElement("div");
  row.className = "capability-summary-row";
  const strong = document.createElement("strong");
  const text = document.createElement("span");
  strong.textContent = title;
  text.textContent = body;
  row.append(strong, text);
  container.appendChild(row);
}

function addTechnicalLine(container, title, body) {
  const row = document.createElement("div");
  const strong = document.createElement("strong");
  const text = document.createElement("span");
  strong.textContent = title;
  text.textContent = body;
  row.append(strong, document.createTextNode(" "), text);
  container.appendChild(row);
}

function ensureSurface(config) {
  const practiceResult = byId(config.practiceResultId);
  const sectionId = `capability-${config.number}-explanation`;
  if (!practiceResult || byId(sectionId)) return;

  const section = document.createElement("section");
  section.id = sectionId;
  section.className = "capability-explanation";
  section.hidden = true;

  const label = document.createElement("div");
  label.className = "label";
  label.id = `${sectionId}-label`;
  const rows = document.createElement("div");
  rows.id = `${sectionId}-rows`;
  rows.className = "capability-summary";

  const technical = document.createElement("details");
  technical.id = `${sectionId}-technical`;
  technical.className = "technical-details capability-summary-technical";
  technical.hidden = true;
  const summary = document.createElement("summary");
  summary.id = `${sectionId}-technical-title`;
  const lines = document.createElement("div");
  lines.id = `${sectionId}-technical-lines`;
  lines.className = "checks";
  technical.append(summary, lines);

  section.append(label, rows, technical);
  practiceResult.insertAdjacentElement("afterend", section);
}

async function fetchCertificateProof(certificateId) {
  if (!certificateId) return null;
  try {
    const response = await fetch(API_BASE + "/api/v1/certificates/" + encodeURIComponent(certificateId));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function certificateIdFromLink(config) {
  const link = byId(config.certificateLinkId);
  if (!link || link.hidden) return null;
  return link.getAttribute("href")?.match(/^\/certificate\/([^/]+)$/)?.[1] ?? null;
}

async function renderOne(config) {
  ensureSurface(config);
  const sectionId = `capability-${config.number}-explanation`;
  const section = byId(sectionId);
  const status = byId(config.statusId);
  if (!section || !status) return;

  const installed = ["Installed", "Yüklendi", "Certified", "Sertifikalı"].includes(status.textContent);
  const certified = ["Certified", "Sertifikalı"].includes(status.textContent);
  section.hidden = !installed;
  if (!installed) return;

  byId(`${sectionId}-label`).textContent = copy("WHAT HAPPENED?", "NE OLDU?");
  const rows = byId(`${sectionId}-rows`);
  rows.replaceChildren();

  if (!certified) {
    addRow(rows, copy("Capability added", "Yetenek eklendi"), copy(config.addedPending.en, config.addedPending.tr));
    byId(`${sectionId}-technical`).hidden = true;
    return;
  }

  addRow(rows, copy("Capability added", "Yetenek eklendi"), copy(config.added.en, config.added.tr));
  addRow(rows, copy("Test result · PASS", "Test sonucu · PASS"), copy(config.testResult.en, config.testResult.tr));
  addRow(
    rows,
    copy("Certificate issued", "Sertifika verildi"),
    copy(
      "This capability now has its own verifiable FLOP certificate and signed receipt.",
      "Bu yeteneğin artık doğrulanabilir FLOP sertifikası ve imzalı receipt'i var.",
    ),
  );

  const technical = byId(`${sectionId}-technical`);
  technical.hidden = false;
  byId(`${sectionId}-technical-title`).textContent = copy("How was it verified technically?", "Teknik olarak nasıl doğrulandı?");
  const lines = byId(`${sectionId}-technical-lines`);
  lines.replaceChildren();
  addTechnicalLine(lines, copy("Challenge:", "Challenge:"), copy(config.technical.challenge.en, config.technical.challenge.tr));
  addTechnicalLine(lines, copy("Agent result:", "Ajan sonucu:"), copy(config.technical.agentResult.en, config.technical.agentResult.tr));
  addTechnicalLine(lines, copy("FLOP check:", "FLOP kontrolü:"), copy(config.technical.flopCheck.en, config.technical.flopCheck.tr));

  const certificateId = certificateIdFromLink(config);
  const proof = await fetchCertificateProof(certificateId);
  const receiptId = proof?.certificate?.receipt_id;
  const attestation = proof?.receipt_verification?.signature_status;
  if (receiptId) {
    addTechnicalLine(
      lines,
      copy("Proof:", "Kanıt:"),
      copy(
        `Certificate ${certificateId}; signed receipt ${receiptId}; attestation ${attestation ?? "available"}.`,
        `Sertifika ${certificateId}; imzalı receipt ${receiptId}; attestation ${attestation ?? "mevcut"}.`,
      ),
    );
  }
}

function localizeUseSummaries() {
  for (const config of CAPABILITIES) {
    const details = byId(`capability-${config.number}-use`);
    const summary = details?.querySelector("summary");
    if (summary) summary.textContent = copy("Use this capability inside FLOP", "Bu yeteneği FLOP içinde kullan");
  }
}

function renderAll() {
  for (const config of CAPABILITIES) void renderOne(config);
}

function watchMainPage() {
  if (!byId("active-actions")) return;
  for (const config of CAPABILITIES) ensureSurface(config);
  localizeUseSummaries();
  renderAll();

  const observer = new MutationObserver(() => {
    localizeUseSummaries();
    renderAll();
  });
  for (const config of CAPABILITIES) {
    const status = byId(config.statusId);
    const certificateLink = byId(config.certificateLinkId);
    if (status) observer.observe(status, { childList: true, subtree: true });
    if (certificateLink) observer.observe(certificateLink, { attributes: true, attributeFilter: ["hidden", "href"] });
  }

  document.querySelectorAll(".lang-button").forEach((button) => {
    button.addEventListener("click", () => setTimeout(() => {
      localizeUseSummaries();
      renderAll();
    }, 0));
  });
}

watchMainPage();
