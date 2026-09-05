import { getLanguage } from "/i18n.js";
import { createVerificationCeremony } from "/verification-ceremony.js";

function loadProductShellStyle() {
  if (document.getElementById("flop-product-shell-style")) return;
  const link = document.createElement("link");
  link.id = "flop-product-shell-style";
  link.rel = "stylesheet";
  link.href = "/app-shell.css?v=workspace-shell-v3";
  document.head.appendChild(link);
}

loadProductShellStyle();
void import("/app-shell.js?v=workspace-shell-v3");
void import("/app-shell-navigation.js?v=workspace-navigation-v11");

const API_BASE = "https://flop-status-production.up.railway.app";
const replayScenes = new Map();

function copy(en, tr) {
  return getLanguage() === "tr" ? tr : en;
}

const CEREMONY_COPY_PAIRS = [
  ["MY AGENT / LIVE VERIFICATION", "AJANIM / CANLI DOĞRULAMA"],
  ["Watch real verification events become portable proof.", "Gerçek doğrulama eventlerinin taşınabilir kanıta dönüşmesini izle."],
  ["REAL EVENTS", "GERÇEK EVENTLER"],
  ["Unseen test input", "Daha önce görülmemiş test girdisi"],
  ["YOUR FLOP PROOF AGENT", "FLOP PROOF AJANIN"],
  ["Agent Core", "Ajan Core"],
  ["Independent verifier", "Bağımsız verifier"],
  ["INSTALLED", "YÜKLÜ"],
  ["EXECUTED", "ÇALIŞTI"],
  ["CREATED", "OLUŞTU"],
  ["Capability result", "Capability sonucu"],
  ["AGENT RESULT", "AJAN SONUCU"],
  ["FLOP PROOF RESULT", "FLOP PROOF SONUCU"],
  ["WAITING", "BEKLİYOR"],
  ["COMPARING", "KARŞILAŞTIRILIYOR"],
  ["RESULTS MATCH", "SONUÇLAR EŞLEŞTİ"],
  ["RESULTS DO NOT MATCH", "SONUÇLAR EŞLEŞMEDİ"],
  ["This Flop Proof agent used the installed capability successfully on a fresh verification challenge.", "Bu Flop Proof ajanı yüklü capability'yi fresh verification challenge üzerinde başarıyla kullandı."],
  ["PROOF CAN LEAVE FLOP PROOF", "KANIT FLOP PROOF DIŞINA ÇIKABİLİR"],
  ["Execution stays. Proof travels.", "Çalıştırma kalır. Kanıt taşınır."],
  ["STAYS INSIDE FLOP PROOF", "FLOP PROOF İÇİNDE KALIR"],
  ["Agent Core + Capability", "Ajan Core + Capability"],
  ["PORTABLE PROOF", "TAŞINABİLİR KANIT"],
  ["SYSTEM EVENT", "SİSTEM EVENTİ"],
  ["Waiting for verification to start", "Doğrulamanın başlaması bekleniyor"],
  ["present", "mevcut"],

  ["Decode key", "Anahtarı çöz"],
  ["Bind message", "Mesajı bağla"],
  ["Check signature", "İmzayı doğrula"],
  ["Normalize JSON", "JSON normalize et"],
  ["Build canonical form", "Canonical biçimi üret"],
  ["Encode bytes", "Byte dizisini üret"],
  ["Calculate digest", "Digest hesapla"],
  ["Clean text", "Metni temizle"],
  ["Bind room", "Room bağla"],
  ["Bind nonce", "Nonce bağla"],
  ["Build message", "Mesajı üret"],
  ["Match key id", "Key ID eşleştir"],
  ["Check payload", "Payload kontrol et"],
  ["Classify receipt", "Receipt sınıflandır"],
  ["Read source paths", "Kaynak path'leri oku"],
  ["Apply operations", "Operasyonları uygula"],
  ["Coerce types", "Tipleri dönüştür"],
  ["Build result", "Sonucu oluştur"],
  ["Read input document", "Girdi belgesini oku"],
  ["Evaluate rules in order", "Kuralları sırayla değerlendir"],
  ["Collect violations", "İhlalleri topla"],
  ["Build compliance result", "Uyumluluk sonucunu oluştur"],
  ["Process attempts in order", "Denemeleri sırayla işle"],
  ["Retry on transient failure", "Geçici hatada yeniden dene"],
  ["Apply operation once", "Operasyonu bir kez uygula"],
  ["Absorb duplicate delivery", "Tekrar teslimatı absorbe et"],
];

