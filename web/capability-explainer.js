import { getLanguage } from "/i18n.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const byId = (id) => document.getElementById(id);
const copy = (en, tr) => (getLanguage() === "tr" ? tr : en);

/**
 * Persistent product surface for the most recently certified capability.
 * Live verification remains owned by verification-flow.js. This surface is
 * rendered only after page load when the live flow is not visible, so it never
 * fakes or replays progress. It reconstructs the finished proof from FLOP's
 * public certificate and signed receipt verification APIs.
 */
const CAPABILITIES = [
  {
    number: 1,
    practiceResultId: "practice-result",
    statusId: "capability-1-status",
    certificateLinkId: "capability-1-certificate",
    flowId: "capability-1-flow",
    name: "Ed25519 Signature Verification",
    added: {
      en: "Your agent can now verify whether an Ed25519 signature really belongs to the supplied key and message inside FLOP.",
      tr: "Ajanın artık FLOP içinde bir Ed25519 imzasının verilen anahtar ve mesaja gerçekten ait olup olmadığını doğrulayabiliyor.",
    },
    challenge: {
      en: "FLOP issued a fresh one-time public key, message and signature challenge for this DID.",
      tr: "FLOP bu DID için tek kullanımlık yeni bir public key, mesaj ve imza challenge'ı üretti.",
    },
    execution: {
      en: "The installed signature verification capability evaluated the fresh challenge and produced its result.",
      tr: "Yüklü imza doğrulama capability'si fresh challenge'ı değerlendirdi ve sonucunu üretti.",
    },
  },
  {
    number: 2,
    practiceResultId: "practice-result-2",
    statusId: "capability-2-status",
    certificateLinkId: "capability-2-certificate",
    flowId: "capability-2-flow",
    name: "Canonical JSON + SHA256",
    added: {
      en: "Your agent can now produce deterministic RFC 8785 canonical JSON and its SHA256 fingerprint inside FLOP.",
      tr: "Ajanın artık FLOP içinde deterministik RFC 8785 canonical JSON ve onun SHA256 parmak izini üretebiliyor.",
    },
    challenge: {
      en: "FLOP issued a fresh one-time JSON document for this DID.",
      tr: "FLOP bu DID için tek kullanımlık yeni bir JSON belgesi üretti.",
    },
    execution: {
      en: "The installed canonical JSON capability transformed the fresh input and calculated its SHA256 digest.",
      tr: "Yüklü canonical JSON capability'si fresh girdiyi dönüştürdü ve SHA256 özetini hesapladı.",
    },
  },
  {
    number: 3,
    practiceResultId: "practice-result-3",
    statusId: "capability-3-status",
    certificateLinkId: "capability-3-certificate",
    flowId: "capability-3-flow",
    name: "Technocore Canonical Message",
    added: {
      en: "Your agent can now build Technocore's exact canonical signing message inside FLOP.",
      tr: "Ajanın artık FLOP içinde Technocore'un tam canonical imzalama mesajını oluşturabiliyor.",
    },
    challenge: {
      en: "FLOP issued a fresh room, nonce and raw message challenge for this DID.",
      tr: "FLOP bu DID için fresh room, nonce ve ham mesaj challenge'ı üretti.",
    },
    execution: {
      en: "The installed Technocore capability cleaned the input and built the canonical signing message.",
      tr: "Yüklü Technocore capability'si girdiyi temizledi ve canonical imzalama mesajını oluşturdu.",
    },
  },
  {
    number: 4,
    practiceResultId: "practice-result-4",
    statusId: "capability-4-status",
    certificateLinkId: "capability-4-certificate",
    flowId: "capability-4-flow",
    name: "Signed Receipt Verification",
    added: {
      en: "Your agent can now independently verify FLOP signed receipts and capability evidence inside FLOP.",
      tr: "Ajanın artık FLOP içinde imzalı receipt ve capability kanıtlarını bağımsız olarak doğrulayabiliyor.",
    },
    challenge: {
      en: "FLOP issued a fresh signed receipt and a bounded server-key set, including tampered or unknown-key cases.",
      tr: "FLOP fresh bir imzalı receipt ve sınırlı sunucu anahtar kümesi verdi; değiştirilmiş veya bilinmeyen anahtar durumları da challenge'a dahil edildi.",
    },
    execution: {
      en: "The installed receipt verification capability classified the fresh evidence as valid, invalid or unknown and identified the applicable key state.",
      tr: "Yüklü receipt verification capability'si fresh kanıtı valid, invalid veya unknown olarak sınıflandırdı ve ilgili anahtar durumunu belirledi.",
    },
  },
];

