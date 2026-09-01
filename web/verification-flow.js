/**
 * Shared verification run surface for every production capability.
 *
 * Progress is event-bound. A visual step changes only when the real operation
 * represented by that step begins or resolves. No timer advances the run.
 */

const STEP_IDS = ["challenge", "execute", "result", "sign", "verify", "verdict", "certificate"];

const STEP_TITLES = {
  challenge: ["Fresh challenge created", "Fresh challenge oluşturuldu"],
  execute: ["Capability executed", "Capability çalıştı"],
  result: ["Output produced", "Output üretildi"],
  sign: ["Signed with agent DID", "Ajan DID'i ile imzalandı"],
  verify: ["FLOP verified independently", "FLOP bağımsız doğruladı"],
  verdict: ["Verifier decision", "Verifier kararı"],
  certificate: ["Certificate issued", "Certificate oluşturuldu"],
};

const STEP_KICKERS = {
  challenge: ["FRESH INPUT", "FRESH INPUT"],
  execute: ["AGENT EXECUTION", "AJAN ÇALIŞMASI"],
  result: ["CAPABILITY OUTPUT", "CAPABILITY OUTPUT"],
  sign: ["IDENTITY BINDING", "KİMLİK BAĞI"],
  verify: ["INDEPENDENT CHECK", "BAĞIMSIZ KONTROL"],
  verdict: ["VERDICT", "KARAR"],
  certificate: ["PROOF ISSUED", "KANIT ÜRETİLDİ"],
};

function language() {
  return document.documentElement.lang === "tr" ? "tr" : "en";
}

function copy(en, tr) {
  return language() === "tr" ? tr : en;
}

