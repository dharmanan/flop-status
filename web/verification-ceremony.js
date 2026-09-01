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

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function createCoreCanvas(className) {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  canvas.width = 420;
  canvas.height = 420;
  return canvas;
}

function drawCore(canvas, time, energy, rgb, verifier = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
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
  const unit = Math.min(cssW, cssH);
  const radius = unit * (verifier ? .19 : .215);
  const phase = time * (verifier ? -.00013 : .00016);

  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = `rgba(${rgb},${.11 + energy * .14})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const a = i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * radius * 1.15, Math.sin(a) * radius * 1.15);
    ctx.lineTo(Math.cos(a) * radius * 1.55, Math.sin(a) * radius * 1.55);
    ctx.stroke();
  }

  for (let ring = 0; ring < 3; ring += 1) {
    const r = radius * (.72 + ring * .31);
    const start = phase * (ring % 2 ? -1.25 : 1) + ring * 1.05;
    ctx.strokeStyle = `rgba(${rgb},${.18 + energy * (.13 - ring * .02)})`;
    ctx.lineWidth = ring === 0 ? 1.4 : .8;
    ctx.beginPath();
    ctx.arc(0, 0, r, start, start + Math.PI * (1.04 + ring * .16));
    ctx.stroke();
  }

  const outer = radius * .78;
  ctx.rotate(Math.PI / 4 + phase * .38);
  ctx.fillStyle = verifier ? "rgba(7,18,29,.92)" : "rgba(16,12,30,.94)";
  ctx.strokeStyle = `rgba(${rgb},${.52 + energy * .3})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(-outer / 2, -outer / 2, outer, outer);
  ctx.fill();
  ctx.stroke();

  const inner = outer * .46;
  ctx.rotate(-phase * .7);
  ctx.strokeStyle = `rgba(${rgb},${.72 + energy * .16})`;
  ctx.strokeRect(-inner / 2, -inner / 2, inner, inner);

  ctx.fillStyle = `rgba(${rgb},${.58 + energy * .3})`;
  for (let i = 0; i < 4; i += 1) {
    const a = phase * 1.35 + i * Math.PI / 2;
    const orbit = radius * .96;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * orbit, Math.sin(a) * orbit, Math.max(2.2, unit * .008), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function createActor({ className, kicker, title, canvasClass }) {
  const actor = el("section", `ceremony-actor ${className}`);
  actor.dataset.state = "idle";
  const label = el("div", "ceremony-actor-label");
  label.append(el("span", "ceremony-kicker", kicker), el("strong", "ceremony-actor-title", title));
  const canvas = createCoreCanvas(canvasClass);
  const ports = el("div", "ceremony-core-ports");
  const portNodes = [];
  for (let i = 0; i < 4; i += 1) {
    const port = el("span", "ceremony-core-port", "");
    port.dataset.state = "empty";
    ports.appendChild(port);
    portNodes.push(port);
  }
  actor.append(label, canvas, ports);
  return { actor, canvas, ports: portNodes };
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
  const node = el("section", "ceremony-challenge");
  node.dataset.state = "hidden";
  const head = el("div", "ceremony-challenge-head");
  head.append(el("span", "ceremony-kicker", "FRESH CHALLENGE"), el("span", "ceremony-fresh-badge", "FRESH"));
  const title = el("strong", "ceremony-challenge-title", copy("Unseen test input", "Daha önce görülmemiş test girdisi"));
  const id = el("code", "ceremony-challenge-id mono", "ID  —");
  const hash = el("code", "ceremony-challenge-hash mono", "SHA256  —");
  const rail = el("div", "ceremony-parts");
  const parts = new Map();
  visual.parts.forEach(([key, label]) => {
    const item = createPart(key, label);
    rail.appendChild(item.part);
    parts.set(key, item);
  });
  node.append(head, title, id, hash, rail);
  return { node, id, hash, parts };
}

function createCapabilityModule(number, name, checks) {
  const module = el("div", "ceremony-module");
  module.dataset.state = "installed";
  const head = el("div", "ceremony-module-head");
  const mark = el("span", "ceremony-module-mark", "◇");
  const text = el("div", "ceremony-module-copy");
  text.append(el("strong", "", `Capability ${number}`), el("small", "", name));
  const state = el("span", "ceremony-module-state", copy("INSTALLED", "YÜKLÜ"));
  head.append(mark, text, state);
  const rowsWrap = el("div", "ceremony-module-checks");
  const rows = [];
  checks.forEach(([en, tr]) => {
    const row = el("div", "ceremony-module-check");
    row.dataset.state = "pending";
    row.append(el("span", "ceremony-check-mark", "○"), el("span", "", copy(en, tr)));
    rowsWrap.appendChild(row);
    rows.push(row);
  });
  module.append(head, rowsWrap);
  return { module, state, rows };
}

function createResult() {
  const node = el("section", "ceremony-result");
  node.dataset.state = "hidden";
  const top = el("div", "ceremony-result-top");
  top.append(el("span", "ceremony-kicker", "AGENT OUTPUT"), el("span", "ceremony-output-state", copy("CREATED", "OLUŞTU")));
  const title = el("strong", "ceremony-result-title", copy("Capability result", "Capability sonucu"));
  const data = el("pre", "ceremony-result-data mono", "—");
  const hash = el("code", "ceremony-result-hash mono", "result hash  —");
  const stamp = el("div", "ceremony-result-did");
  stamp.dataset.state = "hidden";
  stamp.append(el("span", "", "DID"), el("strong", "", "◇"));
  node.append(top, title, data, hash, stamp);
  return { node, data, hash, stamp };
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

  const agentSide = el("div", "ceremony-compare-side ceremony-compare-agent");
  agentSide.append(el("span", "", copy("AGENT RESULT", "AJAN SONUCU")));
  const agentCode = el("code", "mono", "—");
  agentSide.appendChild(agentCode);

  const lock = el("div", "ceremony-match-lock");
  lock.dataset.state = "waiting";
  lock.append(el("span", "ceremony-lock-glyph", "◇"), el("strong", "", copy("WAITING", "BEKLİYOR")));

  const flopSide = el("div", "ceremony-compare-side ceremony-compare-flop");
  flopSide.append(el("span", "", copy("FLOP RESULT", "FLOP SONUCU")));
  const flopCode = el("code", "mono", "—");
  flopSide.appendChild(flopCode);

  compare.append(agentSide, lock, flopSide);
  panel.append(id, compare);
  verifierActor.actor.appendChild(panel);
  return { panel, id, agent: agentCode, flop: flopCode, lock, lockText: lock.querySelector("strong") };
}

function createCertificate(number, name) {
  const node = el("article", "ceremony-certificate");
  node.dataset.state = "hidden";
  const brand = el("div", "ceremony-certificate-brand");
  brand.append(el("span", "ceremony-certificate-mark", "◇"), el("strong", "", "FLOP"));
  const type = el("span", "ceremony-certificate-type", "VERIFIED WORKING CAPABILITY");
  const cap = el("strong", "ceremony-certificate-cap", `Capability ${number}`);
  const capName = el("span", "ceremony-certificate-name", name);
  const statement = el("p", "ceremony-certificate-statement", copy(
    "This FLOP agent used the installed capability successfully on a fresh verification challenge.",
    "Bu FLOP ajanı yüklü capability'yi fresh verification challenge üzerinde başarıyla kullandı.",
  ));
  const fields = el("div", "ceremony-certificate-fields");
  const did = el("code", "mono", "DID  —");
  const receipt = el("code", "mono", "RECEIPT  —");
  const cert = el("code", "mono", "CERTIFICATE  —");
  fields.append(did, receipt, cert);
  const seal = el("div", "ceremony-certificate-seal");
  seal.append(el("span", "", "PASS"), el("strong", "", "◇"));
  node.append(brand, type, cap, capName, statement, fields, seal);
  return { node, did, receipt, cert, seal };
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
  return { strip, text };
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
    el("span", "ceremony-breadcrumb", copy("MY AGENT / LIVE VERIFICATION", "AJANIM / CANLI DOĞRULAMA")),
    el("h3", "ceremony-title", `Capability ${number} · ${name}`),
    el("p", "ceremony-subtitle", copy("Watch real verification events become portable proof.", "Gerçek doğrulama eventlerinin taşınabilir kanıta dönüşmesini izle.")),
  );
  const live = el("div", "ceremony-live");
  live.append(el("span", "ceremony-live-dot", ""), el("span", "", copy("REAL EVENTS", "GERÇEK EVENTLER")));
  head.append(headCopy, live);

  const stage = el("div", "ceremony-stage");
  const field = el("div", "ceremony-field");
  field.setAttribute("aria-hidden", "true");
  const challenge = createChallenge(number);
  const agent = createActor({ className: "ceremony-agent", kicker: copy("YOUR FLOP AGENT", "FLOP AJANIN"), title: copy("Agent Core", "Ajan Core"), canvasClass: "ceremony-core-canvas" });
  const module = createCapabilityModule(number, name, visual.checks);
  agent.actor.appendChild(module.module);
  const result = createResult();
  const didSeal = createDidSeal();
  const verifier = createActor({ className: "ceremony-verifier", kicker: "FLOP", title: copy("Independent verifier", "Bağımsız verifier"), canvasClass: "ceremony-verifier-canvas" });
  const verifierPanel = createVerifierPanel(verifier);
  const pass = el("div", "ceremony-pass");
  pass.dataset.state = "hidden";
  pass.append(el("span", "ceremony-pass-small", copy("RESULTS MATCH", "SONUÇLAR EŞLEŞTİ")), el("strong", "", "PASS"));
  const certificate = createCertificate(number, name);
  stage.append(field, challenge.node, agent.actor, result.node, didSeal.seal, verifier.actor, pass, certificate.node);

  const eventStrip = createEventStrip();
  const proofDock = createProofDock();
  shell.append(head, stage, eventStrip.strip, proofDock);
  container.replaceChildren(shell);
  container.hidden = true;

  function actorEnergy(step) {
    const state = states.get(step);
    if (state === "active") return 1;
    if (state === "done") return .66;
    return .16;
  }

  function render(time) {
    if (disposed) return;
    drawCore(agent.canvas, time, actorEnergy("execute"), "137,108,255", false);
    drawCore(verifier.canvas, time * .92, actorEnergy("verify"), "64,162,255", true);
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

  async function reveal(node, from = "translateY(14px) scale(.97)", duration = 420) {
    node.dataset.state = "visible";
    await animate(node, [{ opacity: 0, transform: from }, { opacity: 1, transform: "translate(0,0) scale(1)" }], { duration, easing: "cubic-bezier(.18,.86,.2,1)" }, reduced);
  }

  async function pulse(node, scale = 1.04, duration = 340) {
    await animate(node, [{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], { duration, easing: "cubic-bezier(.2,.8,.2,1)" }, reduced);
  }

  async function fade(node, opacity = 0, duration = 260) {
    await animate(node, [{ opacity: getComputedStyle(node).opacity || 1 }, { opacity }], { duration, easing: "ease-out" }, reduced);
  }

  function cloneArtifact(source, tone, kind) {
    const clone = source.cloneNode(true);
    clone.classList.add("ceremony-flight-artifact", `ceremony-flight-${tone}`, `ceremony-flight-${kind}`);
    clone.querySelectorAll?.("[id]").forEach((node) => node.removeAttribute("id"));
    return clone;
  }

  async function travel(from, to, tone = "violet", kind = "part") {
    const stageRect = stage.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const start = center(fromRect);
    const end = center(toRect);
    const clone = cloneArtifact(from, tone, kind);
    stage.appendChild(clone);
    clone.style.left = `${start.x - stageRect.left}px`;
    clone.style.top = `${start.y - stageRect.top}px`;
    clone.style.width = `${Math.max(34, Math.min(fromRect.width, kind === "result" ? 210 : 150))}px`;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lift = Math.max(18, Math.min(54, Math.abs(dx) * .11));
    await animate(clone, [
      { opacity: .15, transform: "translate(-50%,-50%) scale(.82)" },
      { opacity: 1, offset: .16, transform: `translate(calc(-50% + ${dx * .12}px), calc(-50% + ${dy * .07 - lift}px)) scale(1)` },
      { opacity: 1, offset: .74, transform: `translate(calc(-50% + ${dx * .78}px), calc(-50% + ${dy * .82 - lift * .32}px)) scale(.94)` },
      { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.56)` },
    ], { duration: kind === "result" ? 680 : 540, easing: "cubic-bezier(.22,.76,.22,1)" }, reduced);
    clone.remove();
  }

  async function materializeFrom(from, node) {
    node.dataset.state = "visible";
    const a = center(from.getBoundingClientRect());
    const b = center(node.getBoundingClientRect());
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    await animate(node, [
      { opacity: 0, clipPath: "inset(45% 45% 45% 45%)", transform: `translate(${dx}px, ${dy}px) scale(.16)` },
      { opacity: .95, offset: .72, clipPath: "inset(0 0 0 0)", transform: "translate(4px,-2px) scale(1.02)" },
      { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "translate(0,0) scale(1)" },
    ], { duration: 700, easing: "cubic-bezier(.16,.88,.2,1)" }, reduced);
  }

  async function animateChallenge() {
    challenge.node.dataset.state = "visible";
    await animate(challenge.node, [
      { opacity: 0, transform: "translateX(-28px)", clipPath: "inset(0 88% 0 0)" },
      { opacity: 1, transform: "translateX(0)", clipPath: "inset(0 0 0 0)" },
    ], { duration: 500, easing: "cubic-bezier(.18,.86,.2,1)" }, reduced);
    for (const item of challenge.parts.values()) {
      item.part.dataset.state = "ready";
      await animate(item.part, [{ opacity: .18, transform: "translateX(-10px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 135, easing: "ease-out" }, reduced);
    }
  }

  async function animateExecution() {
    agent.actor.dataset.state = "active";
    module.module.dataset.state = "active";
    say("Fresh challenge fragments are entering the installed capability.", "Fresh challenge parçaları yüklü capability içine giriyor.");
    const items = [...challenge.parts.values()];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const port = agent.ports[i % agent.ports.length];
      item.part.dataset.state = "extracting";
      await travel(item.part, port, "violet", "part");
      item.part.dataset.state = "consumed";
      port.dataset.state = "loaded";
      const row = module.rows[i];
      if (row) {
        row.dataset.state = "done";
        row.querySelector(".ceremony-check-mark").textContent = "●";
      }
    }
    challenge.node.dataset.state = "spent";
    module.state.textContent = copy("EXECUTED", "ÇALIŞTI");
    module.module.dataset.state = "done";
    await pulse(agent.canvas, 1.03, 460);
  }

  async function animateResult() {
    say("A new result artifact is leaving Agent Core.", "Yeni sonuç artifact'i Agent Core'dan çıkıyor.");
    await materializeFrom(agent.actor, result.node);
    agent.actor.dataset.state = "done";
  }

  async function animateSign() {
    didSeal.seal.dataset.state = "visible";
    await reveal(didSeal.seal, "translateY(-18px) scale(.72)", 320);
    const a = center(didSeal.seal.getBoundingClientRect());
    const b = center(result.stamp.getBoundingClientRect());
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    await animate(didSeal.seal, [
      { opacity: 1, transform: "translate(0,0) scale(1)" },
      { opacity: 1, offset: .76, transform: `translate(${dx * .9}px, ${dy * .9}px) scale(.7)` },
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.48)` },
    ], { duration: 580, easing: "cubic-bezier(.18,.84,.2,1)" }, reduced);
    didSeal.seal.dataset.state = "docked";
    result.stamp.dataset.state = "visible";
    await animate(result.stamp, [{ opacity: 0, transform: "scale(1.6)" }, { opacity: 1, transform: "scale(.94)" }, { opacity: 1, transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.16,.9,.2,1)" }, reduced);
    result.node.dataset.signed = "true";
  }

  async function animateVerification() {
    verifier.actor.dataset.state = "waking";
    await animate(verifier.actor, [{ opacity: 0, transform: "translateX(34px) scale(.92)" }, { opacity: 1, transform: "translateX(0) scale(1)" }], { duration: 500, easing: "cubic-bezier(.18,.86,.2,1)" }, reduced);
    verifier.actor.dataset.state = "active";
    verifierPanel.panel.dataset.state = "visible";
    await reveal(verifierPanel.panel, "translateY(10px) scale(.97)", 300);
    say("Signed agent output is entering FLOP's independent verifier.", "İmzalı ajan çıktısı FLOP'un bağımsız verifier'ına giriyor.");
    await travel(result.node, verifier.actor, "blue", "result");
    result.node.dataset.state = "submitted";
    await pulse(verifier.canvas, 1.025, 420);
    verifier.actor.dataset.state = "done";
  }

  async function animateVerdict(state) {
    if (state === "done") {
      verifierPanel.lock.dataset.state = "matching";
      verifierPanel.lockText.textContent = copy("COMPARING", "KARŞILAŞTIRILIYOR");
      await animate(verifierPanel.lock, [{ transform: "scale(.82)", opacity: .45 }, { transform: "scale(1.08)", opacity: 1 }, { transform: "scale(1)", opacity: 1 }], { duration: 500, easing: "cubic-bezier(.16,.9,.2,1)" }, reduced);
      verifierPanel.lock.dataset.state = "match";
      verifierPanel.lockText.textContent = "MATCH";
      pass.dataset.state = "visible";
      await animate(pass, [
        { opacity: 0, clipPath: "inset(48% 0 48% 0)", transform: "scale(.9)" },
        { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "scale(1.03)" },
        { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "scale(1)" },
      ], { duration: 620, easing: "cubic-bezier(.14,.9,.2,1)" }, reduced);
    } else if (state === "fail") {
      verifierPanel.lock.dataset.state = "fail";
      verifierPanel.lockText.textContent = "MISMATCH";
      pass.dataset.state = "fail";
      pass.replaceChildren(el("span", "ceremony-pass-small", copy("RESULTS DO NOT MATCH", "SONUÇLAR EŞLEŞMEDİ")), el("strong", "", "FAIL"));
      await reveal(pass, "scale(.86)", 420);
    } else {
      verifierPanel.lock.dataset.state = "unknown";
      verifierPanel.lockText.textContent = "UNKNOWN";
    }
  }

  async function animateCertificate() {
    say("PASS is becoming an individual capability certificate.", "PASS bireysel capability certificate'a dönüşüyor.");
    certificate.node.dataset.state = "forming";
    const target = certificate.node;
    await Promise.all([
      fade(challenge.node, .2, 260),
      fade(agent.actor, .28, 260),
      fade(result.node, .32, 260),
      fade(verifier.actor, .28, 260),
      fade(pass, .5, 260),
    ]);
    await travel(challenge.hash, target, "gold", "proof");
    await travel(result.hash, target, "gold", "proof");
    await travel(result.stamp, target, "gold", "proof");
    await travel(verifierPanel.lock, target, "blue", "proof");
    await travel(pass, target, "gold", "proof");

    await Promise.all([
      fade(challenge.node, 0, 220),
      fade(agent.actor, 0, 220),
      fade(result.node, 0, 220),
      fade(verifier.actor, 0, 220),
      fade(pass, 0, 220),
    ]);
    certificate.node.dataset.state = "visible";
    await animate(certificate.node, [
      { opacity: 0, transform: "scale(.9)", clipPath: "inset(45% 45% 45% 45%)" },
      { opacity: 1, offset: .76, transform: "scale(1.02)", clipPath: "inset(0 0 0 0)" },
      { opacity: 1, transform: "scale(1)", clipPath: "inset(0 0 0 0)" },
    ], { duration: 720, easing: "cubic-bezier(.14,.9,.2,1)" }, reduced);
    await pulse(certificate.seal, 1.12, 380);
    proofDock.dataset.state = "visible";
    await reveal(proofDock, "translateY(12px)", 380);
  }

  function reset() {
    visualTail = Promise.resolve();
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

    agent.actor.dataset.state = "idle";
    agent.actor.style.opacity = "";
    agent.ports.forEach((port) => { port.dataset.state = "empty"; });
    module.module.dataset.state = "installed";
    module.state.textContent = copy("INSTALLED", "YÜKLÜ");
    module.rows.forEach((row) => {
      row.dataset.state = "pending";
      row.querySelector(".ceremony-check-mark").textContent = "○";
    });

    result.node.dataset.state = "hidden";
    result.node.style.opacity = "";
    delete result.node.dataset.signed;
    result.data.textContent = "—";
    result.hash.textContent = "result hash  —";
    result.stamp.dataset.state = "hidden";

    didSeal.seal.dataset.state = "hidden";
    didSeal.seal.style.opacity = "";
    didSeal.detail.textContent = "—";

    verifier.actor.dataset.state = "idle";
    verifier.actor.style.opacity = "";
    verifierPanel.panel.dataset.state = "hidden";
    verifierPanel.id.textContent = "verifier  —";
    verifierPanel.agent.textContent = "—";
    verifierPanel.flop.textContent = "—";
    verifierPanel.lock.dataset.state = "waiting";
    verifierPanel.lockText.textContent = copy("WAITING", "BEKLİYOR");

    pass.dataset.state = "hidden";
    pass.style.opacity = "";
    pass.replaceChildren(el("span", "ceremony-pass-small", copy("RESULTS MATCH", "SONUÇLAR EŞLEŞTİ")), el("strong", "", "PASS"));

    certificate.node.dataset.state = "hidden";
    certificate.did.textContent = "DID  —";
    certificate.receipt.textContent = "RECEIPT  —";
    certificate.cert.textContent = "CERTIFICATE  —";

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
    if (step === "verify") verifier.actor.dataset.state = "waking";
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
