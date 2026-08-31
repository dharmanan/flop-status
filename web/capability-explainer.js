const API_BASE = "https://flop-status-production.up.railway.app";
const LANGUAGE_KEY = "flop-ui-language";

const byId = (id) => document.getElementById(id);

function language() {
  return document.documentElement.lang === "tr" || localStorage.getItem(LANGUAGE_KEY) === "tr" ? "tr" : "en";
}

function copy(en, tr) {
  return language() === "tr" ? tr : en;
}

function addLine(container, title, body) {
  const row = document.createElement("div");
  const strong = document.createElement("strong");
  const text = document.createElement("span");
  strong.textContent = title;
  text.textContent = body;
  row.append(strong, document.createTextNode(" "), text);
  container.appendChild(row);
}

function createMainSummarySurface() {
  const actions = byId("active-actions");
  const practiceResult = byId("practice-result");
  if (!actions || !practiceResult || byId("capability-1-explanation")) return;

  const section = document.createElement("section");
  section.id = "capability-1-explanation";
  section.className = "capability-explanation";
  section.hidden = true;

  const acquireBlock = document.createElement("div");
  acquireBlock.id = "capability-1-acquire-summary";
  acquireBlock.className = "capability-explanation-block";

  const acquireEyebrow = document.createElement("div");
  acquireEyebrow.className = "label";
  acquireEyebrow.id = "capability-1-acquire-summary-label";
  const acquireTitle = document.createElement("div");
  acquireTitle.className = "status";
  acquireTitle.id = "capability-1-acquire-summary-title";
  const acquireLines = document.createElement("div");
  acquireLines.className = "checks";
  acquireLines.id = "capability-1-acquire-summary-lines";
  acquireBlock.append(acquireEyebrow, acquireTitle, acquireLines);

  const testBlock = document.createElement("div");
  testBlock.id = "capability-1-test-summary";
  testBlock.className = "capability-explanation-block";
  testBlock.hidden = true;

  const testEyebrow = document.createElement("div");
  testEyebrow.className = "label";
  testEyebrow.id = "capability-1-test-summary-label";
  const testTitle = document.createElement("div");
  testTitle.className = "status";
  testTitle.id = "capability-1-test-summary-title";
  const testLines = document.createElement("div");
  testLines.className = "checks";
  testLines.id = "capability-1-test-summary-lines";
  testBlock.append(testEyebrow, testTitle, testLines);

  section.append(acquireBlock, testBlock);
  practiceResult.insertAdjacentElement("afterend", section);
}