function timestamp() {
  return new Intl.DateTimeFormat(language() === "tr" ? "tr-TR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function truncate(value, size = 26) {
  const text = String(value ?? "");
  if (text.length <= size) return text;
  return `${text.slice(0, Math.max(8, size - 8))}…${text.slice(-7)}`;
}

function makeProofCard(kind, titleCopy, descriptionCopy) {
  const card = document.createElement("div");
  card.className = "flow-proof-card";
  card.dataset.proof = kind;
  card.dataset.state = "pending";

  const icon = document.createElement("span");
  icon.className = "flow-proof-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = kind === "certificate" ? "◇" : kind === "receipt" ? "▤" : kind === "public" ? "◎" : "○";

  const body = document.createElement("div");
  body.className = "flow-proof-body";
  const title = document.createElement("strong");
  title.className = "flow-proof-title";
  const description = document.createElement("span");
  description.className = "flow-proof-description";
  const value = document.createElement("span");
  value.className = "flow-proof-value mono";
  body.append(title, description, value);

  const seal = document.createElement("span");
  seal.className = "flow-proof-seal";
  seal.setAttribute("aria-hidden", "true");
  seal.textContent = "✓";

  card.append(icon, body, seal);
  return { card, title, description, value, titleCopy, descriptionCopy };
}

export function createVerificationFlow(container) {
  const steps = new Map();
  const technicalRows = [];

  const shell = document.createElement("div");
  shell.className = "flow-shell";

  const header = document.createElement("header");
  header.className = "flow-header";
  const headerCopy = document.createElement("div");
  const eyebrow = document.createElement("div");
  eyebrow.className = "flow-eyebrow";
  const heading = document.createElement("h3");
  heading.className = "flow-heading";
  const intro = document.createElement("p");
  intro.className = "flow-intro";
  headerCopy.append(eyebrow, heading, intro);

  const live = document.createElement("div");
  live.className = "flow-live";
  const liveDot = document.createElement("span");
  liveDot.className = "flow-live-dot";
  const liveText = document.createElement("span");
  live.append(liveDot, liveText);
  header.append(headerCopy, live);

  const layout = document.createElement("div");
  layout.className = "flow-layout";

  const timeline = document.createElement("div");
  timeline.className = "flow-timeline-panel";
  const list = document.createElement("ol");
  list.className = "flow-steps";

  STEP_IDS.forEach((stepId, index) => {
    const item = document.createElement("li");
    item.className = "flow-step";
    item.dataset.step = stepId;
    item.dataset.state = "pending";
    if (stepId === "certificate") item.hidden = true;

    const rail = document.createElement("div");
    rail.className = "flow-rail";
    const marker = document.createElement("span");
    marker.className = "flow-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = String(index + 1);
    rail.appendChild(marker);

    const card = document.createElement("div");
    card.className = "flow-event-card";

    const top = document.createElement("div");
    top.className = "flow-event-top";
    const kicker = document.createElement("span");
    kicker.className = "flow-kicker";
    const time = document.createElement("time");
    time.className = "flow-time mono";
    top.append(kicker, time);

    const title = document.createElement("strong");
    title.className = "flow-title";
    const summary = document.createElement("p");
    summary.className = "flow-summary";
    const details = document.createElement("div");
    details.className = "flow-event-details";

    card.append(top, title, summary, details);
    item.append(rail, card);
    list.appendChild(item);
    steps.set(stepId, { item, marker, title, summary, kicker, time, details, detailRows: [] });
  });

  timeline.appendChild(list);

  const proof = document.createElement("aside");
  proof.className = "flow-proof-panel";
  const proofEyebrow = document.createElement("div");
  proofEyebrow.className = "flow-eyebrow";
  const proofHeading = document.createElement("h4");
  proofHeading.className = "flow-proof-heading";
  const proofIntro = document.createElement("p");
  proofIntro.className = "flow-proof-intro";
  const proofCards = document.createElement("div");
  proofCards.className = "flow-proof-cards";

  const certificateProof = makeProofCard(
    "certificate",
    { en: "Capability certificate", tr: "Capability certificate" },
    { en: "Issued only after a verified PASS", tr: "Yalnızca doğrulanmış PASS sonrası üretilir" },
  );
  const receiptProof = makeProofCard(
    "receipt",
    { en: "Signed receipt", tr: "İmzalı receipt" },
    { en: "Immutable evidence of this verification", tr: "Bu doğrulamanın değiştirilemez kanıtı" },
  );
  const publicProof = makeProofCard(
    "public",
    { en: "Public proof", tr: "Public proof" },
    { en: "Portable proof. Execution stays inside FLOP.", tr: "Kanıt taşınabilir. Çalıştırma FLOP içinde kalır." },
  );
  proofCards.append(certificateProof.card, receiptProof.card, publicProof.card);

  const boundary = document.createElement("div");
  boundary.className = "flow-boundary";
  const boundaryTitle = document.createElement("strong");
  const boundaryText = document.createElement("p");
  boundary.append(boundaryTitle, boundaryText);

  const why = document.createElement("div");
  why.className = "flow-why";
  const whyTitle = document.createElement("strong");
  const whyList = document.createElement("ul");
  [
    ["Capability acquired inside FLOP", "Capability FLOP içinde kazanıldı"],
    ["Fresh challenge solved", "Fresh challenge çözüldü"],
    ["DID-signed submission verified", "DID imzalı submission doğrulandı"],
    ["Independent verifier returned PASS", "Bağımsız verifier PASS verdi"],
  ].forEach(([en, tr]) => {
    const li = document.createElement("li");
    li.dataset.en = en;
    li.dataset.tr = tr;
    li.textContent = copy(en, tr);
    whyList.appendChild(li);
  });
  why.append(whyTitle, whyList);
  why.hidden = true;

  proof.append(proofEyebrow, proofHeading, proofIntro, proofCards, boundary, why);
  layout.append(timeline, proof);

  const technical = document.createElement("details");
  technical.className = "technical-details flow-technical";
  technical.hidden = true;
  const technicalSummary = document.createElement("summary");
  const technicalLines = document.createElement("div");
  technicalLines.className = "checks";
  technical.append(technicalSummary, technicalLines);

  const footer = document.createElement("div");
  footer.className = "flow-footer";
  const footerPulse = document.createElement("span");
  footerPulse.className = "flow-footer-pulse";
  const footerText = document.createElement("span");
  footer.append(footerPulse, footerText);

  shell.append(header, layout, technical, footer);
  container.replaceChildren(shell);
  container.hidden = true;

  function addStepDetail(stepId, labelCopy, value) {
    const step = steps.get(stepId);
    if (!step) return;
    const row = document.createElement("div");
    row.className = "flow-detail-row";
    const label = document.createElement("span");
    label.className = "flow-detail-label";
    const text = document.createElement("span");
    text.className = "flow-detail-value mono";
    label.textContent = copy(labelCopy.en, labelCopy.tr);
    text.textContent = truncate(value, 44);
    text.title = String(value);
    row.append(label, text);
    step.details.appendChild(row);
    step.detailRows.push({ label, labelCopy });
  }

  function setState(stepId, state, summaryCopy) {
    const step = steps.get(stepId);
    if (!step) return;
    step.item.dataset.state = state;
    if (state === "active" || ["done", "fail", "unknown"].includes(state)) step.time.textContent = timestamp();
    if (summaryCopy !== undefined) {
      step.summaryCopy = summaryCopy;
      step.summary.textContent = copy(summaryCopy.en, summaryCopy.tr);
    }
    if (stepId === "verdict") {
      if (state === "done") {
        step.marker.textContent = "✓";
        why.hidden = false;
      } else if (state === "fail") step.marker.textContent = "×";
      else if (state === "unknown") step.marker.textContent = "?";
    }
    if (stepId === "certificate" && state === "done") {
      certificateProof.card.dataset.state = "ready";
      publicProof.card.dataset.state = "ready";
    }
  }

  function localize() {
    eyebrow.textContent = copy("VERIFICATION RUN", "DOĞRULAMA AKIŞI");
    heading.textContent = copy("Your agent is proving the capability now", "Ajanın capability'yi şimdi kanıtlıyor");
    intro.textContent = copy(
      "Every movement below is tied to a real verification event.",
      "Aşağıdaki her hareket gerçek bir doğrulama olayına bağlıdır.",
    );
    liveText.textContent = copy("Live", "Canlı");

    proofEyebrow.textContent = copy("PROOF PACKAGE", "KANIT PAKETİ");
    proofHeading.textContent = copy("What you receive after PASS", "PASS sonrası elinde ne kalır?");
    proofIntro.textContent = copy(
      "The capability stays executable inside FLOP. Its evidence is portable.",
      "Capability FLOP içinde çalışır. Kanıtları taşınabilir.",
    );
    boundaryTitle.textContent = copy("Execution boundary", "Çalıştırma sınırı");
    boundaryText.textContent = copy(
      "This capability is active on your FLOP agent. DID, certificate, receipt and public proof can leave FLOP; public execution cannot.",
      "Bu capability FLOP ajanında aktiftir. DID, certificate, receipt ve public proof dışarı taşınabilir; public execution dışarı açık değildir.",
    );
    whyTitle.textContent = copy("Why PASS?", "Neden PASS?");
    for (const li of whyList.children) li.textContent = copy(li.dataset.en, li.dataset.tr);

    for (const proofItem of [certificateProof, receiptProof, publicProof]) {
      proofItem.title.textContent = copy(proofItem.titleCopy.en, proofItem.titleCopy.tr);
      proofItem.description.textContent = copy(proofItem.descriptionCopy.en, proofItem.descriptionCopy.tr);
    }

    technicalSummary.textContent = copy("Raw verification details", "Ham doğrulama ayrıntıları");
    footerText.textContent = copy(
      "Real events only. No fake loading, no timer-driven progress.",
      "Yalnızca gerçek eventler. Sahte loading ve timer ile ilerleme yok.",
    );

    for (const [stepId, step] of steps) {
      const [en, tr] = STEP_TITLES[stepId];
      const [kickerEn, kickerTr] = STEP_KICKERS[stepId];
      step.title.textContent = copy(en, tr);
      step.kicker.textContent = copy(kickerEn, kickerTr);
      if (step.summaryCopy) step.summary.textContent = copy(step.summaryCopy.en, step.summaryCopy.tr);
      for (const detail of step.detailRows) detail.label.textContent = copy(detail.labelCopy.en, detail.labelCopy.tr);
    }
    for (const row of technicalRows) row.label.textContent = copy(row.titleCopy.en, row.titleCopy.tr);
  }

  localize();

  return {
    localize,
    reset() {
      container.hidden = false;
      why.hidden = true;
      for (const proofItem of [certificateProof, receiptProof, publicProof]) {
        proofItem.card.dataset.state = "pending";
        proofItem.value.textContent = "";
      }
      STEP_IDS.forEach((stepId, index) => {
        const step = steps.get(stepId);
        step.item.dataset.state = "pending";
        step.marker.textContent = String(index + 1);
        step.summary.textContent = "";
        step.summaryCopy = null;
        step.time.textContent = "";
        step.details.replaceChildren();
        step.detailRows.length = 0;
        if (stepId === "certificate") step.item.hidden = true;
      });
      technical.hidden = true;
      technical.open = false;
      technicalRows.length = 0;
      technicalLines.replaceChildren();
    },
    begin(stepId) { setState(stepId, "active"); },
    complete(stepId, summaryCopy) { setState(stepId, "done", summaryCopy); },
    unknown(stepId, summaryCopy) { setState(stepId, "unknown", summaryCopy); },
    fail(stepId, summaryCopy) { setState(stepId, "fail", summaryCopy); },
    showCertificateStep() {
      const step = steps.get("certificate");
      if (step) step.item.hidden = false;
    },
    addTechnicalLine(titleCopy, value) {
      const row = document.createElement("div");
      const strong = document.createElement("strong");
      const text = document.createElement("span");
      strong.textContent = copy(titleCopy.en, titleCopy.tr);
      text.textContent = value;
      row.append(strong, document.createTextNode(" "), text);
      technicalLines.appendChild(row);
      technicalRows.push({ label: strong, titleCopy });
      technical.hidden = false;

      const key = `${titleCopy.en} ${titleCopy.tr}`.toLowerCase();
      if (key.includes("challenge id")) addStepDetail("challenge", { en: "Challenge ID", tr: "Challenge ID" }, value);
      if (key.includes("challenge hash")) addStepDetail("challenge", { en: "Challenge hash", tr: "Challenge hash" }, value);
      if (key.includes("receipt id")) {
        addStepDetail("verdict", { en: "Receipt", tr: "Receipt" }, value);
        receiptProof.value.textContent = truncate(value, 28);
        receiptProof.value.title = String(value);
        receiptProof.card.dataset.state = "ready";
      }
      if (key.includes("certificate id") || key.includes("sertifika id")) {
        addStepDetail("certificate", { en: "Certificate", tr: "Certificate" }, value);
        certificateProof.value.textContent = truncate(value, 28);
        certificateProof.value.title = String(value);
        publicProof.value.textContent = copy("Public proof ready", "Public proof hazır");
      }
    },
  };
}