function localizeCeremonyDom(flow) {
  if (!flow) return;
  const tr = getLanguage() === "tr";
  const dictionary = new Map();
  for (const [en, trText] of CEREMONY_COPY_PAIRS) {
    dictionary.set(en, tr ? trText : en);
    dictionary.set(trText, tr ? trText : en);
  }

  flow.querySelectorAll(".ceremony-shell *").forEach((element) => {
    if (element.children.length !== 0) return;
    const value = element.textContent?.trim() ?? "";
    const translated = dictionary.get(value);
    if (translated !== undefined) element.textContent = translated;

    if (element.classList.contains("ceremony-seal-detail")) {
      const raw = element.textContent ?? "";
      if (tr && raw.startsWith("signed  ")) element.textContent = `imzalı  ${raw.slice("signed  ".length)}`;
      if (!tr && raw.startsWith("imzalı  ")) element.textContent = `signed  ${raw.slice("imzalı  ".length)}`;
    }
  });

  const running = flow.dataset.verificationRunning;
  const recorded = running === "recorded";
  const breadcrumb = flow.querySelector(".ceremony-breadcrumb");
  const subtitle = flow.querySelector(".ceremony-subtitle");
  const live = flow.querySelector(".ceremony-live span:last-child");
  if (recorded) {
    if (breadcrumb) breadcrumb.textContent = tr ? "AJANIM  /  KAYITLI DOĞRULAMA" : "MY AGENT  /  RECORDED VERIFICATION";
    if (subtitle) subtitle.textContent = tr
      ? "Bu sahne saklanan gerçek certificate ve receipt kanıtını yeniden oynatır. Canlı test değildir."
      : "This scene replays the stored certificate and receipt evidence. It is not a live test.";
    if (live) live.textContent = tr ? "KAYITLI KANIT" : "RECORDED PROOF";
  } else {
    if (breadcrumb) breadcrumb.textContent = tr ? "AJANIM / CANLI DOĞRULAMA" : "MY AGENT / LIVE VERIFICATION";
    if (subtitle) subtitle.textContent = tr
      ? "Gerçek doğrulama eventlerinin taşınabilir kanıta dönüşmesini izle."
      : "Watch real verification events become portable proof.";
    if (live) live.textContent = tr ? "GERÇEK EVENTLER" : "REAL EVENTS";
  }
}

function configFor(number) {
  return {
    number,
    status: document.getElementById(`capability-${number}-status`),
    certificate: document.getElementById(`capability-${number}-certificate`),
    flow: document.getElementById(`capability-${number}-flow`),
  };
}

function certificateId(link) {
  if (!link || link.hidden) return null;
  return link.getAttribute("href")?.match(/^\/certificate\/([^/]+)$/)?.[1] ?? null;
}

function isCertified(config) {
  return ["Certified", "Sertifikalı"].includes(config.status?.textContent?.trim() ?? "") && Boolean(certificateId(config.certificate));
}

function closeReplay(config, button) {
  replayScenes.get(config.number)?.destroy();
  replayScenes.delete(config.number);
  if (config.flow) {
    delete config.flow.dataset.verificationRunning;
    config.flow.hidden = true;
    config.flow.replaceChildren();
  }
  if (button) button.textContent = copy("Watch verification record", "Doğrulama kaydını izle");
}

async function loadStoredProof(id) {
  const certificateResponse = await fetch(`${API_BASE}/api/v1/certificates/${encodeURIComponent(id)}`);
  if (!certificateResponse.ok) throw new Error("CERTIFICATE_PROOF_UNAVAILABLE");
  const certificateBody = await certificateResponse.json();
  const certificate = certificateBody.certificate;
  if (!certificate?.receipt_id) throw new Error("CERTIFICATE_RECEIPT_MISSING");

  const receiptResponse = await fetch(`${API_BASE}/api/v1/verification/${encodeURIComponent(certificate.receipt_id)}`);
  if (!receiptResponse.ok) throw new Error("RECEIPT_PROOF_UNAVAILABLE");
  const receiptBody = await receiptResponse.json();

  return {
    certificate,
    receipt: receiptBody.receipt,
    attestation: certificateBody.receipt_verification?.signature_status ?? "VALID",
  };
}

function labelRecordedScene(flow) {
  localizeCeremonyDom(flow);
}