const proofCache = new Map();

function isCertified(config) {
  return ["Certified", "Sertifikalı"].includes(byId(config.statusId)?.textContent ?? "");
}

function latestCertifiedNumber() {
  return CAPABILITIES.filter(isCertified).reduce((latest, config) => Math.max(latest, config.number), 0);
}

function certificateIdFromLink(config) {
  const link = byId(config.certificateLinkId);
  if (!link || link.hidden) return null;
  return link.getAttribute("href")?.match(/^\/certificate\/([^/]+)$/)?.[1] ?? null;
}

async function fetchProof(certificateId) {
  if (!certificateId) return null;
  if (proofCache.has(certificateId)) return proofCache.get(certificateId);

  const promise = (async () => {
    const certificateResponse = await fetch(API_BASE + "/api/v1/certificates/" + encodeURIComponent(certificateId));
    if (!certificateResponse.ok) throw new Error("CERTIFICATE_PROOF_UNAVAILABLE");
    const certificateBody = await certificateResponse.json();
    const certificate = certificateBody.certificate;
    const receiptId = certificate?.receipt_id;
    if (!receiptId) throw new Error("CERTIFICATE_RECEIPT_MISSING");

    const verificationResponse = await fetch(API_BASE + "/api/v1/verification/" + encodeURIComponent(receiptId));
    if (!verificationResponse.ok) throw new Error("RECEIPT_PROOF_UNAVAILABLE");
    const verification = await verificationResponse.json();

    return {
      certificate,
      certificateVerification: certificateBody.receipt_verification,
      receipt: verification.receipt,
      serverKey: verification.server_key,
    };
  })();

  proofCache.set(certificateId, promise);
  try {
    return await promise;
  } catch (error) {
    proofCache.delete(certificateId);
    throw error;
  }
}

