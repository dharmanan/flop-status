import { getLanguage } from "/i18n.js";

const byId = (id) => document.getElementById(id);
const copy = (en, tr) => getLanguage() === "tr" ? tr : en;

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

function ensureSurface() {
  const practiceResult = byId("practice-result-2");
  if (!practiceResult || byId("capability-2-explanation")) return;
  const section = document.createElement("section");
  section.id = "capability-2-explanation";
  section.className = "capability-explanation";
  section.hidden = true;

  const label = document.createElement("div");
  label.className = "label";
  label.id = "capability-2-summary-label";
  const rows = document.createElement("div");
  rows.id = "capability-2-summary-rows";
  rows.className = "capability-summary";

  const technical = document.createElement("details");
  technical.id = "capability-2-summary-technical";
  technical.className = "technical-details capability-summary-technical";
  technical.hidden = true;
  const summary = document.createElement("summary");
  summary.id = "capability-2-summary-technical-title";
  const lines = document.createElement("div");
  lines.id = "capability-2-summary-technical-lines";
  lines.className = "checks";
  technical.append(summary, lines);

  section.append(label, rows, technical);
  practiceResult.insertAdjacentElement("afterend", section);
}

function render() {
  ensureSurface();
  const section = byId("capability-2-explanation");
  const status = byId("capability-2-status");
  if (!section || !status) return;

  const installed = ["Installed", "Yüklendi", "Certified", "Sertifikalı"].includes(status.textContent);
  const certified = ["Certified", "Sertifikalı"].includes(status.textContent);
  section.hidden = !installed;
  if (!installed) return;

  byId("capability-2-summary-label").textContent = copy("WHAT HAPPENED?", "NE OLDU?");
  const rows = byId("capability-2-summary-rows");
  rows.replaceChildren();

  addRow(
    rows,
    copy("Capability added", "Yetenek eklendi"),
    certified
      ? copy("This agent can canonicalize JSON and calculate its SHA256 hash inside FLOP.", "Bu ajan artık FLOP içinde JSON'u canonical hale getirip SHA256 hashini hesaplayabiliyor.")
      : copy("This agent can now canonicalize JSON and calculate its SHA256 hash inside FLOP. Practice if you want, then take the certification test.", "Bu ajan artık FLOP içinde JSON'u canonical hale getirip SHA256 hashini hesaplayabiliyor. İstersen pratik yap, ardından sertifika testine gir."),
  );

  const technical = byId("capability-2-summary-technical");
  if (!certified) {
    technical.hidden = true;
    return;
  }

  addRow(
    rows,
    copy("Test result · PASS", "Test sonucu · PASS"),
    copy("FLOP gave the agent a fresh JSON document. The agent produced the correct RFC 8785 canonical JSON and SHA256 hash, and FLOP independently confirmed both.", "FLOP ajana yeni bir JSON belgesi verdi. Ajan doğru RFC 8785 canonical JSON'u ve SHA256 hashini üretti, FLOP da ikisini bağımsız olarak doğruladı."),
  );
  addRow(
    rows,
    copy("Certificate issued", "Sertifika verildi"),
    copy("This capability now has its own verifiable FLOP certificate and signed receipt.", "Bu yeteneğin artık doğrulanabilir FLOP sertifikası ve imzalı receipt'i var."),
  );

  technical.hidden = false;
  byId("capability-2-summary-technical-title").textContent = copy("How was it verified technically?", "Teknik olarak nasıl doğrulandı?");
  const lines = byId("capability-2-summary-technical-lines");
  lines.replaceChildren();
  addTechnicalLine(lines, copy("Challenge:", "Challenge:"), copy("A fresh one-time JSON document was generated for this DID.", "Bu DID için tek kullanımlık yeni bir JSON belgesi üretildi."));
  addTechnicalLine(lines, copy("Agent result:", "Ajan sonucu:"), copy("The installed capability produced RFC 8785 canonical JSON and the SHA256 digest of its UTF-8 bytes.", "Yüklü yetenek RFC 8785 canonical JSON'u ve UTF-8 byte'larının SHA256 digestini üretti."));
  addTechnicalLine(lines, copy("FLOP check:", "FLOP kontrolü:"), copy("The deterministic verifier independently recomputed both values. The results matched.", "Deterministik verifier iki değeri de bağımsız olarak yeniden hesapladı. Sonuçlar eşleşti."));
}

function localizeStaticSurface() {
  const programLabel = document.querySelector("#active-actions > .step-label");
  if (programLabel) programLabel.textContent = copy("CAPABILITY CERTIFICATION", "YETENEK SERTİFİKASYONU");
  const summary = byId("capability-2-use")?.querySelector("summary");
  if (summary) summary.textContent = copy("Use this capability inside FLOP", "Bu yeteneği FLOP içinde kullan");
  const button = byId("use-capability-2-run");
  if (button) button.textContent = copy("Canonicalize + SHA256", "Canonical hale getir + SHA256");
}

if (byId("capability-2-status")) {
  ensureSurface();
  localizeStaticSurface();
  render();
  const observer = new MutationObserver(() => {
    localizeStaticSurface();
    render();
  });
  observer.observe(byId("capability-2-status"), { childList: true, subtree: true });
  document.querySelectorAll(".lang-button").forEach((button) => {
    button.addEventListener("click", () => setTimeout(() => {
      localizeStaticSurface();
      render();
    }, 0));
  });
}
