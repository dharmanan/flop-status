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
  const radius = unit * (verifier ? .205 : .225);
  const aperture = radius * (1 + energy * .035);
  const phase = time * (verifier ? -.00016 : .00019);

  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = `rgba(${rgb},${.12 + energy * .14})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(aperture * .72, 0);
    ctx.lineTo(aperture * 1.52, 0);
    ctx.stroke();
  }

  for (let ring = 0; ring < 3; ring += 1) {
    const r = aperture * (.72 + ring * .31);
    const sweep = Math.PI * (1.08 + ring * .17);
    const start = phase * (ring % 2 ? -1.35 : 1) + ring * 1.14;
    ctx.strokeStyle = `rgba(${rgb},${.2 + energy * (.16 - ring * .025)})`;
    ctx.lineWidth = ring === 0 ? 1.5 : .8;
    ctx.beginPath();
    ctx.arc(0, 0, r, start, start + sweep);
    ctx.stroke();
  }

  const plate = aperture * .64;
  ctx.rotate(Math.PI / 4 + phase * .45);
  ctx.fillStyle = verifier ? "rgba(8,25,40,.88)" : "rgba(22,16,45,.9)";
  ctx.strokeStyle = `rgba(${rgb},${.54 + energy * .28})`;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.rect(-plate / 2, -plate / 2, plate, plate);
  ctx.fill();
  ctx.stroke();

  ctx.rotate(-phase * (verifier ? .8 : .65));
  const inner = plate * .46;
  ctx.strokeStyle = `rgba(${rgb},${.72 + energy * .18})`;
  ctx.lineWidth = 1.35;
  ctx.strokeRect(-inner / 2, -inner / 2, inner, inner);

  ctx.fillStyle = `rgba(${rgb},${.58 + energy * .28})`;
  const nodeR = Math.max(2.4, unit * .009);
  for (let i = 0; i < 4; i += 1) {
    const angle = phase * (verifier ? -1.2 : 1.4) + i * Math.PI / 2;
    const orbit = aperture * .94;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, nodeR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function createActor({ className, kicker, title, canvasClass, rgb, verifier = false }) {
  const actor = el("section", `ceremony-actor ${className}`);
  actor.dataset.state = "idle";
  const label = el("div", "ceremony-actor-label");
  label.append(el("span", "ceremony-kicker", kicker), el("strong", "ceremony-actor-title", title));
  const canvas = createCoreCanvas(canvasClass);
  const ports = el("div", "ceremony-core-ports");
  const portNodes = [];
  for (let i = 0; i < 4; i += 1) {
    const port = el("span", "ceremony-core-port", String(i + 1));
    port.dataset.state = "empty";
    ports.appendChild(port);
    portNodes.push(port);
  }
  actor.append(label, canvas, ports);
  actor.dataset.rgb = rgb;
  actor.dataset.verifier = verifier ? "true" : "false";
  return { actor, canvas, label, ports: portNodes };
}

function glyphFor(key) {
  if (key === "signature") return "∿";
  if (key.includes("key")) return "⌁";
  if (key.includes("sha")) return "#";
  if (key === "receipt") return "R";
  if (key === "nonce") return "N";
  return "▱";
}

function createPart(key, label) {
  const part = el("div", "ceremony-part");
  part.dataset.key = key;
  part.dataset.state = "hidden";
  const glyph = el("span", "ceremony-part-glyph", glyphFor(key));
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
  const rail = el("span", "ceremony-challenge-rail", "");
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
  node.append(rail, top, title, meta, partsWrap);
  return { node, rail, title, id, hash, parts, visual };
}

function createCapabilityModule(number, name, checks) {
  const module = el("div", "ceremony-module");
  module.dataset.state = "installed";
  const head = el("div", "ceremony-module-head");
  const mark = el("span", "ceremony-module-mark", "◇");
  const copyWrap = el("div", "ceremony-module-copy");
  copyWrap.append(el("strong", "", `Capability ${number}`), el("small", "", name));
  head.append(mark, copyWrap);
  const state = el("span", "ceremony-module-state", copy("INSTALLED", "YÜKLÜ"));
  const list = el("div", "ceremony-module-checks");
  const rows = [];
  checks.forEach(([en, tr], index) => {
    const row = el("div", "ceremony-module-check");
    row.dataset.state = "pending";
    row.dataset.index = String(index);
    row.append(el("span", "ceremony-check-mark", "○"), el("span", "", copy(en, tr)));
    list.appendChild(row);
    rows.push(row);
  });
  module.append(head, state, list);
  return { module, state, rows };
}

function createResult() {
  const node = el("section", "ceremony-object ceremony-result");
  node.dataset.state = "hidden";
  const spine = el("span", "ceremony-result-spine", "");
  const top = el("div", "ceremony-object-top");
  top.append(el("span", "ceremony-kicker", "AGENT OUTPUT"), el("span", "ceremony-output-state", copy("CREATED", "OLUŞTU")));
  const title = el("strong", "ceremony-object-title", copy("Capability result", "Capability sonucu"));
  const data = el("pre", "ceremony-result-data mono", "—");
  const hash = el("code", "ceremony-result-hash mono", "result hash  —");
  const stamp = el("div", "ceremony-result-seal");
  stamp.dataset.state = "hidden";
  stamp.append(el("span", "", "DID"), el("strong", "", "◇"));
  node.append(spine, top, title, data, hash, stamp);
  return { node, data, hash, stamp };
}

function createDidSeal() {
  const seal = el("div", "ceremony-did-seal");
  seal.dataset.state = "hidden";
  const face = el("div", "ceremony-seal-face");
  face.append(el("span", "ceremony-seal-symbol", "◇"), el("strong", "", "DID"));
  const action = el("small", "", "SIGN");
  const detail = el("code", "ceremony-seal-detail mono", "—");
  seal.append(face, action, detail);
  return { seal, detail };
}

function createVerifierPanel(verifierActor) {
  const panel = el("div", "ceremony-verifier-panel");
  panel.dataset.state = "hidden";
  const id = el("code", "ceremony-verifier-id mono", "verifier  —");
  const compare = el("div", "ceremony-compare");

  const agentLane = el("div", "ceremony-compare-lane ceremony-compare-agent");
  const agentLabel = el("span", "", copy("AGENT RESULT", "AJAN SONUCU"));
  const agentToken = el("div", "ceremony-compare-token ceremony-agent-token");
  agentToken.dataset.state = "empty";
  const agentCode = el("code", "mono", "—");
  agentToken.append(el("i", "", "A"), agentCode);
  agentLane.append(agentLabel, agentToken);

  const lock = el("div", "ceremony-match-lock");
  lock.dataset.state = "waiting";
  lock.append(el("span", "ceremony-lock-glyph", "◇"), el("strong", "", copy("WAITING", "BEKLİYOR")));

  const flopLane = el("div", "ceremony-compare-lane ceremony-compare-flop");
  const flopLabel = el("span", "", copy("FLOP RESULT", "FLOP SONUCU"));
  const flopToken = el("div", "ceremony-compare-token ceremony-flop-token");
  flopToken.dataset.state = "empty";
  const flopCode = el("code", "mono", "—");
  flopToken.append(el("i", "", "F"), flopCode);
  flopLane.append(flopLabel, flopToken);

  compare.append(agentLane, lock, flopLane);
  panel.append(id, compare);
  verifierActor.actor.appendChild(panel);
  return { panel, id, agent: agentCode, flop: flopCode, agentToken, flopToken, lock, lockText: lock.querySelector("strong") };
}

function createCertificate(number, name) {
  const node = el("article", "ceremony-certificate");
  node.dataset.state = "hidden";
  const assembly = el("div", "ceremony-certificate-assembly");
  for (const key of ["challenge", "result", "did", "verifier"]) {
    const slot = el("span", `ceremony-certificate-slot ceremony-certificate-slot-${key}`, "");
    slot.dataset.state = "empty";
    slot.dataset.source = key;
    assembly.appendChild(slot);
  }
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
  const seal = el("div", "ceremony-certificate-seal");
  seal.append(el("span", "", "PASS"), el("strong", "", "◇"));
  node.append(assembly, brand, type, cap, capName, fields, seal);
  const slots = new Map([...assembly.children].map((slot) => [slot.dataset.source, slot]));
  return { node, did, receipt, cert, slots, seal };
}

function createProofDock() {
  const dock = el("section", "ceremony-proof-dock");
  dock.dataset.state = "hidden";
  const intro = el("div", "ceremony-proof-intro");
  intro.append(el("span", "ceremony-kicker", copy("PROOF CAN LEAVE FLOP", "KANIT FLOP DIŞINA ÇIKABİLİR")), el("strong", "", copy("Execution stays. Proof travels.", "Çalıştırma kalır. Kanıt taşınır.")));
  const split = el("div", "ceremony-proof-split");
  const inside = el("div", "ceremony-boundary-side ceremony-boundary-inside");
  inside.append(el("span", "", copy("STAYS INSIDE FLOP", "FLOP İÇİNDE KALIR")), el("strong", "", copy("Agent Core + Capability", "Ajan Core + Capability")));
  const boundary = el("div", "ceremony-boundary-line");
  boundary.append(el("span", "", "FLOP"));
  const outside = el("div", "ceremony-boundary-side ceremony-boundary-outside");
  outside.append(el("span", "", copy("PORTABLE PROOF", "TAŞINABİLİR KANIT")), el("strong", "", "DID · Certificate · Receipt · Public proof"));
  const chips = el("div", "ceremony-proof-chips");
  const chipNodes = [];
  for (const label of ["DID", "CERT", "RECEIPT", "PUBLIC"]) {
    const chip = el("span", "ceremony-proof-chip", label);
    chip.dataset.state = "parked";
    chips.appendChild(chip);
    chipNodes.push(chip);
  }
  outside.appendChild(chips);
  split.append(inside, boundary, outside);
  dock.append(intro, split);
  dock.proofChips = chipNodes;
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

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
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
  const field = el("div", "ceremony-field");
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
    if (state === "done") return .74;
    return .18;
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

  async function reveal(node, from = "translateY(18px) scale(.96)", duration = 430) {
    node.dataset.state = "visible";
    await animate(node, [{ opacity: 0, transform: from }, { opacity: 1, transform: "translate(0,0) scale(1)" }], { duration, easing: "cubic-bezier(.2,.9,.2,1)" }, reduced);
  }

  async function pulse(node, scale = 1.05, duration = 380) {
    await animate(node, [{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], { duration, easing: "cubic-bezier(.2,.8,.2,1)" }, reduced);
  }

  function flightClone(source, tone, kind) {
    const clone = source.cloneNode(true);
    clone.removeAttribute?.("id");
    clone.classList.add("ceremony-flight-artifact", `ceremony-flight-${tone}`, `ceremony-flight-${kind}`);
    clone.dataset.state = "flying";
    clone.querySelectorAll?.("[id]").forEach((node) => node.removeAttribute("id"));
    return clone;
  }

  async function travel(from, to, source = from, tone = "violet", kind = "part") {
    const stageRect = stage.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const start = center(fromRect);
    const end = center(toRect);
    const clone = flightClone(source, tone, kind);
    stage.appendChild(clone);
    clone.style.left = `${start.x - stageRect.left}px`;
    clone.style.top = `${start.y - stageRect.top}px`;
    clone.style.width = `${Math.max(38, Math.min(fromRect.width, kind === "result" ? 190 : 132))}px`;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lift = Math.max(22, Math.min(62, Math.abs(dx) * .12));
    await animate(clone, [
      { opacity: .15, transform: "translate(-50%,-50%) scale(.82) rotate(0deg)" },
      { opacity: 1, offset: .14, transform: `translate(calc(-50% + ${dx * .10}px), calc(-50% + ${dy * .06 - lift}px)) scale(1) rotate(-1.5deg)` },
      { opacity: 1, offset: .72, transform: `translate(calc(-50% + ${dx * .76}px), calc(-50% + ${dy * .80 - lift * .42}px)) scale(.96) rotate(.8deg)` },
      { opacity: .08, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.58) rotate(0deg)` },
    ], { duration: kind === "result" ? 720 : 560, easing: "cubic-bezier(.22,.74,.24,1)" }, reduced);
    clone.remove();
  }

  async function materializeFrom(from, node, fromScale = .18) {
    node.dataset.state = "visible";
    const fromRect = from.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const a = center(fromRect);
    const b = center(nodeRect);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    await animate(node, [
      { opacity: 0, clipPath: "inset(46% 46% 46% 46%)", transform: `translate(${dx}px, ${dy}px) scale(${fromScale}) rotate(-5deg)` },
      { opacity: .92, offset: .72, clipPath: "inset(0 0 0 0)", transform: "translate(6px, -3px) scale(1.025) rotate(.6deg)" },
      { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "translate(0,0) scale(1) rotate(0deg)" },
    ], { duration: 720, easing: "cubic-bezier(.16,.88,.22,1)" }, reduced);
  }

  async function animateChallenge() {
    challenge.node.dataset.state = "visible";
    await animate(challenge.node, [
      { opacity: 0, transform: "translateX(-34px) scale(.965)", clipPath: "inset(0 82% 0 0)" },
      { opacity: 1, transform: "translateX(0) scale(1)", clipPath: "inset(0 0 0 0)" },
    ], { duration: 520, easing: "cubic-bezier(.18,.86,.2,1)" }, reduced);
    await animate(challenge.rail, [{ transform: "scaleY(.1)", opacity: .2 }, { transform: "scaleY(1)", opacity: 1 }], { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" }, reduced);
    for (const item of challenge.parts.values()) {
      item.part.dataset.state = "ready";
      await animate(item.part, [
        { opacity: .16, transform: "translateX(-12px)" },
        { opacity: 1, transform: "translateX(0)" },
      ], { duration: 150, easing: "ease-out" }, reduced);
    }
  }

  async function animateExecution() {
    agent.actor.dataset.state = "active";
    module.module.dataset.state = "active";
    say("Fresh input is entering the installed capability.", "Fresh girdi yüklü capability içine giriyor.");
    const items = [...challenge.parts.values()];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const port = agent.ports[index % agent.ports.length];
      item.part.dataset.state = "extracting";
      await animate(item.part, [
        { transform: "translateX(0) scale(1)" },
        { transform: "translateX(9px) scale(1.025)" },
      ], { duration: 150, easing: "cubic-bezier(.2,.8,.2,1)" }, reduced);
      await travel(item.part, port, item.part, "violet", "part");
      item.part.dataset.state = "consumed";
      port.dataset.state = "loaded";
      await pulse(port, 1.24, 260);
      const row = module.rows[index];
      if (row) {
        row.dataset.state = "done";
        row.querySelector(".ceremony-check-mark").textContent = "●";
        await animate(row, [
          { opacity: .22, transform: "translateX(-4px)" },
          { opacity: 1, transform: "translateX(0)" },
        ], { duration: 190, easing: "ease-out" }, reduced);
      }
    }
    challenge.node.dataset.state = "spent";
    module.state.textContent = copy("EXECUTED", "ÇALIŞTI");
    module.module.dataset.state = "done";
    agent.actor.dataset.state = "processing";
    await animate(agent.canvas, [
      { transform: "scale(1) rotate(0deg)" },
      { transform: "scale(1.035) rotate(.5deg)" },
      { transform: "scale(1) rotate(0deg)" },
    ], { duration: 520, easing: "cubic-bezier(.2,.78,.2,1)" }, reduced);
  }

  async function animateResult() {
    say("The capability produced a new result artifact.", "Capability yeni bir sonuç artifact'i üretti.");
    await materializeFrom(agent.actor, result.node, .16);
    result.node.dataset.state = "visible";
    agent.actor.dataset.state = "done";
  }

  async function animateSign() {
    didSeal.seal.dataset.state = "visible";
    await reveal(didSeal.seal, "translateY(-24px) scale(.7)", 360);
    const sealRect = didSeal.seal.getBoundingClientRect();
    const stampRect = result.stamp.getBoundingClientRect();
    const from = center(sealRect);
    const to = center(stampRect);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    await animate(didSeal.seal, [
      { opacity: 1, transform: "translate(0,0) scale(1) rotate(-3deg)" },
      { opacity: 1, offset: .72, transform: `translate(${dx * .86}px, ${dy * .86}px) scale(.78) rotate(2deg)` },
      { opacity: .08, transform: `translate(${dx}px, ${dy}px) scale(.56) rotate(0deg)` },
    ], { duration: 620, easing: "cubic-bezier(.18,.82,.2,1)" }, reduced);
    didSeal.seal.dataset.state = "docked";
    result.stamp.dataset.state = "visible";
    await animate(result.stamp, [
      { opacity: 0, transform: "scale(1.8) rotate(-8deg)" },
      { opacity: 1, transform: "scale(.92) rotate(1deg)" },
      { opacity: 1, transform: "scale(1) rotate(0deg)" },
    ], { duration: 440, easing: "cubic-bezier(.12,.9,.2,1)" }, reduced);
    result.node.dataset.signed = "true";
    result.node.dataset.state = "signed";
  }

  async function animateVerification() {
    verifier.actor.dataset.state = "waking";
    verifierPanel.panel.dataset.state = "visible";
    await animate(verifier.actor, [
      { opacity: .08, transform: "scale(.9) translateX(28px)" },
      { opacity: 1, transform: "scale(1) translateX(0)" },
    ], { duration: 520, easing: "cubic-bezier(.18,.86,.2,1)" }, reduced);
    verifier.actor.dataset.state = "active";
    await reveal(verifierPanel.panel, "translateY(14px) scale(.96)", 360);
    say("Signed agent output is moving to FLOP's independent verifier.", "İmzalı ajan çıktısı FLOP'un bağımsız verifier'ına gidiyor.");
    await travel(result.node, verifierPanel.agentToken, result.node, "blue", "result");
    verifierPanel.agentToken.dataset.state = "loaded";
    result.node.dataset.state = "submitted";
    await pulse(verifierPanel.agentToken, 1.08, 260);

    verifierPanel.flopToken.dataset.state = "computing";
    await materializeFrom(verifier.actor, verifierPanel.flopToken, .22);
    verifierPanel.flopToken.dataset.state = "loaded";
    await pulse(verifierPanel.flopToken, 1.08, 260);
    verifier.actor.dataset.state = "done";
  }

  async function animateVerdict(state) {
    if (state === "done") {
      verifierPanel.lock.dataset.state = "matching";
      verifierPanel.lockText.textContent = copy("COMPARING", "KARŞILAŞTIRILIYOR");
      await Promise.all([
        animate(verifierPanel.agentToken, [
          { transform: "translateX(0) scale(1)" },
          { transform: "translateX(30px) scale(.94)" },
        ], { duration: 420, easing: "cubic-bezier(.2,.82,.2,1)" }, reduced),
        animate(verifierPanel.flopToken, [
          { transform: "translateX(0) scale(1)" },
          { transform: "translateX(-30px) scale(.94)" },
        ], { duration: 420, easing: "cubic-bezier(.2,.82,.2,1)" }, reduced),
      ]);
      verifierPanel.lock.dataset.state = "match";
      verifierPanel.lockText.textContent = "MATCH";
      await animate(verifierPanel.lock, [
        { transform: "scale(.72) rotate(-8deg)", opacity: .35 },
        { transform: "scale(1.12) rotate(2deg)", opacity: 1 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
      ], { duration: 540, easing: "cubic-bezier(.16,.9,.2,1)" }, reduced);
      pass.dataset.state = "visible";
      await animate(pass, [
        { opacity: 0, clipPath: "inset(48% 0 48% 0)", transform: "scale(.84)" },
        { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "scale(1.035)" },
        { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "scale(1)" },
      ], { duration: 620, easing: "cubic-bezier(.14,.9,.2,1)" }, reduced);
    } else if (state === "fail") {
      verifierPanel.lock.dataset.state = "fail";
      verifierPanel.lockText.textContent = "MISMATCH";
      pass.dataset.state = "fail";
      pass.replaceChildren(el("span", "ceremony-pass-small", copy("RESULTS DO NOT MATCH", "SONUÇLAR EŞLEŞMEDİ")), el("strong", "", "FAIL"));
      await animate(pass, [
        { opacity: 0, transform: "scale(.84)" },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 460, easing: "cubic-bezier(.18,.86,.2,1)" }, reduced);
    } else {
      verifierPanel.lock.dataset.state = "unknown";
      verifierPanel.lockText.textContent = "UNKNOWN";
    }
  }

  async function assembleCertificateSource(source, slot, tone, kind) {
    if (!source || !slot) return;
    await travel(source, slot, source, tone, kind);
    slot.dataset.state = "filled";
    await pulse(slot, 1.18, 220);
  }

  async function animateCertificate() {
    say("PASS is now being sealed into an individual capability certificate.", "PASS şimdi capability'ye özel certificate içine mühürleniyor.");
    verifier.actor.dataset.state = "receding";
    certificate.node.dataset.state = "forming";
    await animate(certificate.node, [
      { opacity: 0, clipPath: "inset(0 100% 0 0)" },
      { opacity: .34, clipPath: "inset(0 0 0 0)" },
    ], { duration: 420, easing: "cubic-bezier(.2,.82,.2,1)" }, reduced);

    await travel(pass, certificate.seal, pass, "gold", "proof");
    pass.dataset.state = "sealing";
    await assembleCertificateSource(challenge.hash, certificate.slots.get("challenge"), "gold", "proof");
    await assembleCertificateSource(result.node, certificate.slots.get("result"), "gold", "result");
    await assembleCertificateSource(result.stamp, certificate.slots.get("did"), "gold", "seal");
    await assembleCertificateSource(verifierPanel.lock, certificate.slots.get("verifier"), "blue", "proof");

    certificate.node.dataset.state = "visible";
    await animate(certificate.node, [
      { opacity: .42, transform: "translateX(16px) scale(.97)" },
      { opacity: 1, transform: "translateX(0) scale(1)" },
    ], { duration: 520, easing: "cubic-bezier(.18,.88,.2,1)" }, reduced);
    await animate(certificate.seal, [
      { opacity: .2, transform: "scale(1.7) rotate(-12deg)" },
      { opacity: 1, transform: "scale(.94) rotate(2deg)" },
      { opacity: 1, transform: "scale(1) rotate(0deg)" },
    ], { duration: 520, easing: "cubic-bezier(.16,.9,.2,1)" }, reduced);

    proofDock.dataset.state = "visible";
    await reveal(proofDock, "translateY(16px)", 440);
    for (const chip of proofDock.proofChips ?? []) {
      chip.dataset.state = "portable";
      await animate(chip, [
        { opacity: .18, transform: "translateX(-34px) scale(.9)" },
        { opacity: 1, transform: "translateX(0) scale(1)" },
      ], { duration: 150, easing: "ease-out" }, reduced);
    }
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
    agent.ports.forEach((port) => { port.dataset.state = "empty"; });
    module.module.dataset.state = "installed";
    module.state.textContent = copy("INSTALLED", "YÜKLÜ");
    module.rows.forEach((row) => {
      row.dataset.state = "pending";
      row.querySelector(".ceremony-check-mark").textContent = "○";
    });

    result.node.dataset.state = "hidden";
    delete result.node.dataset.signed;
    result.data.textContent = "—";
    result.hash.textContent = "result hash  —";
    result.stamp.dataset.state = "hidden";

    didSeal.seal.dataset.state = "hidden";
    didSeal.detail.textContent = "—";

    verifier.actor.dataset.state = "idle";
    verifier.ports.forEach((port) => { port.dataset.state = "empty"; });
    verifierPanel.panel.dataset.state = "hidden";
    verifierPanel.id.textContent = "verifier  —";
    verifierPanel.agent.textContent = "—";
    verifierPanel.flop.textContent = "—";
    verifierPanel.agentToken.dataset.state = "empty";
    verifierPanel.flopToken.dataset.state = "empty";
    verifierPanel.lock.dataset.state = "waiting";
    verifierPanel.lockText.textContent = copy("WAITING", "BEKLİYOR");

    certificate.node.dataset.state = "hidden";
    certificate.did.textContent = "DID  —";
    certificate.receipt.textContent = "RECEIPT  —";
    certificate.cert.textContent = "CERTIFICATE  —";
    certificate.slots.forEach((slot) => { slot.dataset.state = "empty"; });

    pass.dataset.state = "hidden";
    pass.replaceChildren(el("span", "ceremony-pass-small", copy("RESULTS MATCH", "SONUÇLAR EŞLEŞTİ")), el("strong", "", "PASS"));
    proofDock.dataset.state = "hidden";
    for (const chip of proofDock.proofChips ?? []) chip.dataset.state = "parked";

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