function text(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function detailRow(label, value) {
  const row = document.createElement("div");
  row.className = "flow-detail-row";
  row.append(
    text("span", "flow-detail-label", label),
    text("span", "flow-detail-value mono", String(value ?? "")),
  );
  return row;
}

function eventStep({ step, number, kicker, title, summary, details = [], time = "" }) {
  const item = document.createElement("li");
  item.className = "flow-step";
  item.dataset.step = step;
  item.dataset.state = "done";

  const rail = document.createElement("div");
  rail.className = "flow-rail";
  const marker = text("span", "flow-marker", step === "verdict" || step === "certificate" ? "✓" : String(number));
  marker.setAttribute("aria-hidden", "true");
  rail.appendChild(marker);

  const card = document.createElement("div");
  card.className = "flow-event-card";
  const top = document.createElement("div");
  top.className = "flow-event-top";
  top.append(text("span", "flow-kicker", kicker), text("time", "flow-time mono", time));
  card.append(top, text("strong", "flow-title", title), text("p", "flow-summary", summary));

  if (details.length) {
    const detailsNode = document.createElement("div");
    detailsNode.className = "flow-event-details";
    for (const [label, value] of details) detailsNode.appendChild(detailRow(label, value));
    card.appendChild(detailsNode);
  }

  item.append(rail, card);
  return item;
}

function proofCard(icon, title, description, value) {
  const card = document.createElement("div");
  card.className = "flow-proof-card";
  card.dataset.state = "ready";
  card.appendChild(text("span", "flow-proof-icon", icon));
  const body = document.createElement("div");
  body.className = "flow-proof-body";
  body.append(
    text("strong", "flow-proof-title", title),
    text("span", "flow-proof-description", description),
    text("span", "flow-proof-value mono", value),
  );
  card.append(body, text("span", "flow-proof-seal", "✓"));
  return card;
}

function ensureSurface(config) {
  const id = `capability-${config.number}-explanation`;
  let section = byId(id);
  if (section) return section;

  section = document.createElement("section");
  section.id = id;
  section.className = "verification-flow certified-proof-surface";
  section.hidden = true;

  const practiceResult = byId(config.practiceResultId);
  const liveFlow = byId(config.flowId);
  if (liveFlow) liveFlow.insertAdjacentElement("afterend", section);
  else practiceResult?.insertAdjacentElement("afterend", section);
  return section;
}

function renderProofSurface(config, section, proof) {
  const certificate = proof.certificate;
  const receipt = proof.receipt;
  const attestation = proof.certificateVerification?.signature_status ?? "available";
  const issued = certificate.issued_at ?? receipt.issued_at ?? "";

  const shell = document.createElement("div");
  shell.className = "flow-shell";

  const header = document.createElement("header");
  header.className = "flow-header";
  const headerCopy = document.createElement("div");
  headerCopy.append(
    text("div", "flow-eyebrow", copy("VERIFIED CAPABILITY", "DOĞRULANMIŞ CAPABILITY")),
    text("h3", "flow-heading", `Capability ${config.number} · ${config.name}`),
    text("p", "flow-intro", config.added[getLanguage() === "tr" ? "tr" : "en"]),
  );
  const verified = document.createElement("div");
  verified.className = "flow-live";
  verified.append(text("span", "flow-live-dot", ""), text("span", "", copy("Verified", "Doğrulandı")));
  header.append(headerCopy, verified);

  const layout = document.createElement("div");
  layout.className = "flow-layout";

  const timeline = document.createElement("div");
  timeline.className = "flow-timeline-panel";
  const list = document.createElement("ol");
  list.className = "flow-steps";

  list.append(
    eventStep({
      step: "challenge",
      number: 1,
      kicker: "FRESH INPUT",
      title: copy("Fresh challenge created", "Fresh challenge oluşturuldu"),
      summary: config.challenge[getLanguage() === "tr" ? "tr" : "en"],
      details: [
        [copy("Challenge hash", "Challenge hash"), receipt.challenge_hash],
        [copy("Trial", "Trial"), `${receipt.trial_id} @ ${receipt.trial_version}`],
      ],
    }),
    eventStep({
      step: "execute",
      number: 2,
      kicker: copy("AGENT EXECUTION", "AJAN ÇALIŞMASI"),
      title: copy("Capability executed", "Capability çalıştı"),
      summary: config.execution[getLanguage() === "tr" ? "tr" : "en"],
      details: [[copy("Capability", "Capability"), certificate.capability_id]],
    }),
    eventStep({
      step: "result",
      number: 3,
      kicker: "CAPABILITY OUTPUT",
      title: copy("Output committed", "Output kaydedildi"),
      summary: copy(
        "The agent's capability output was committed into the signed verification evidence.",
        "Ajanın capability çıktısı imzalı doğrulama kanıtına kaydedildi.",
      ),
      details: [[copy("Result hash", "Result hash"), receipt.result_hash]],
    }),
    eventStep({
      step: "sign",
      number: 4,
      kicker: copy("IDENTITY BINDING", "KİMLİK BAĞI"),
      title: copy("Bound to agent DID", "Ajan DID'ine bağlandı"),
      summary: copy(
        "The verification evidence is bound to the DID that owns this FLOP agent.",
        "Doğrulama kanıtı bu FLOP ajanının sahibi olan DID'e bağlıdır.",
      ),
      details: [[copy("Agent DID", "Ajan DID"), certificate.agent_did]],
    }),
    eventStep({
      step: "verify",
      number: 5,
      kicker: copy("INDEPENDENT CHECK", "BAĞIMSIZ KONTROL"),
      title: copy("FLOP verified independently", "FLOP bağımsız doğruladı"),
      summary: copy(
        "FLOP independently recomputed the expected result and verified the signed evidence.",
        "FLOP beklenen sonucu bağımsız olarak yeniden hesapladı ve imzalı kanıtı doğruladı.",
      ),
      details: [
        [copy("Verifier", "Verifier"), `${receipt.verifier_id} @ ${receipt.verifier_version}`],
        [copy("Attestation", "Attestation"), attestation],
      ],
    }),
    eventStep({
      step: "verdict",
      number: 6,
      kicker: copy("VERDICT", "KARAR"),
      title: copy("Verifier decision · PASS", "Verifier kararı · PASS"),
      summary: copy(
        "The agent's result matched FLOP's independently computed expected result.",
        "Ajanın sonucu FLOP'un bağımsız hesapladığı beklenen sonuçla eşleşti.",
      ),
      details: [
        [copy("Verdict", "Karar"), receipt.verdict],
        [copy("Receipt", "Receipt"), receipt.receipt_id],
      ],
    }),
    eventStep({
      step: "certificate",
      number: 7,
      kicker: copy("PROOF ISSUED", "KANIT ÜRETİLDİ"),
      title: copy("Capability certificate issued", "Capability certificate oluşturuldu"),
      summary: copy(
        "FLOP issued an individual certificate for this capability version and linked it to the signed receipt.",
        "FLOP bu capability sürümü için ayrı bir certificate üretti ve imzalı receipt'e bağladı.",
      ),
      details: [
        [copy("Certificate", "Certificate"), certificate.certificate_id],
        [copy("Capability version", "Capability sürümü"), certificate.capability_version],
      ],
      time: issued,
    }),
  );
  timeline.appendChild(list);

  const aside = document.createElement("aside");
  aside.className = "flow-proof-panel";
  aside.append(
    text("div", "flow-eyebrow", copy("PROOF PACKAGE", "KANIT PAKETİ")),
    text("h4", "flow-proof-heading", copy("What you own after PASS", "PASS sonrası elinde ne var?")),
    text("p", "flow-proof-intro", copy(
      "The capability remains executable inside FLOP. The proof can travel outside FLOP.",
      "Capability FLOP içinde çalışmaya devam eder. Kanıt ise FLOP dışına taşınabilir.",
    )),
  );

  const cards = document.createElement("div");
  cards.className = "flow-proof-cards";
  cards.append(
    proofCard("◇", copy("Capability certificate", "Capability certificate"), copy("Individual proof for this capability", "Bu capability'ye özel bireysel kanıt"), certificate.certificate_id),
    proofCard("▤", copy("Signed receipt", "İmzalı receipt"), copy("Immutable verification evidence", "Değiştirilemez doğrulama kanıtı"), receipt.receipt_id),
    proofCard("◎", copy("Public proof", "Public proof"), copy("Portable and independently checkable", "Taşınabilir ve bağımsız kontrol edilebilir"), `/certificate/${certificate.certificate_id}`),
  );
  aside.appendChild(cards);

  const boundary = document.createElement("div");
  boundary.className = "flow-boundary";
  boundary.append(
    text("strong", "", copy("Execution boundary", "Çalıştırma sınırı")),
    text("p", "", copy(
      "This capability is active on your FLOP agent and runs inside FLOP. DID, certificate, receipt and public proof are portable. Public agent execution is not exposed.",
      "Bu capability FLOP ajanında aktiftir ve FLOP içinde çalışır. DID, certificate, receipt ve public proof taşınabilir. Ajanın public execution'ı dışarı açılmaz.",
    )),
  );
  aside.appendChild(boundary);

  const why = document.createElement("div");
  why.className = "flow-why";
  why.appendChild(text("strong", "", copy("Why PASS?", "Neden PASS?")));
  const whyList = document.createElement("ul");
  for (const item of [
    copy("Capability acquired inside FLOP", "Capability FLOP içinde kazanıldı"),
    copy("Fresh challenge solved", "Fresh challenge çözüldü"),
    copy("DID-bound evidence verified", "DID'e bağlı kanıt doğrulandı"),
    copy("Independent deterministic verifier returned PASS", "Bağımsız deterministik verifier PASS verdi"),
  ]) whyList.appendChild(text("li", "", item));
  why.appendChild(whyList);
  aside.appendChild(why);

  layout.append(timeline, aside);

  const footer = document.createElement("div");
  footer.className = "flow-footer";
  footer.append(
    text("span", "flow-footer-pulse", ""),
    text("span", "", copy(
      "Loaded from the signed certificate and receipt. Recorded proof, not a replay animation.",
      "İmzalı certificate ve receipt'ten yüklendi. Bu kayıtlı kanıttır, sahte replay animasyonu değildir.",
    )),
  );

  shell.append(header, layout, footer);
  section.replaceChildren(shell);
}

async function renderOne(config) {
  const section = ensureSurface(config);
  if (!section) return;

  const shouldShow = isCertified(config) && config.number === latestCertifiedNumber();
  const liveFlow = byId(config.flowId);
  if (!shouldShow || (liveFlow && !liveFlow.hidden)) {
    section.hidden = true;
    return;
  }

  const certificateId = certificateIdFromLink(config);
  if (!certificateId) {
    section.hidden = true;
    return;
  }

  try {
    const proof = await fetchProof(certificateId);
    if (!proof) return;
    if (!isCertified(config) || config.number !== latestCertifiedNumber() || (liveFlow && !liveFlow.hidden)) return;
    renderProofSurface(config, section, proof);
    section.hidden = false;
  } catch {
    section.hidden = true;
  }
}

function renderAll() {
  for (const config of CAPABILITIES) void renderOne(config);
}

function watchMainPage() {
  if (!byId("active-actions")) return;
  for (const config of CAPABILITIES) ensureSurface(config);
  renderAll();

  const observer = new MutationObserver(renderAll);
  for (const config of CAPABILITIES) {
    const status = byId(config.statusId);
    const certificateLink = byId(config.certificateLinkId);
    const flow = byId(config.flowId);
    if (status) observer.observe(status, { childList: true, subtree: true });
    if (certificateLink) observer.observe(certificateLink, { attributes: true, attributeFilter: ["hidden", "href"] });
    if (flow) observer.observe(flow, { attributes: true, attributeFilter: ["hidden"] });
  }
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
}

watchMainPage();
