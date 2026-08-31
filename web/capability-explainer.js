const API_BASE = "https://flop-status-production.up.railway.app";
const LANGUAGE_KEY = "flop-ui-language";

const byId = (id) => document.getElementById(id);

function language() {
  return document.documentElement.lang === "tr" || localStorage.getItem(LANGUAGE_KEY) === "tr" ? "tr" : "en";
}

function copy(en, tr) {
  return language() === "tr" ? tr : en;
}

function addSummaryRow(container, title, body) {
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

function createMainSummarySurface() {
  const practiceResult = byId("practice-result");
  if (!practiceResult || byId("capability-1-explanation")) return;

  const section = document.createElement("section");
  section.id = "capability-1-explanation";
  section.className = "capability-explanation";
  section.hidden = true;

  const label = document.createElement("div");
  label.className = "label";
  label.id = "capability-summary-label";

  const rows = document.createElement("div");
  rows.id = "capability-summary-rows";
  rows.className = "capability-summary";

  const technical = document.createElement("details");
  technical.id = "capability-summary-technical";
  technical.className = "technical-details capability-summary-technical";
  technical.hidden = true;
  const summary = document.createElement("summary");
  summary.id = "capability-summary-technical-title";
  const technicalLines = document.createElement("div");
  technicalLines.id = "capability-summary-technical-lines";
  technicalLines.className = "checks";
  technical.append(summary, technicalLines);

  section.append(label, rows, technical);
  practiceResult.insertAdjacentElement("afterend", section);
}

function certificateIdFromLink() {
  const link = byId("capability-1-certificate");
  if (!link || link.hidden) return null;
  return link.getAttribute("href")?.match(/^\/certificate\/([^/]+)$/)?.[1] ?? null;
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

async function renderMainSummary() {
  createMainSummarySurface();
  const section = byId("capability-1-explanation");
  const status = byId("capability-1-status");
  if (!section || !status) return;

  const installed = ["Installed", "Yüklendi", "Certified", "Sertifikalı"].includes(status.textContent);
  const certified = ["Certified", "Sertifikalı"].includes(status.textContent);
  section.hidden = !installed;
  if (!installed) return;

  byId("capability-summary-label").textContent = copy("WHAT HAPPENED?", "NE OLDU?");
  const rows = byId("capability-summary-rows");
  rows.replaceChildren();

  addSummaryRow(
    rows,
    copy("Capability added", "Yetenek eklendi"),
    copy(
      "This agent can now verify Ed25519 signatures inside FLOP.",
      "Bu ajan artık FLOP içinde Ed25519 imzalarını doğrulayabiliyor.",
    ),
  );

  if (!certified) {
    addSummaryRow(
      rows,
      copy("Next step", "Sıradaki adım"),
      copy(
        "Practice if you want, then take the certification test.",
        "İstersen pratik yap, ardından sertifika testine gir.",
      ),
    );
    byId("capability-summary-technical").hidden = true;
    return;
  }

  addSummaryRow(
    rows,
    copy("Test result · PASS", "Test sonucu · PASS"),
    copy(
      "FLOP gave the agent a fresh signature-verification test. The agent produced the correct result and FLOP independently confirmed it.",
      "FLOP ajana yeni bir imza doğrulama testi verdi. Ajan doğru sonucu üretti ve FLOP bunu bağımsız olarak doğruladı.",
    ),
  );

  addSummaryRow(
    rows,
    copy("Certificate issued", "Sertifika verildi"),
    copy(
      "This capability now has its own verifiable FLOP certificate and signed receipt.",
      "Bu yeteneğin artık doğrulanabilir FLOP sertifikası ve imzalı receipt'i var.",
    ),
  );

  const technical = byId("capability-summary-technical");
  technical.hidden = false;
  byId("capability-summary-technical-title").textContent = copy(
    "How was it verified technically?",
    "Teknik olarak nasıl doğrulandı?",
  );
  const technicalLines = byId("capability-summary-technical-lines");
  technicalLines.replaceChildren();

  addTechnicalLine(
    technicalLines,
    copy("Challenge:", "Challenge:"),
    copy(
      "A fresh one-time public key, message and signature were generated for this DID.",
      "Bu DID için tek kullanımlık yeni bir public key, mesaj ve imza challenge'ı üretildi.",
    ),
  );
  addTechnicalLine(
    technicalLines,
    copy("Agent result:", "Ajan sonucu:"),
    copy(
      "The installed capability decided whether the signature was valid and calculated the message hash.",
      "Yüklü yetenek imzanın geçerli olup olmadığını belirledi ve mesaj hashini hesapladı.",
    ),
  );
  addTechnicalLine(
    technicalLines,
    copy("FLOP check:", "FLOP kontrolü:"),
    copy(
      "The deterministic verifier recomputed the expected answer independently. The answers matched.",
      "Deterministik verifier beklenen cevabı bağımsız olarak yeniden hesapladı. Sonuçlar eşleşti.",
    ),
  );

  const certificateId = certificateIdFromLink();
  const proof = await fetchCertificateProof(certificateId);
  const receiptId = proof?.certificate?.receipt_id;
  const attestation = proof?.receipt_verification?.signature_status;
  if (receiptId) {
    addTechnicalLine(
      technicalLines,
      copy("Proof:", "Kanıt:"),
      copy(
        `Certificate ${certificateId}; signed receipt ${receiptId}; attestation ${attestation ?? "available"}.`,
        `Sertifika ${certificateId}; imzalı receipt ${receiptId}; attestation ${attestation ?? "mevcut"}.`,
      ),
    );
  }
}

function localizeUseSummary() {
  const details = byId("capability-1-use");
  const summary = details?.querySelector("summary");
  if (summary) summary.textContent = copy("Use this capability inside FLOP", "Bu yeteneği FLOP içinde kullan");
}

function watchMainPage() {
  if (!byId("active-actions")) return;
  createMainSummarySurface();
  localizeUseSummary();
  void renderMainSummary();

  const observer = new MutationObserver(() => {
    localizeUseSummary();
    void renderMainSummary();
  });
  const status = byId("capability-1-status");
  const certificateLink = byId("capability-1-certificate");
  if (status) observer.observe(status, { childList: true, subtree: true });
  if (certificateLink) observer.observe(certificateLink, { attributes: true, attributeFilter: ["hidden", "href"] });

  document.querySelectorAll(".lang-button").forEach((button) => {
    button.addEventListener("click", () => setTimeout(() => {
      localizeUseSummary();
      void renderMainSummary();
    }, 0));
  });
}

function createCertificateExplanation() {
  const certificateStatus = byId("certificate-status");
  const panel = certificateStatus?.closest(".panel");
  if (!panel || byId("certificate-meaning")) return;

  const section = document.createElement("section");
  section.id = "certificate-meaning";
  section.className = "capability-explanation certificate-explanation";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = copy("WHAT DOES THIS PROVE?", "BU NEYİ KANITLIYOR?");

  const rows = document.createElement("div");
  rows.className = "capability-summary";
  addSummaryRow(
    rows,
    copy("Verified capability", "Doğrulanmış yetenek"),
    copy(
      "This FLOP agent correctly completed an independent Ed25519 signature-verification test.",
      "Bu FLOP ajanı bağımsız bir Ed25519 imza doğrulama testini doğru tamamladı.",
    ),
  );
  addSummaryRow(
    rows,
    copy("Scope", "Kapsam"),
    copy(
      "The certificate covers this capability inside FLOP under the certified version. It is not a claim of general intelligence.",
      "Sertifika, bu yeteneğin sertifikalanan sürümde FLOP içindeki kullanımını kapsar. Genel zekâ iddiası değildir.",
    ),
  );

  section.append(label, rows);
  const actions = panel.querySelector(".actions");
  panel.insertBefore(section, actions ?? null);
}

function watchCertificatePage() {
  if (!byId("certificate-name")) return;
  document.documentElement.lang = language();
  createCertificateExplanation();
}

watchMainPage();
watchCertificatePage();
