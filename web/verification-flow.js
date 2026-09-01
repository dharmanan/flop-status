/**
 * Shared verification run surface for every production capability.
 *
 * Each step advances only when the corresponding operation actually happens:
 * the challenge step completes when the API returns a challenge, the capability
 * step completes when the installed module resolves, the signing step completes
 * when the browser key produces a signature, and the FLOP step completes when
 * the submission response arrives. There is no timer-driven progress here.
 */

const STEP_IDS = ["challenge", "execute", "result", "sign", "verify", "verdict", "certificate"];

const STEP_TITLES = {
  challenge: ["Fresh challenge prepared", "Yeni challenge hazırlandı"],
  execute: ["Capability running", "Yetenek çalışıyor"],
  result: ["Result produced", "Sonuç üretildi"],
  sign: ["Signed with your DID", "DID ile imzalandı"],
  verify: ["FLOP verifying independently", "FLOP bağımsız doğruluyor"],
  verdict: ["Verdict", "Sonuç"],
  certificate: ["Certificate issued", "Sertifika üretildi"],
};

function language() {
  return document.documentElement.lang === "tr" ? "tr" : "en";
}

function copy(en, tr) {
  return language() === "tr" ? tr : en;
}

export function createVerificationFlow(container) {
  const steps = new Map();

  const label = document.createElement("div");
  label.className = "label flow-label";

  const list = document.createElement("ol");
  list.className = "flow-steps";

  for (const stepId of STEP_IDS) {
    const item = document.createElement("li");
    item.className = "flow-step";
    item.dataset.step = stepId;
    item.dataset.state = "pending";
    if (stepId === "certificate") item.hidden = true;

    const marker = document.createElement("span");
    marker.className = "flow-marker";
    marker.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "flow-body";
    const title = document.createElement("span");
    title.className = "flow-title";
    const summary = document.createElement("span");
    summary.className = "flow-summary";
    body.append(title, summary);

    item.append(marker, body);
    list.appendChild(item);
    steps.set(stepId, { item, title, summary });
  }

  const technical = document.createElement("details");
  technical.className = "technical-details flow-technical";
  technical.hidden = true;
  const technicalSummary = document.createElement("summary");
  const technicalLines = document.createElement("div");
  technicalLines.className = "checks";
  technical.append(technicalSummary, technicalLines);

  container.replaceChildren(label, list, technical);
  container.hidden = true;

  const technicalRows = [];

  function setState(stepId, state, summaryCopy) {
    const step = steps.get(stepId);
    if (!step) return;
    step.item.dataset.state = state;
    if (summaryCopy !== undefined) {
      step.summaryCopy = summaryCopy;
      step.summary.textContent = copy(summaryCopy.en, summaryCopy.tr);
    }
  }

  /** Re-renders every title and recorded summary in the current language. */
  function localize() {
    label.textContent = copy("VERIFICATION RUN", "DOĞRULAMA AKIŞI");
    technicalSummary.textContent = copy("Technical details", "Teknik ayrıntılar");
    for (const [stepId, step] of steps) {
      const [en, tr] = STEP_TITLES[stepId];
      step.title.textContent = copy(en, tr);
      if (step.summaryCopy) step.summary.textContent = copy(step.summaryCopy.en, step.summaryCopy.tr);
    }
    for (const row of technicalRows) {
      row.label.textContent = copy(row.titleCopy.en, row.titleCopy.tr);
    }
  }

  localize();

  return {
    localize,

    reset() {
      container.hidden = false;
      for (const [stepId, step] of steps) {
        step.item.dataset.state = "pending";
        step.summary.textContent = "";
        step.summaryCopy = null;
        if (stepId === "certificate") step.item.hidden = true;
      }
      technical.hidden = true;
      technical.open = false;
      technicalRows.length = 0;
      technicalLines.replaceChildren();
    },

    begin(stepId) {
      setState(stepId, "active");
    },

    complete(stepId, summaryCopy) {
      setState(stepId, "done", summaryCopy);
    },

    /** UNKNOWN keeps its own visual state and is never rendered as a failure. */
    unknown(stepId, summaryCopy) {
      setState(stepId, "unknown", summaryCopy);
    },

    fail(stepId, summaryCopy) {
      setState(stepId, "fail", summaryCopy);
    },

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
    },
  };
}
