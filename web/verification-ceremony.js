const STEPS = ["challenge", "execute", "result", "sign", "verify", "verdict", "certificate"];

const STEP_LABELS = {
  challenge: ["Fresh challenge received", "Fresh challenge geldi"],
  execute: ["Capability executed", "Capability çalıştı"],
  result: ["Agent output created", "Ajan çıktısı oluştu"],
  sign: ["DID signature attached", "DID imzası bağlandı"],
  verify: ["FLOP verified independently", "FLOP bağımsız doğruladı"],
  verdict: ["Decision recorded", "Karar kaydedildi"],
  certificate: ["Certificate issued", "Certificate üretildi"],
};

const CAPABILITY_VISUALS = {
  1: {
    parts: [["public_key", "PUBLIC KEY"], ["message", "MESSAGE"], ["signature", "SIGNATURE"]],
    checks: [["Decode key", "Anahtarı çöz"], ["Bind message", "Mesajı bağla"], ["Check signature", "İmzayı doğrula"]],
  },
  2: {
    parts: [["document", "JSON"], ["canonical", "CANONICAL"], ["utf8", "UTF 8"], ["sha256", "SHA256"]],
    checks: [["Normalize JSON", "JSON normalize et"], ["Build canonical form", "Canonical biçimi üret"], ["Encode bytes", "Byte dizisini üret"], ["Calculate digest", "Digest hesapla"]],
  },
  3: {
    parts: [["room", "ROOM"], ["nonce", "NONCE"], ["text", "MESSAGE"], ["canonical", "CANONICAL"]],
    checks: [["Clean text", "Metni temizle"], ["Bind room", "Room bağla"], ["Bind nonce", "Nonce bağla"], ["Build message", "Mesajı üret"]],
  },
  4: {
    parts: [["receipt", "RECEIPT"], ["signature", "SIGNATURE"], ["key_id", "KEY ID"], ["server_keys", "SERVER KEYS"]],
    checks: [["Match key id", "Key ID eşleştir"], ["Check signature", "İmzayı doğrula"], ["Check payload", "Payload kontrol et"], ["Classify receipt", "Receipt sınıflandır"]],
  },
};

function isTr() {
  return document.documentElement.lang === "tr";
}

function copy(en, tr) {
  return isTr() ? tr : en;
}

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined && value !== null) node.textContent = String(value);
  return node;
}