async function replayStoredVerification(config, button) {
  if (!config.flow) return;
  if (replayScenes.has(config.number)) {
    closeReplay(config, button);
    return;
  }

  const id = certificateId(config.certificate);
  if (!id) return;
  button.disabled = true;
  button.textContent = copy("Loading proof…", "Kanıt yükleniyor…");

  try {
    const proof = await loadStoredProof(id);
    const card = config.flow.closest(".capability-card");
    const name = card?.querySelector(".trial-copy strong")?.textContent?.trim() || `Capability ${config.number}`;
    const capabilityId = card?.querySelector(".trial-capability")?.textContent?.trim() || proof.certificate.capability_id || "";

    config.flow.dataset.verificationRunning = "recorded";
    const ceremony = createVerificationCeremony(config.flow, {
      number: config.number,
      name,
      capabilityId,
    });
    replayScenes.set(config.number, ceremony);
    ceremony.reset();
    labelRecordedScene(config.flow);

    const receipt = proof.receipt ?? {};
    ceremony.setChallenge(null, {
      challengeId: receipt.challenge_id,
      challengeHash: receipt.challenge_hash,
    });
    ceremony.setIdentity(proof.certificate.agent_did);
    ceremony.setResult({
      result_hash: receipt.result_hash,
      verdict: receipt.verdict,
      verifier: receipt.verifier_id,
      evidence: copy("Stored signed receipt", "Saklanan imzalı receipt"),
    });
    ceremony.setResultHash(receipt.result_hash);
    ceremony.setVerifier(receipt.verifier_id, receipt.verifier_version);
    ceremony.setDecision({
      verdict: receipt.verdict,
      result_hash: receipt.result_hash,
      receipt_id: receipt.receipt_id,
      certificate_id: proof.certificate.certificate_id,
      verifier_id: receipt.verifier_id,
      verifier_version: receipt.verifier_version,
    });

    ceremony.complete("challenge", {
      en: "The stored proof identifies the fresh challenge used for this certification.",
      tr: "Saklanan kanıt bu sertifikasyonda kullanılan fresh challenge'ı tanımlıyor.",
    });
    ceremony.complete("execute", {
      en: "The installed capability produced the result recorded in this proof.",
      tr: "Yüklü capability bu kanıtta kayıtlı sonucu üretti.",
    });
    ceremony.complete("result", {
      en: "The agent output was committed to the signed verification evidence.",
      tr: "Ajan çıktısı imzalı doğrulama kanıtına kaydedildi.",
    });
    ceremony.complete("sign", {
      en: "The submission was bound to this agent DID.",
      tr: "Submission bu ajan DID'ine bağlandı.",
    });
    ceremony.complete("verify", {
      en: "Flop Proof independently verified the stored submission evidence.",
      tr: "Flop Proof saklanan submission kanıtını bağımsız olarak doğruladı.",
    });

    if (receipt.verdict === "PASS") {
      ceremony.complete("verdict", { en: "The recorded verifier decision is PASS.", tr: "Kayıtlı verifier kararı PASS." });
      ceremony.complete("certificate", { en: "This PASS produced the stored individual capability certificate.", tr: "Bu PASS kayıtlı bireysel capability certificate'ını üretti." });
    } else {
      ceremony.fail("verdict", { en: `Recorded verdict: ${receipt.verdict ?? "UNKNOWN"}`, tr: `Kayıtlı karar: ${receipt.verdict ?? "UNKNOWN"}` });
    }

    config.flow.scrollIntoView({ behavior: "smooth", block: "center" });
    button.textContent = copy("Close verification record", "Doğrulama kaydını kapat");
  } catch (error) {
    delete config.flow.dataset.verificationRunning;
    config.flow.hidden = true;
    button.textContent = copy("Proof unavailable", "Kanıt yüklenemedi");
    button.title = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
}

function ensureReplayButton(config) {
  if (!config.certificate) return;
  let button = document.getElementById(`replay-capability-${config.number}`);
  if (!button) {
    button = document.createElement("button");
    button.id = `replay-capability-${config.number}`;
    button.type = "button";
    button.className = "secondary verification-replay-button";
    button.addEventListener("click", () => void replayStoredVerification(configFor(config.number), button));
    config.certificate.insertAdjacentElement("afterend", button);
  }
  button.hidden = !isCertified(config);
  if (!replayScenes.has(config.number)) button.textContent = copy("Watch verification record", "Doğrulama kaydını izle");
}

function keepCertifiedProofCompact() {
  const active = document.getElementById("active-actions");
  if (!active) return;

  for (const number of [1, 2, 3, 4, 5, 6, 7]) {
    const config = configFor(number);
    if (config.flow && !config.flow.dataset.verificationRunning) config.flow.hidden = true;
    ensureReplayButton(config);
    replayScenes.get(number)?.localize();
    localizeCeremonyDom(config.flow);
  }
}

keepCertifiedProofCompact();

const observer = new MutationObserver(keepCertifiedProofCompact);
for (const number of [1, 2, 3, 4, 5, 6, 7]) {
  const config = configFor(number);
  if (config.status) observer.observe(config.status, { childList: true, subtree: true });
  if (config.certificate) observer.observe(config.certificate, { attributes: true, attributeFilter: ["hidden", "href"] });
}
observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) keepCertifiedProofCompact();
});