function certificateIdFromLink() {
  const link = byId("capability-1-certificate");
  if (!link || link.hidden) return null;
  const match = link.getAttribute("href")?.match(/^\/certificate\/([^/]+)$/);
  return match?.[1] ?? null;
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

  const installed = status.textContent === "Installed" || status.textContent === "Yüklendi" || status.textContent === "Certified" || status.textContent === "Sertifikalı";
  const certified = status.textContent === "Certified" || status.textContent === "Sertifikalı";
  section.hidden = !installed;
  if (!installed) return;

  byId("capability-1-acquire-summary-label").textContent = copy("WHAT DID ‘GET CAPABILITY’ DO?", "‘YETENEĞİ KAZAN’ NE YAPTI?");
  byId("capability-1-acquire-summary-title").textContent = copy(
    "Ed25519 verification was added to this agent.",
    "Ed25519 doğrulama yeteneği bu ajana eklendi.",
  );
  const acquireLines = byId("capability-1-acquire-summary-lines");
  acquireLines.replaceChildren();
  addLine(
    acquireLines,
    copy("Module:", "Modül:"),
    copy(
      "FLOP attached the versioned Ed25519 Signature Verification capability module to this agent profile.",
      "FLOP, sürümlenmiş Ed25519 Signature Verification yetenek modülünü bu ajanın profiline bağladı.",
    ),
  );
  addLine(
    acquireLines,
    copy("What it can do:", "Ne yapabilir:"),
    copy(
      "Given a public key, message and Ed25519 signature, it can determine whether that signature is valid and calculate the message SHA-256 hash.",
      "Bir public key, mesaj ve Ed25519 imzası verildiğinde imzanın geçerli olup olmadığını belirleyebilir ve mesajın SHA-256 hashini hesaplayabilir.",
    ),
  );
  addLine(
    acquireLines,
    copy("What did not happen:", "Ne olmadı:"),
    copy(
      "No LLM was trained and no certificate was granted just for installing the module.",
      "Herhangi bir LLM eğitilmedi ve yalnızca modülü yüklemek sertifika vermedi.",
    ),
  );

  const testBlock = byId("capability-1-test-summary");
  testBlock.hidden = !certified;
  if (!certified) return;

  byId("capability-1-test-summary-label").textContent = copy("WHAT HAPPENED IN THE CERTIFICATION TEST?", "SERTİFİKA TESTİNDE NE OLDU?");
  byId("capability-1-test-summary-title").textContent = copy(
    "PASS · the installed capability produced the correct result.",
    "PASS · yüklü yetenek doğru sonucu üretti.",
  );

  const lines = byId("capability-1-test-summary-lines");
  lines.replaceChildren();
  addLine(
    lines,
    copy("1. Fresh challenge:", "1. Yeni challenge:"),
    copy(
      "FLOP created a one-time challenge bound to this DID. It contained a public key, a message and an Ed25519 signature. The signature could be valid or deliberately invalid.",
      "FLOP bu DID'e bağlı tek kullanımlık yeni bir challenge oluşturdu. Challenge bir public key, mesaj ve Ed25519 imzası içeriyordu. İmza geçerli veya bilerek bozulmuş olabilirdi.",
    ),
  );
  addLine(
    lines,
    copy("2. Agent work:", "2. Ajanın yaptığı:"),
    copy(
      "The installed capability checked whether the signature really matched the supplied public key and message, then calculated the message hash. FLOP did not send the expected answer to the capability.",
      "Yüklü yetenek, imzanın verilen public key ve mesajla gerçekten eşleşip eşleşmediğini kontrol etti ve mesaj hashini hesapladı. FLOP beklenen cevabı yeteneğe göndermedi.",
    ),
  );
  addLine(
    lines,
    copy("3. Identity proof:", "3. Kimlik kanıtı:"),
    copy(
      "The exact result was signed by the browser-owned private key for this agent DID before submission.",
      "Üretilen sonuç gönderilmeden önce bu ajan DID'ine ait tarayıcıdaki private key ile birebir imzalandı.",
    ),
  );
  addLine(
    lines,
    copy("4. Independent verification:", "4. Bağımsız doğrulama:"),
    copy(
      "FLOP's deterministic verifier independently recomputed the expected result. Because the agent result matched, the verdict was PASS.",
      "FLOP'un deterministik verifier'ı beklenen sonucu bağımsız olarak yeniden hesapladı. Ajanın sonucu bununla eşleştiği için karar PASS oldu.",
    ),
  );

  const certificateId = certificateIdFromLink();
  const proof = await fetchCertificateProof(certificateId);
  const receiptId = proof?.certificate?.receipt_id ?? null;
  const attestation = proof?.receipt_verification?.signature_status ?? null;
  addLine(
    lines,
    copy("5. Proof created:", "5. Kanıt üretildi:"),
    receiptId
      ? copy(
          `FLOP issued certificate ${certificateId} and signed receipt ${receiptId}. Server attestation: ${attestation ?? "available"}.`,
          `FLOP ${certificateId} sertifikasını ve ${receiptId} imzalı receipt'ini üretti. Sunucu attestation durumu: ${attestation ?? "mevcut"}.`,
        )
      : copy(
          "PASS created a signed FLOP receipt and an individual capability certificate.",
          "PASS sonucunda imzalı FLOP receipt'i ve bu yeteneğe ait ayrı sertifika oluşturuldu.",
        ),
  );
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

  const status = byId("capability-1-status");
  const certificateLink = byId("capability-1-certificate");
  const observer = new MutationObserver(() => {
    localizeUseSummary();
    void renderMainSummary();
  });
  if (status) observer.observe(status, { childList: true, subtree: true });
  if (certificateLink) observer.observe(certificateLink, { attributes: true, attributeFilter: ["hidden", "href"] });

  window.addEventListener("storage", () => {
    localizeUseSummary();
    void renderMainSummary();
  });

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

  const explanation = document.createElement("section");
  explanation.id = "certificate-meaning";
  explanation.className = "capability-explanation certificate-explanation";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = copy("WHAT DOES THIS CERTIFICATE PROVE?", "BU SERTİFİKA NEYİ KANITLIYOR?");
  const title = document.createElement("div");
  title.className = "status";
  title.textContent = copy(
    "This agent passed an independent FLOP capability test.",
    "Bu ajan bağımsız bir FLOP yetenek testini geçti.",
  );
  const lines = document.createElement("div");
  lines.className = "checks";
  addLine(lines, copy("Task:", "Görev:"), copy(
    "Determine whether an Ed25519 signature is valid for the supplied public key and message, and calculate the message SHA-256 hash.",
    "Verilen public key ve mesaj için Ed25519 imzasının geçerli olup olmadığını belirlemek ve mesajın SHA-256 hashini hesaplamak.",
  ));
  addLine(lines, copy("Method:", "Yöntem:"), copy(
    "The installed capability solved a fresh one-time challenge; the expected answer was kept server-side.",
    "Yüklü yetenek tek kullanımlık yeni bir challenge'ı çözdü; beklenen cevap sunucu tarafında gizli tutuldu.",
  ));
  addLine(lines, copy("Verification:", "Doğrulama:"), copy(
    "FLOP independently recomputed the answer and issued this certificate only after a deterministic PASS.",
    "FLOP cevabı bağımsız olarak yeniden hesapladı ve bu sertifikayı yalnızca deterministik PASS sonrasında verdi.",
  ));
  addLine(lines, copy("Scope:", "Kapsam:"), copy(
    "It proves this FLOP agent can use this capability inside the FLOP environment under the certified version. It does not claim general intelligence or capability in arbitrary external apps.",
    "Bu sertifika, bu FLOP ajanının sertifikalanan sürümde bu yeteneği FLOP ortamında kullanabildiğini kanıtlar. Genel zekâ veya rastgele harici uygulamalarda aynı yeteneği kullanabildiği iddiasında bulunmaz.",
  ));

  explanation.append(label, title, lines);
  const actions = panel.querySelector(".actions");
  panel.insertBefore(explanation, actions ?? null);
}

function watchCertificatePage() {
  if (!byId("certificate-name")) return;
  document.documentElement.lang = language();
  createCertificateExplanation();
}

watchMainPage();
watchCertificatePage();