function short(value, max = 34) {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(8, max - 9))}…${text.slice(-8)}`;
}

function pretty(value, max = 520) {
  let text;
  try { text = typeof value === "string" ? value : JSON.stringify(value, null, 2); }
  catch { text = String(value ?? ""); }
  return text.length > max ? `${text.slice(0, max)}\n…` : text;
}

function valueFor(caseData, key) {
  if (!caseData || typeof caseData !== "object") return "";
  if (Object.prototype.hasOwnProperty.call(caseData, key)) return caseData[key];
  if (key === "signature") {
    const receipt = caseData.receipt ?? caseData.signed_receipt;
    return receipt?.server_signature ?? receipt?.signature ?? "";
  }
  if (key === "key_id") {
    const receipt = caseData.receipt ?? caseData.signed_receipt;
    return receipt?.server_key_id ?? receipt?.key_id ?? "";
  }
  if (key === "canonical") return "derived by capability";
  if (key === "utf8") return "derived bytes";
  if (key === "sha256") return "derived digest";
  return "";
}

function safeFinished(animation) {
  return animation?.finished?.catch(() => undefined) ?? Promise.resolve();
}

function animate(element, keyframes, options, reduced) {
  if (!element || reduced || typeof element.animate !== "function") return Promise.resolve();
  return safeFinished(element.animate(keyframes, { fill: "both", ...options }));
}

function createOrbCanvas(className) {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  canvas.width = 420;
  canvas.height = 420;
  return canvas;
}

function drawCore(canvas, time, energy, rgb, verifier = false) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 320;
  const width = Math.max(1, Math.round(cssW * dpr));
  const height = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const cx = cssW / 2;
  const cy = cssH / 2;
  const radius = Math.min(cssW, cssH) * (verifier ? .22 : .255);
  const halo = ctx.createRadialGradient(cx, cy, radius * .05, cx, cy, radius * 1.85);
  halo.addColorStop(0, `rgba(${rgb},${.28 + energy * .18})`);
  halo.addColorStop(.35, `rgba(${rgb},${.09 + energy * .12})`);
  halo.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.85, 0, Math.PI * 2);
  ctx.fill();

  const sphere = ctx.createRadialGradient(cx - radius * .34, cy - radius * .35, radius * .03, cx, cy, radius);
  sphere.addColorStop(0, verifier ? "#183b59" : "#342767");
  sphere.addColorStop(.28, verifier ? "#0b2034" : "#171331");
  sphere.addColorStop(.72, "#070b12");
  sphere.addColorStop(1, "#020407");
  ctx.fillStyle = sphere;
  ctx.strokeStyle = `rgba(${rgb},${.34 + energy * .46})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < 5; i += 1) {
    const ring = radius * (.72 + i * .19);
    const direction = i % 2 ? -1 : 1;
    const start = time * .00018 * direction + i * .62;
    ctx.strokeStyle = `rgba(${rgb},${.13 + energy * .12})`;
    ctx.lineWidth = i === 0 ? 1.7 : .8;
    ctx.beginPath();
    ctx.arc(cx, cy, ring, start, start + Math.PI * (1.05 + i * .12));
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * .45);
  core.addColorStop(0, `rgba(${rgb},.98)`);
  core.addColorStop(.22, `rgba(${rgb},${.68 + energy * .22})`);
  core.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * .46, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4 + time * .00012 * (verifier ? -1 : 1));
  ctx.strokeStyle = `rgba(${rgb},${.8 + energy * .18})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-radius * .18, -radius * .18, radius * .36, radius * .36);
  ctx.restore();
}

function createActor({ className, kicker, title, canvasClass, rgb, verifier = false }) {
  const actor = el("section", `ceremony-actor ${className}`);
  actor.dataset.state = "idle";
  const label = el("div", "ceremony-actor-label");
  label.append(el("span", "ceremony-kicker", kicker), el("strong", "ceremony-actor-title", title));
  const canvas = createOrbCanvas(canvasClass);
  actor.append(label, canvas);
  actor.dataset.rgb = rgb;
  actor.dataset.verifier = verifier ? "true" : "false";
  return { actor, canvas, label };
}

function createPart(key, label) {
  const part = el("div", "ceremony-part");
  part.dataset.key = key;
  part.dataset.state = "hidden";
  const glyph = el("span", "ceremony-part-glyph", key === "signature" ? "∿" : key.includes("key") ? "⌁" : key.includes("sha") ? "#" : "▱");
  const body = el("span", "ceremony-part-copy");
  const title = el("strong", "", label);
  const value = el("small", "mono", "—");
  body.append(title, value);
  part.append(glyph, body);
  return { part, title, value };
}

function createChallenge(number) {
  const visual = CAPABILITY_VISUALS[number] ?? CAPABILITY_VISUALS[4];
  const node = el("section", "ceremony-object ceremony-challenge");
  node.dataset.state = "hidden";
  const top = el("div", "ceremony-object-top");
  top.append(el("span", "ceremony-kicker", "FRESH CHALLENGE"), el("span", "ceremony-fresh-badge", "FRESH"));
  const title = el("strong", "ceremony-object-title", copy("Unseen test input", "Daha önce görülmemiş test girdisi"));
  const meta = el("div", "ceremony-object-meta");
  const id = el("code", "mono", "ID  —");
  const hash = el("code", "mono", "SHA256  —");
  meta.append(id, hash);
  const partsWrap = el("div", "ceremony-parts");
  const parts = new Map();
  visual.parts.forEach(([key, label]) => {
    const item = createPart(key, label);
    partsWrap.appendChild(item.part);
    parts.set(key, item);
  });
  node.append(top, title, meta, partsWrap);
  return { node, title, id, hash, parts, visual };
}

function createCapabilityModule(number, name, checks) {
  const module = el("div", "ceremony-module");
  module.dataset.state = "installed";
  const head = el("div", "ceremony-module-head");
  head.append(el("span", "ceremony-module-mark", "◇"), el("div", "", ""));
  head.lastElementChild.append(el("strong", "", `Capability ${number}`), el("small", "", name));
  const state = el("span", "ceremony-module-state", copy("INSTALLED", "YÜKLÜ"));
  const list = el("div", "ceremony-module-checks");
  const rows = [];
  checks.forEach(([en, tr]) => {
    const row = el("div", "ceremony-module-check");
    row.dataset.state = "pending";
    row.append(el("span", "ceremony-check-mark", "·"), el("span", "", copy(en, tr)));
    list.appendChild(row);
    rows.push(row);
  });
  module.append(head, state, list);
  return { module, state, rows };
}

function createResult() {
  const node = el("section", "ceremony-object ceremony-result");
  node.dataset.state = "hidden";
  const top = el("div", "ceremony-object-top");
  top.append(el("span", "ceremony-kicker", "AGENT OUTPUT"), el("span", "ceremony-output-state", copy("CREATED", "OLUŞTU")));
  const title = el("strong", "ceremony-object-title", copy("Capability result", "Capability sonucu"));
  const data = el("pre", "ceremony-result-data mono", "—");
  const hash = el("code", "ceremony-result-hash mono", "result hash  —");
  node.append(top, title, data, hash);
  return { node, data, hash };
}

function createDidSeal() {
  const seal = el("div", "ceremony-did-seal");
  seal.dataset.state = "hidden";
  seal.append(el("span", "ceremony-seal-symbol", "◇"), el("strong", "", "DID"), el("small", "", "SIGN"));
  const detail = el("code", "ceremony-seal-detail mono", "—");
  seal.appendChild(detail);
  return { seal, detail };
}

function createVerifierPanel(verifierActor) {
  const panel = el("div", "ceremony-verifier-panel");
  panel.dataset.state = "hidden";
  const id = el("code", "ceremony-verifier-id mono", "verifier  —");
  const compare = el("div", "ceremony-compare");
  const agent = el("div", "ceremony-compare-value");
  agent.append(el("span", "", copy("AGENT RESULT", "AJAN SONUCU")), el("code", "mono", "—"));
  const flop = el("div", "ceremony-compare-value");
  flop.append(el("span", "", copy("FLOP RESULT", "FLOP SONUCU")), el("code", "mono", "—"));
  const lock = el("div", "ceremony-match-lock", copy("WAITING", "BEKLİYOR"));
  compare.append(agent, lock, flop);
  panel.append(id, compare);
  verifierActor.actor.appendChild(panel);
  return { panel, id, agent: agent.querySelector("code"), flop: flop.querySelector("code"), lock };
}

function createCertificate(number, name) {
  const node = el("article", "ceremony-certificate");
  node.dataset.state = "hidden";
  const brand = el("div", "ceremony-certificate-brand");
  brand.append(el("span", "ceremony-certificate-mark", "◇"), el("strong", "", "FLOP"));
  const type = el("span", "ceremony-certificate-type", "VERIFIED CAPABILITY");
  const cap = el("strong", "ceremony-certificate-cap", `Capability ${number}`);
  const capName = el("span", "ceremony-certificate-name", name);
  const fields = el("div", "ceremony-certificate-fields");
  const did = el("code", "mono", "DID  —");
  const receipt = el("code", "mono", "RECEIPT  —");
  const cert = el("code", "mono", "CERTIFICATE  —");
  fields.append(did, receipt, cert);
  const seal = el("div", "ceremony-certificate-seal", "◇");
  node.append(brand, type, cap, capName, fields, seal);
  return { node, did, receipt, cert };
}

function createProofDock() {
  const dock = el("section", "ceremony-proof-dock");
  dock.dataset.state = "hidden";
  const intro = el("div", "ceremony-proof-intro");
  intro.append(el("span", "ceremony-kicker", copy("PROOF CAN LEAVE FLOP", "KANIT FLOP DIŞINA ÇIKABİLİR")), el("strong", "", copy("Execution stays. Proof travels.", "Çalıştırma kalır. Kanıt taşınır.")));
  const split = el("div", "ceremony-proof-split");
  const inside = el("div", "ceremony-boundary-side ceremony-boundary-inside");
  inside.append(el("span", "", copy("STAYS INSIDE FLOP", "FLOP İÇİNDE KALIR")), el("strong", "", copy("Agent Core + Capability", "Ajan Core + Capability")));
  const outside = el("div", "ceremony-boundary-side ceremony-boundary-outside");
  outside.append(el("span", "", copy("PORTABLE PROOF", "TAŞINABİLİR KANIT")), el("strong", "", "DID · Certificate · Receipt · Public proof"));
  split.append(inside, outside);
  dock.append(intro, split);
  return dock;
}

function createEventStrip() {
  const strip = el("div", "ceremony-event-strip");
  const dot = el("span", "ceremony-event-dot", "");
  const kind = el("span", "ceremony-event-kind", copy("SYSTEM EVENT", "SİSTEM EVENTİ"));
  const text = el("strong", "ceremony-event-text", copy("Waiting for verification to start", "Doğrulamanın başlaması bekleniyor"));
  strip.append(dot, kind, text);
  return { strip, dot, kind, text };
}

export function createVerificationCeremony(container, config = {}) {
  const number = Number(config.number ?? 4);
  const name = config.name ?? `Capability ${number}`;
  const capabilityId = config.capabilityId ?? "";
  const visual = CAPABILITY_VISUALS[number] ?? CAPABILITY_VISUALS[4];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const states = new Map(STEPS.map((step) => [step, "pending"]));
  let visualTail = Promise.resolve();
  let frameId = 0;
  let disposed = false;
  let currentResult = null;
  let decision = {};

  const shell = el("section", "ceremony-shell ceremony-hidden-until-run");
  shell.dataset.phase = "idle";
  const head = el("header", "ceremony-head");
  const headCopy = el("div", "ceremony-head-copy");
  headCopy.append(
    el("span", "ceremony-breadcrumb", copy("MY AGENT  /  LIVE VERIFICATION", "AJANIM  /  CANLI DOĞRULAMA")),
    el("h3", "ceremony-title", `Capability ${number} · ${name}`),
    el("p", "ceremony-subtitle", copy("Watch the proof form from real verification events.", "Kanıtın gerçek doğrulama eventlerinden nasıl oluştuğunu izle.")),
  );
  const live = el("div", "ceremony-live");
  live.append(el("span", "ceremony-live-dot", ""), el("span", "", copy("REAL EVENTS", "GERÇEK EVENTLER")));
  head.append(headCopy, live);

  const stage = el("div", "ceremony-stage");
  const field = document.createElement("canvas");
  field.className = "ceremony-field";
  field.setAttribute("aria-hidden", "true");
  const challenge = createChallenge(number);
  const agent = createActor({ className: "ceremony-agent", kicker: copy("YOUR FLOP AGENT", "FLOP AJANIN"), title: copy("Agent Core", "Ajan Core"), canvasClass: "ceremony-core-canvas", rgb: "137,108,255" });
  const module = createCapabilityModule(number, name, visual.checks);
  agent.actor.appendChild(module.module);
  const result = createResult();
  const didSeal = createDidSeal();
  const verifier = createActor({ className: "ceremony-verifier", kicker: "FLOP", title: copy("Independent verifier", "Bağımsız verifier"), canvasClass: "ceremony-verifier-canvas", rgb: "64,162,255", verifier: true });
  const verifierPanel = createVerifierPanel(verifier);
  const certificate = createCertificate(number, name);
  const pass = el("div", "ceremony-pass");
  pass.dataset.state = "hidden";
  pass.append(el("span", "ceremony-pass-small", copy("RESULTS MATCH", "SONUÇLAR EŞLEŞTİ")), el("strong", "", "PASS"));
  stage.append(field, challenge.node, agent.actor, result.node, didSeal.seal, verifier.actor, certificate.node, pass);

  const eventStrip = createEventStrip();
  const proofDock = createProofDock();
  shell.append(head, stage, eventStrip.strip, proofDock);
  container.replaceChildren(shell);
  container.hidden = true;

  function actorEnergy(step) {
    const state = states.get(step);
    if (state === "active") return 1;
    if (state === "done") return .68;
    return .2;
  }

  function render(time) {
    if (disposed) return;
    drawCore(agent.canvas, time, actorEnergy("execute"), "137,108,255", false);
    drawCore(verifier.canvas, time * .91, actorEnergy("verify"), "64,162,255", true);
    frameId = requestAnimationFrame(render);
  }
  frameId = requestAnimationFrame(render);

  function queue(task) {
    visualTail = visualTail.then(() => task()).catch(() => undefined);
    return visualTail;
  }

  function say(en, tr) {
    eventStrip.text.textContent = copy(en, tr);
  }

  function setRealState(step, state) {
    states.set(step, state);
    shell.dataset.phase = step;
    shell.dataset.realState = state;
  }

  async function reveal(node, from = "translateY(18px) scale(.96)") {
    node.dataset.state = "visible";
    await animate(node, [{ opacity: 0, transform: from }, { opacity: 1, transform: "translate(0,0) scale(1)" }], { duration: 430, easing: "cubic-bezier(.2,.9,.2,1)" }, reduced);
  }

  async function pulse(node, scale = 1.05) {
    await animate(node, [{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], { duration: 430, easing: "cubic-bezier(.2,.8,.2,1)" }, reduced);
  }

  async function travel(from, to, label, tone = "violet") {
    const stageRect = stage.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const packet = el("div", `ceremony-travel-packet ceremony-travel-${tone}`, label);
    stage.appendChild(packet);
    const startX = fromRect.left + fromRect.width / 2 - stageRect.left;
    const startY = fromRect.top + fromRect.height / 2 - stageRect.top;
    const endX = toRect.left + toRect.width / 2 - stageRect.left;
    const endY = toRect.top + toRect.height / 2 - stageRect.top;
    packet.style.left = `${startX}px`;
    packet.style.top = `${startY}px`;
    const dx = endX - startX;
    const dy = endY - startY;
    await animate(packet, [
      { opacity: 0, transform: "translate(-50%,-50%) scale(.7)" },
      { opacity: 1, offset: .14, transform: `translate(calc(-50% + ${dx * .08}px), calc(-50% + ${dy * .02 - 22}px)) scale(1)` },
      { opacity: 1, offset: .72, transform: `translate(calc(-50% + ${dx * .78}px), calc(-50% + ${dy * .82 - 14}px)) scale(1)` },
      { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.65)` },
    ], { duration: 620, easing: "cubic-bezier(.25,.72,.25,1)" }, reduced);
    packet.remove();
  }

  async function animateChallenge() {
    await reveal(challenge.node, "translateX(-28px) scale(.96)");
    for (const item of challenge.parts.values()) {
      item.part.dataset.state = "ready";
      await animate(item.part, [{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 180, easing: "ease-out" }, reduced);
    }
    await pulse(challenge.node, 1.018);
  }

  async function animateExecution() {
    module.module.dataset.state = "active";
    say("Fresh input is entering the installed capability.", "Fresh girdi yüklü capability içine giriyor.");
    for (const item of challenge.parts.values()) {
      if (item.part.dataset.state !== "hidden") await travel(item.part, agent.actor, item.title.textContent, "violet");
    }
    for (const row of module.rows) {
      row.dataset.state = "done";
      row.querySelector(".ceremony-check-mark").textContent = "✓";
      await animate(row, [{ opacity: .35, transform: "translateX(-5px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 210, easing: "ease-out" }, reduced);
    }
    module.state.textContent = copy("EXECUTED", "ÇALIŞTI");
    await pulse(agent.actor, 1.035);
  }

  async function animateResult() {
    result.node.dataset.state = "visible";
    await travel(agent.actor, result.node, copy("RESULT", "SONUÇ"), "violet");
    await reveal(result.node, "translateY(20px) scale(.9)");
  }

  async function animateSign() {
    didSeal.seal.dataset.state = "visible";
    await reveal(didSeal.seal, "translateY(-34px) scale(.72)");
    await travel(agent.actor, didSeal.seal, "DID", "violet");
    await animate(didSeal.seal, [
      { transform: "translateY(-10px) scale(1.08) rotate(-4deg)" },
      { transform: "translateY(26px) scale(.96) rotate(2deg)" },
      { transform: "translateY(0) scale(1) rotate(0)" },
    ], { duration: 520, easing: "cubic-bezier(.18,.86,.25,1)" }, reduced);
    result.node.dataset.signed = "true";
    await pulse(result.node, 1.025);
  }

  async function animateVerification() {
    verifier.actor.dataset.state = "active";
    verifierPanel.panel.dataset.state = "visible";
    await reveal(verifierPanel.panel, "translateY(12px) scale(.96)");
    say("Signed agent output is moving to FLOP's independent verifier.", "İmzalı ajan çıktısı FLOP'un bağımsız verifier'ına gidiyor.");
    await travel(result.node, verifier.actor, copy("SIGNED RESULT", "İMZALI SONUÇ"), "blue");
    await pulse(verifier.actor, 1.045);
    verifier.actor.dataset.state = "done";
  }

  async function animateVerdict(state) {
    if (state === "done") {
      verifierPanel.lock.textContent = "MATCH ✓";
      verifierPanel.lock.dataset.state = "match";
      await animate(verifierPanel.lock, [{ transform: "scale(.85)", opacity: .4 }, { transform: "scale(1.08)", opacity: 1 }, { transform: "scale(1)", opacity: 1 }], { duration: 520, easing: "cubic-bezier(.2,.9,.2,1)" }, reduced);
      pass.dataset.state = "visible";
      await reveal(pass, "scale(.72)");
      await animate(pass, [{ transform: "scale(.92)", opacity: .5 }, { transform: "scale(1.06)", opacity: 1 }, { transform: "scale(1)", opacity: 1 }], { duration: 650, easing: "cubic-bezier(.15,.9,.2,1)" }, reduced);
    } else if (state === "fail") {
      verifierPanel.lock.textContent = "MISMATCH ×";
      verifierPanel.lock.dataset.state = "fail";
      pass.dataset.state = "fail";
      pass.replaceChildren(el("span", "ceremony-pass-small", copy("RESULTS DO NOT MATCH", "SONUÇLAR EŞLEŞMEDİ")), el("strong", "", "FAIL"));
      await reveal(pass, "scale(.8)");
    } else {
      verifierPanel.lock.textContent = "UNKNOWN";
      verifierPanel.lock.dataset.state = "unknown";
    }
  }

  async function animateCertificate() {
    say("PASS is now being sealed into an individual capability certificate.", "PASS şimdi capability'ye özel certificate içine mühürleniyor.");
    const sources = [challenge.node, result.node, didSeal.seal, verifier.actor];
    const labels = ["CHALLENGE", "RESULT", "DID", "VERIFIER"];
    certificate.node.dataset.state = "forming";
    for (let i = 0; i < sources.length; i += 1) await travel(sources[i], certificate.node, labels[i], i === 3 ? "blue" : "gold");
    certificate.node.dataset.state = "visible";
    await reveal(certificate.node, "translateX(30px) scale(.82) rotateY(-7deg)");
    proofDock.dataset.state = "visible";
    await reveal(proofDock, "translateY(18px)");
  }

  function reset() {
    container.hidden = false;
    shell.classList.remove("ceremony-hidden-until-run");
    shell.dataset.phase = "idle";
    shell.dataset.realState = "pending";
    states.clear();
    STEPS.forEach((step) => states.set(step, "pending"));
    challenge.node.dataset.state = "hidden";
    challenge.id.textContent = "ID  —";
    challenge.hash.textContent = "SHA256  —";
    challenge.parts.forEach((item) => {
      item.part.dataset.state = "hidden";
      item.value.textContent = "—";
      item.value.title = "";
    });
    module.module.dataset.state = "installed";
    module.state.textContent = copy("INSTALLED", "YÜKLÜ");
    module.rows.forEach((row) => {
      row.dataset.state = "pending";
      row.querySelector(".ceremony-check-mark").textContent = "·";
    });
    result.node.dataset.state = "hidden";
    delete result.node.dataset.signed;
    result.data.textContent = "—";
    result.hash.textContent = "result hash  —";
    didSeal.seal.dataset.state = "hidden";
    didSeal.detail.textContent = "—";
    verifier.actor.dataset.state = "idle";
    verifierPanel.panel.dataset.state = "hidden";
    verifierPanel.id.textContent = "verifier  —";
    verifierPanel.agent.textContent = "—";
    verifierPanel.flop.textContent = "—";
    verifierPanel.lock.textContent = copy("WAITING", "BEKLİYOR");
    delete verifierPanel.lock.dataset.state;
    certificate.node.dataset.state = "hidden";
    certificate.did.textContent = "DID  —";
    certificate.receipt.textContent = "RECEIPT  —";
    certificate.cert.textContent = "CERTIFICATE  —";
    pass.dataset.state = "hidden";
    pass.replaceChildren(el("span", "ceremony-pass-small", copy("RESULTS MATCH", "SONUÇLAR EŞLEŞTİ")), el("strong", "", "PASS"));
    proofDock.dataset.state = "hidden";
    currentResult = null;
    decision = {};
    say("Verification started. Waiting for the first real event.", "Doğrulama başladı. İlk gerçek event bekleniyor.");
  }

  function begin(step) {
    setRealState(step, "active");
    const labels = STEP_LABELS[step];
    if (labels) say(`${labels[0]}…`, `${labels[1]}…`);
    if (step === "execute") agent.actor.dataset.state = "active";
    if (step === "verify") verifier.actor.dataset.state = "active";
  }

  function complete(step, summary) {
    setRealState(step, "done");
    const summaryText = summary ? (isTr() ? summary.tr : summary.en) : "";
    const labels = STEP_LABELS[step];
    say(summaryText || labels?.[0] || step, summaryText || labels?.[1] || step);
    if (step === "challenge") queue(animateChallenge);
    if (step === "execute") queue(animateExecution);
    if (step === "result") queue(animateResult);
    if (step === "sign") queue(animateSign);
    if (step === "verify") queue(animateVerification);
    if (step === "verdict") queue(() => animateVerdict("done"));
    if (step === "certificate") queue(animateCertificate);
  }

  function fail(step, summary) {
    setRealState(step, "fail");
    const text = summary ? (isTr() ? summary.tr : summary.en) : copy("Verification failed", "Doğrulama başarısız");
    say(text, text);
    if (step === "verdict") queue(() => animateVerdict("fail"));
  }

  function unknown(step, summary) {
    setRealState(step, "unknown");
    const text = summary ? (isTr() ? summary.tr : summary.en) : "UNKNOWN";
    say(text, text);
    if (step === "verdict") queue(() => animateVerdict("unknown"));
  }

  function setChallenge(caseData, meta = {}) {
    if (meta.challengeId ?? meta.challenge_id) challenge.id.textContent = `ID  ${short(meta.challengeId ?? meta.challenge_id, 30)}`;
    if (meta.challengeHash ?? meta.challenge_hash) challenge.hash.textContent = `SHA256  ${short(meta.challengeHash ?? meta.challenge_hash, 30)}`;
    challenge.parts.forEach((item, key) => {
      const value = valueFor(caseData, key);
      const display = value && typeof value === "object" ? pretty(value, 180).replace(/\s+/g, " ") : String(value || copy("present", "mevcut"));
      item.value.textContent = short(display, 30);
      item.value.title = display;
    });
  }

  function setResult(value) {
    currentResult = value;
    result.data.textContent = pretty(value, 440);
    verifierPanel.agent.textContent = short(pretty(value, 120).replace(/\s+/g, " "), 24);
  }

  function setResultHash(value) {
    if (!value) return;
    result.hash.textContent = `result hash  ${short(value, 28)}`;
    result.hash.title = String(value);
    verifierPanel.agent.textContent = short(value, 24);
  }

  function setIdentity(did) {
    if (!did) return;
    didSeal.detail.textContent = short(did, 25);
    didSeal.detail.title = did;
    certificate.did.textContent = `DID  ${short(did, 25)}`;
    certificate.did.title = did;
  }

  function setSignature(signature) {
    if (!signature) return;
    didSeal.detail.textContent = `${copy("signed", "imzalı")}  ${short(signature, 19)}`;
    didSeal.detail.title = signature;
  }

  function setVerifier(id, version) {
    if (!id) return;
    const value = version ? `${id} @ ${version}` : id;
    verifierPanel.id.textContent = short(value, 35);
    verifierPanel.id.title = value;
  }

  function setDecision(next = {}) {
    decision = { ...decision, ...next };
    if (next.result_hash) setResultHash(next.result_hash);
    if (next.verifier_id) setVerifier(next.verifier_id, next.verifier_version);
    if (next.receipt_id) {
      certificate.receipt.textContent = `RECEIPT  ${short(next.receipt_id, 24)}`;
      certificate.receipt.title = next.receipt_id;
    }
    if (next.certificate_id) {
      certificate.cert.textContent = `CERTIFICATE  ${short(next.certificate_id, 22)}`;
      certificate.cert.title = next.certificate_id;
    }
    if (next.verdict === "PASS") {
      verifierPanel.flop.textContent = next.result_hash ? short(next.result_hash, 24) : (result.hash.textContent.replace("result hash  ", "") || copy("expected result", "beklenen sonuç"));
    }
  }

  function completeProof(proof = {}) {
    if (proof.did) setIdentity(proof.did);
    if (proof.receipt) {
      setDecision({
        verdict: proof.receipt.verdict,
        receipt_id: proof.receipt.receipt_id,
        result_hash: proof.receipt.result_hash,
        verifier_id: proof.receipt.verifier_id,
        verifier_version: proof.receipt.verifier_version,
      });
    }
    if (proof.certificate) setDecision({ certificate_id: proof.certificate.certificate_id });
  }

  function localize() {
    module.state.textContent = states.get("execute") === "done" ? copy("EXECUTED", "ÇALIŞTI") : copy("INSTALLED", "YÜKLÜ");
  }

  return {
    reset,
    begin,
    complete,
    fail,
    unknown,
    setChallenge,
    setResult,
    setResultHash,
    setIdentity,
    setSignature,
    setVerifier,
    setDecision,
    completeProof,
    localize,
    showCertificate() {},
    destroy() {
      disposed = true;
      cancelAnimationFrame(frameId);
    },
    get capabilityId() { return capabilityId; },
    get result() { return currentResult; },
    get decision() { return decision; },
  };
}
