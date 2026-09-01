const STEPS = ["challenge", "execute", "result", "sign", "verify", "verdict", "certificate"];

const STEP_COPY = {
  challenge: ["Challenge", "Challenge"],
  execute: ["Capability", "Capability"],
  result: ["Output", "Output"],
  sign: ["DID", "DID"],
  verify: ["FLOP", "FLOP"],
  verdict: ["Decision", "Karar"],
  certificate: ["Certificate", "Sertifika"],
};

const VISUALS = {
  1: {
    inputs: [["public_key", "Public key"], ["message", "Message bytes"], ["signature", "Ed25519 signature"]],
    checks: [
      ["Key decoded", "Anahtar çözüldü"],
      ["Signature parsed", "İmza ayrıştırıldı"],
      ["Message bound", "Mesaj bağlandı"],
      ["Signature verdict", "İmza kararı"],
    ],
  },
  2: {
    inputs: [["document", "JSON document"], ["canonical", "RFC 8785"], ["utf8", "UTF-8 bytes"], ["sha256", "SHA256"]],
    checks: [
      ["JSON normalized", "JSON normalize edildi"],
      ["Canonical form built", "Canonical biçim üretildi"],
      ["UTF-8 bytes fixed", "UTF-8 byte'ları sabitlendi"],
      ["Digest calculated", "Digest hesaplandı"],
    ],
  },
  3: {
    inputs: [["room", "Room"], ["nonce", "Nonce"], ["text", "Raw message"], ["canonical", "room|nonce|text"]],
    checks: [
      ["Text cleaned", "Metin temizlendi"],
      ["Room preserved", "Room korundu"],
      ["Nonce preserved", "Nonce korundu"],
      ["Canonical message built", "Canonical mesaj üretildi"],
    ],
  },
  4: {
    inputs: [["receipt", "Signed receipt"], ["signature", "Receipt signature"], ["key_id", "Server key id"], ["server_keys", "Server key set"]],
    checks: [
      ["Key id matched", "Key ID eşleşti"],
      ["Signature checked", "İmza doğrulandı"],
      ["Payload integrity", "Payload bütünlüğü"],
      ["Receipt classified", "Receipt sınıflandırıldı"],
    ],
  },
};

function lang() {
  return document.documentElement.lang === "tr" ? "tr" : "en";
}

function c(en, tr) {
  return lang() === "tr" ? tr : en;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function short(value, max = 34) {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(9, max - 9))}…${text.slice(-8)}`;
}

function pretty(value, max = 540) {
  let text;
  try { text = JSON.stringify(value, null, 2); }
  catch { text = String(value ?? ""); }
  return text.length > max ? `${text.slice(0, max)}\n…` : text;
}

function inputValue(caseData, key) {
  if (!caseData || typeof caseData !== "object") return "";
  if (key in caseData) return caseData[key];
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

function createProgress() {
  const wrap = el("div", "ceremony-progress");
  const items = new Map();
  STEPS.forEach((id, index) => {
    const item = el("div", "ceremony-progress-item");
    item.dataset.step = id;
    item.dataset.state = "pending";
    const marker = el("span", "ceremony-progress-marker", index + 1);
    const copy = el("span", "ceremony-progress-copy");
    const title = el("strong", "", c(STEP_COPY[id][0], STEP_COPY[id][1]));
    const state = el("small", "", c("waiting", "bekliyor"));
    copy.append(title, state);
    item.append(marker, copy);
    wrap.appendChild(item);
    items.set(id, { item, marker, title, state });
  });
  return { wrap, items };
}

function artifactTile(key, label) {
  const tile = el("div", "ceremony-artifact-tile");
  tile.dataset.key = key;
  const icon = el("span", "ceremony-artifact-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = key === "signature" ? "∿" : key.includes("key") ? "⌁" : key.includes("sha") ? "#" : "▱";
  const body = el("div", "ceremony-artifact-body");
  const title = el("strong", "", label);
  const value = el("span", "mono", c("waiting for fresh input", "fresh input bekleniyor"));
  body.append(title, value);
  tile.append(icon, body);
  return { tile, title, value };
}

function createChallengePane(number) {
  const visual = VISUALS[number] ?? VISUALS[4];
  const pane = el("section", "ceremony-pane ceremony-challenge-pane");
  pane.dataset.node = "challenge";
  const label = el("div", "ceremony-kicker", c("FRESH CHALLENGE", "FRESH CHALLENGE"));
  const head = el("div", "ceremony-mini-head");
  head.append(el("strong", "", c("Unseen test input", "Daha önce görülmemiş test girdisi")), el("span", "ceremony-fresh", "FRESH"));
  const id = el("div", "ceremony-meta-line");
  const hash = el("div", "ceremony-meta-line");
  id.append(el("span", "", "Challenge ID"), el("code", "mono", "—"));
  hash.append(el("span", "", "SHA256"), el("code", "mono", "—"));
  const list = el("div", "ceremony-artifact-list");
  const artifacts = new Map();
  for (const [key, artifactLabel] of visual.inputs) {
    const tile = artifactTile(key, artifactLabel);
    list.appendChild(tile.tile);
    artifacts.set(key, tile);
  }
  pane.append(label, head, id, hash, list);
  return { pane, idValue: id.querySelector("code"), hashValue: hash.querySelector("code"), artifacts };
}

function createAgentPane(number, name) {
  const visual = VISUALS[number] ?? VISUALS[4];
  const pane = el("section", "ceremony-pane ceremony-agent-pane");
  pane.dataset.node = "execute";
  pane.appendChild(el("div", "ceremony-kicker", c("AGENT CORE", "AJAN CORE")));
  const did = el("div", "ceremony-agent-did mono", "DID · —");
  const visualWrap = el("div", "ceremony-agent-visual");
  const canvas = document.createElement("canvas");
  canvas.className = "ceremony-orb-canvas";
  canvas.width = 360;
  canvas.height = 300;
  const module = el("div", "ceremony-capability-module");
  module.append(el("span", "ceremony-module-glyph", "◇"), el("strong", "", `Capability ${number}`), el("small", "", name), el("em", "", c("ACTIVE", "AKTİF")));
  visualWrap.append(canvas, module);
  const checks = el("div", "ceremony-check-list");
  const checkRows = [];
  visual.checks.forEach(([en, tr]) => {
    const row = el("div", "ceremony-check-row");
    row.dataset.state = "pending";
    row.append(el("span", "ceremony-check-dot", "·"), el("span", "", c(en, tr)));
    checks.appendChild(row);
    checkRows.push(row);
  });
  pane.append(did, visualWrap, checks);
  return { pane, did, canvas, module, checkRows };
}

function createOutputPane() {
  const pane = el("section", "ceremony-pane ceremony-output-pane");
  pane.dataset.node = "result";
  pane.append(el("div", "ceremony-kicker", "OUTPUT"), el("strong", "ceremony-pane-title", c("Capability result", "Capability sonucu")));
  const code = el("pre", "ceremony-output-code mono", c("Waiting for capability execution…", "Capability çalışması bekleniyor…"));
  const hash = el("div", "ceremony-result-hash");
  hash.append(el("span", "", "Result hash"), el("code", "mono", "—"));
  pane.append(code, hash);
  return { pane, code, hashValue: hash.querySelector("code") };
}

function createSealPane() {
  const pane = el("section", "ceremony-pane ceremony-seal-pane");
  pane.dataset.node = "sign";
  pane.append(el("div", "ceremony-kicker", c("DID SEAL", "DID İMZASI")));
  const seal = el("div", "ceremony-seal-object");
  seal.innerHTML = '<span class="seal-top">◇</span><span class="seal-mid">DID</span><span class="seal-bottom">SIGN</span>';
  const did = el("code", "ceremony-seal-did mono", "—");
  const signature = el("code", "ceremony-seal-signature mono", c("signature pending", "imza bekleniyor"));
  pane.append(seal, did, signature);
  return { pane, seal, did, signature };
}

function createVerifierPane() {
  const pane = el("section", "ceremony-pane ceremony-verifier-pane");
  pane.dataset.node = "verify";
  pane.append(el("div", "ceremony-kicker", "FLOP VERIFIER"));
  const canvas = document.createElement("canvas");
  canvas.className = "ceremony-verifier-canvas";
  canvas.width = 260;
  canvas.height = 230;
  const verifier = el("code", "ceremony-verifier-id mono", "verifier · —");
  const compare = el("div", "ceremony-compare");
  const left = el("div", "ceremony-compare-side");
  left.append(el("span", "", c("Agent result", "Ajan sonucu")), el("code", "mono", "—"));
  const right = el("div", "ceremony-compare-side");
  right.append(el("span", "", c("FLOP result", "FLOP sonucu")), el("code", "mono", "—"));
  const match = el("div", "ceremony-match", c("WAITING", "BEKLİYOR"));
  compare.append(left, right, match);
  pane.append(canvas, verifier, compare);
  return { pane, canvas, verifier, agentResult: left.querySelector("code"), flopResult: right.querySelector("code"), match };
}

function createVerdictPane() {
  const pane = el("section", "ceremony-pane ceremony-verdict-pane");
  pane.dataset.node = "verdict";
  pane.append(el("div", "ceremony-kicker", c("DECISION", "KARAR")));
  const verdict = el("div", "ceremony-verdict-word", "—");
  const ring = el("div", "ceremony-verdict-ring", "✓");
  const reason = el("p", "ceremony-verdict-reason", c("No decision recorded yet.", "Henüz karar kaydedilmedi."));
  pane.append(verdict, ring, reason);
  return { pane, verdict, ring, reason };
}

function createCertificatePane(number, name) {
  const pane = el("section", "ceremony-pane ceremony-certificate-pane");
  pane.dataset.node = "certificate";
  pane.append(el("div", "ceremony-kicker", c("CERTIFICATE", "SERTİFİKA")));
  const card = el("article", "ceremony-certificate-card");
  const brand = el("div", "ceremony-certificate-brand");
  brand.append(el("span", "ceremony-certificate-mark", "◇"), el("strong", "", "FLOP"));
  const type = el("div", "ceremony-certificate-type", c("CAPABILITY CERTIFICATE", "CAPABILITY CERTIFICATE"));
  const cap = el("strong", "ceremony-certificate-capability", `Capability ${number}`);
  const capName = el("span", "ceremony-certificate-name", name);
  const did = el("div", "ceremony-certificate-field");
  did.append(el("span", "", "DID"), el("code", "mono", "—"));
  const cert = el("div", "ceremony-certificate-field");
  cert.append(el("span", "", "Certificate ID"), el("code", "mono", "—"));
  const receipt = el("div", "ceremony-certificate-field");
  receipt.append(el("span", "", "Receipt ID"), el("code", "mono", "—"));
  const seal = el("div", "ceremony-certificate-seal", "◇");
  card.append(brand, type, cap, capName, did, cert, receipt, seal);
  pane.appendChild(card);
  return { pane, card, did: did.querySelector("code"), cert: cert.querySelector("code"), receipt: receipt.querySelector("code") };
}

function proofItem(icon, title, desc) {
  const item = el("div", "ceremony-proof-item");
  item.dataset.state = "pending";
  const glyph = el("span", "ceremony-proof-glyph", icon);
  const body = el("div", "ceremony-proof-copy");
  const strong = el("strong", "", title);
  const span = el("span", "", desc);
  const code = el("code", "mono", "—");
  body.append(strong, span, code);
  item.append(glyph, body, el("span", "ceremony-proof-check", "✓"));
  return { item, code };
}

function createBottom() {
  const bottom = el("div", "ceremony-bottom");
  const proof = el("section", "ceremony-bottom-panel ceremony-proof-package");
  proof.append(el("div", "ceremony-kicker", c("PROOF PACKAGE · PORTABLE", "KANIT PAKETİ · TAŞINABİLİR")));
  const proofGrid = el("div", "ceremony-proof-grid");
  const certificate = proofItem("◇", c("Capability certificate", "Capability certificate"), c("Individual verified capability proof", "Capability'ye özel doğrulanmış kanıt"));
  const receipt = proofItem("▤", c("Signed receipt", "İmzalı receipt"), c("Immutable verification evidence", "Değiştirilemez doğrulama kanıtı"));
  const publicProof = proofItem("◎", c("Public proof", "Public proof"), c("Shareable proof URL", "Paylaşılabilir proof adresi"));
  const profile = proofItem("⬡", c("Capability profile", "Capability profili"), c("Public capability state", "Public capability durumu"));
  proofGrid.append(certificate.item, receipt.item, publicProof.item, profile.item);
  proof.appendChild(proofGrid);

  const boundary = el("section", "ceremony-bottom-panel ceremony-boundary");
  boundary.append(el("div", "ceremony-kicker", "EXECUTION BOUNDARY"));
  const split = el("div", "ceremony-boundary-split");
  const inside = el("div", "ceremony-boundary-side ceremony-boundary-private");
  inside.append(el("strong", "", c("STAYS INSIDE FLOP", "FLOP İÇİNDE KALIR")), el("div", "ceremony-boundary-core", "●  ◇"));
  const insideList = el("ul", "");
  [c("Agent core", "Ajan core"), c("Capability module", "Capability modülü"), c("Execution tools", "Çalıştırma araçları")].forEach((x) => insideList.appendChild(el("li", "", x)));
  inside.appendChild(insideList);
  const outside = el("div", "ceremony-boundary-side ceremony-boundary-public");
  outside.append(el("strong", "", c("PORTABLE OUTSIDE", "DIŞARI TAŞINABİLİR")), el("div", "ceremony-boundary-icons", "◇  ▤  ◎"));
  const outsideList = el("ul", "");
  ["DID", "Certificate", "Receipt", "Public proof"].forEach((x) => outsideList.appendChild(el("li", "", x)));
  outside.appendChild(outsideList);
  split.append(inside, outside);
  boundary.appendChild(split);
  bottom.append(proof, boundary);
  return { bottom, proof: { certificate, receipt, publicProof, profile } };
}

function drawOrb(canvas, time, intensity, accent) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 360;
  const cssH = canvas.clientHeight || 300;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const cx = cssW * .47;
  const cy = cssH * .50;
  const r = Math.min(cssW, cssH) * .26;

  const halo = ctx.createRadialGradient(cx, cy, r * .2, cx, cy, r * 1.65);
  halo.addColorStop(0, `rgba(${accent},${.18 + intensity * .16})`);
  halo.addColorStop(.45, `rgba(${accent},${.08 + intensity * .08})`);
  halo.addColorStop(1, `rgba(${accent},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.65, 0, Math.PI * 2); ctx.fill();

  const body = ctx.createRadialGradient(cx - r * .28, cy - r * .35, r * .08, cx, cy, r * 1.05);
  body.addColorStop(0, "#253a50");
  body.addColorStop(.34, "#101a27");
  body.addColorStop(.72, "#071019");
  body.addColorStop(1, "#020609");
  ctx.fillStyle = body;
  ctx.strokeStyle = `rgba(${accent},${.28 + intensity * .38})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  const speed = .00022 + intensity * .00032;
  for (let i = 0; i < 4; i++) {
    const rr = r * (.72 + i * .16);
    const a = time * speed * (i % 2 ? -1 : 1) + i * .9;
    ctx.strokeStyle = `rgba(${accent},${.17 + i * .045 + intensity * .13})`;
    ctx.lineWidth = i === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, a, a + Math.PI * (1.0 + i * .17));
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * .00012);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI * 2 / 12;
    const inner = r * .52;
    const outer = r * .78;
    ctx.strokeStyle = `rgba(${accent},${.10 + intensity * .12})`;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * .42);
  core.addColorStop(0, `rgba(${accent},${.9})`);
  core.addColorStop(.22, `rgba(${accent},${.46 + intensity * .25})`);
  core.addColorStop(1, `rgba(${accent},0)`);
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx, cy, r * .43, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = `rgba(${accent},${.72 + intensity * .25})`;
  ctx.lineWidth = 1.5;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4 + time * .00008);
  ctx.strokeRect(-r * .18, -r * .18, r * .36, r * .36);
  ctx.restore();
}

function cubicPoint(a, b, t) {
  const dx = Math.max(28, Math.abs(b.x - a.x) * .42);
  const p0 = a;
  const p1 = { x: a.x + dx, y: a.y };
  const p2 = { x: b.x - dx, y: b.y };
  const p3 = b;
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function drawField(canvas, shell, nodeMap, states, time, reduced) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = shell.getBoundingClientRect();
  const cssW = rect.width;
  const cssH = rect.height;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const bg = ctx.createRadialGradient(cssW * .46, cssH * .38, 20, cssW * .46, cssH * .38, cssW * .58);
  bg.addColorStop(0, "rgba(50,72,122,.10)");
  bg.addColorStop(.42, "rgba(16,35,60,.05)");
  bg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cssW, cssH);

  for (let i = 0; i < STEPS.length - 1; i++) {
    const aEl = nodeMap.get(STEPS[i]);
    const bEl = nodeMap.get(STEPS[i + 1]);
    if (!aEl || !bEl || aEl.hidden || bEl.hidden) continue;
    const ar = aEl.getBoundingClientRect();
    const br = bEl.getBoundingClientRect();
    const a = { x: ar.right - rect.left - 3, y: ar.top + ar.height * .48 - rect.top };
    const b = { x: br.left - rect.left + 3, y: br.top + br.height * .48 - rect.top };
    const stateA = states.get(STEPS[i]) ?? "pending";
    const stateB = states.get(STEPS[i + 1]) ?? "pending";
    const lit = stateA === "done" || stateA === "active" || stateB === "active" || stateB === "done";
    const active = stateB === "active";

    ctx.lineWidth = lit ? 1.35 : .75;
    ctx.strokeStyle = lit ? "rgba(94,151,255,.42)" : "rgba(86,99,120,.16)";
    ctx.beginPath();
    const dx = Math.max(28, Math.abs(b.x - a.x) * .42);
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(a.x + dx, a.y, b.x - dx, b.y, b.x, b.y);
    ctx.stroke();

    if (active && !reduced) {
      for (let p = 0; p < 3; p++) {
        const t = ((time * .00034) + p / 3) % 1;
        const pt = cubicPoint(a, b, t);
        const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 7);
        glow.addColorStop(0, "rgba(134,182,255,.95)");
        glow.addColorStop(1, "rgba(134,182,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

export function createVerificationCeremony(container, config) {
  const number = Number(config.number ?? 4);
  const name = config.name ?? `Capability ${number}`;
  const capabilityId = config.capabilityId ?? "";
  const states = new Map(STEPS.map((step) => [step, "pending"]));
  const summaries = new Map();
  let mode = config.mode ?? "live";
  let frame = 0;
  let disposed = false;
  let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shell = el("section", "ceremony-shell");
  shell.dataset.mode = mode;
  shell.dataset.phase = "pending";
  const field = document.createElement("canvas");
  field.className = "ceremony-field-canvas";
  field.setAttribute("aria-hidden", "true");

  const head = el("header", "ceremony-head");
  const headCopy = el("div", "ceremony-head-copy");
  const breadcrumb = el("div", "ceremony-breadcrumb", c("MY AGENT  /  CAPABILITIES  /  VERIFICATION", "AJANIM  /  CAPABILITY  /  DOĞRULAMA"));
  const title = el("h3", "ceremony-title", `Capability ${number} · ${name}`);
  const subtitle = el("p", "ceremony-subtitle", c("A fresh challenge proves what this installed capability can actually do.", "Fresh challenge, yüklü capability'nin gerçekten ne yapabildiğini kanıtlar."));
  headCopy.append(breadcrumb, title, subtitle);
  const badge = el("div", "ceremony-live-badge");
  badge.append(el("span", "ceremony-live-dot", ""), el("span", "", mode === "proof" ? c("VERIFIED", "DOĞRULANDI") : c("VERIFICATION LIVE", "CANLI DOĞRULAMA")));
  head.append(headCopy, badge);

  const progress = createProgress();
  const scene = el("div", "ceremony-scene");
  const challenge = createChallengePane(number);
  const agent = createAgentPane(number, name);
  const output = createOutputPane();
  const seal = createSealPane();
  const verifier = createVerifierPane();
  const verdict = createVerdictPane();
  const certificate = createCertificatePane(number, name);
  scene.append(challenge.pane, agent.pane, output.pane, seal.pane, verifier.pane, verdict.pane, certificate.pane);
  const bottom = createBottom();
  shell.append(field, head, progress.wrap, scene, bottom.bottom);
  container.replaceChildren(shell);
  container.hidden = false;

  const nodeMap = new Map([
    ["challenge", challenge.pane], ["execute", agent.pane], ["result", output.pane], ["sign", seal.pane], ["verify", verifier.pane], ["verdict", verdict.pane], ["certificate", certificate.pane],
  ]);

  function stateIntensity(id) {
    const state = states.get(id);
    return state === "active" ? 1 : state === "done" ? .72 : state === "fail" ? .85 : .18;
  }

  function animate(time) {
    if (disposed) return;
    drawField(field, shell, nodeMap, states, time, reduced);
    drawOrb(agent.canvas, time, stateIntensity("execute"), "119,102,255");
    drawOrb(verifier.canvas, time * .87, stateIntensity("verify"), "66,156,255");
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);

  function setProgress(step, state) {
    const item = progress.items.get(step);
    if (!item) return;
    item.item.dataset.state = state;
    item.state.textContent = state === "active" ? c("working", "çalışıyor") : state === "done" ? c("done", "tamam") : state === "fail" ? "FAIL" : state === "unknown" ? "UNKNOWN" : c("waiting", "bekliyor");
    if (state === "done") item.marker.textContent = "✓";
    else if (state === "fail") item.marker.textContent = "×";
    else if (state === "unknown") item.marker.textContent = "?";
    else item.marker.textContent = STEPS.indexOf(step) + 1;
  }

  function syncPaneState(step, state) {
    const pane = nodeMap.get(step);
    if (pane) pane.dataset.state = state;
    if (step === "execute") {
      agent.module.dataset.state = state;
      agent.checkRows.forEach((row, index) => {
        const done = state === "done" || (state === "active" && index < 2);
        row.dataset.state = done ? "done" : state === "fail" ? "fail" : "pending";
        row.querySelector(".ceremony-check-dot").textContent = done ? "✓" : state === "fail" ? "×" : "·";
      });
    }
    if (step === "verdict") {
      if (state === "done") {
        verdict.verdict.textContent = "PASS";
        verdict.pane.dataset.verdict = "pass";
        verdict.reason.textContent = c("Agent result matched FLOP's independent result.", "Ajan sonucu FLOP'un bağımsız sonucuyla eşleşti.");
        verifier.match.textContent = "MATCH ✓";
        verifier.match.dataset.state = "match";
      } else if (state === "fail") {
        verdict.verdict.textContent = "FAIL";
        verdict.pane.dataset.verdict = "fail";
        verdict.reason.textContent = c("Results did not match. No certificate was issued.", "Sonuçlar eşleşmedi. Certificate oluşturulmadı.");
        verifier.match.textContent = "MISMATCH ×";
        verifier.match.dataset.state = "fail";
      } else if (state === "unknown") {
        verdict.verdict.textContent = "UNKNOWN";
        verdict.pane.dataset.verdict = "unknown";
        verdict.reason.textContent = c("FLOP could not record a decision.", "FLOP karar kaydedemedi.");
      }
    }
    if (step === "certificate" && state === "done") certificate.card.dataset.state = "issued";
  }

  function setState(step, state, summary) {
    states.set(step, state);
    setProgress(step, state);
    syncPaneState(step, state);
    if (summary) summaries.set(step, summary);
    const index = STEPS.indexOf(step);
    shell.dataset.phase = step;
    shell.style.setProperty("--ceremony-phase", String(index));
  }

  function reset() {
    mode = "live";
    shell.dataset.mode = "live";
    badge.lastElementChild.textContent = c("VERIFICATION LIVE", "CANLI DOĞRULAMA");
    states.clear();
    STEPS.forEach((step) => states.set(step, "pending"));
    summaries.clear();
    progress.items.forEach((_, step) => setProgress(step, "pending"));
    nodeMap.forEach((pane) => { pane.dataset.state = "pending"; delete pane.dataset.verdict; });
    agent.checkRows.forEach((row) => { row.dataset.state = "pending"; row.querySelector(".ceremony-check-dot").textContent = "·"; });
    challenge.idValue.textContent = "—";
    challenge.hashValue.textContent = "—";
    challenge.artifacts.forEach((artifact) => artifact.value.textContent = c("waiting for fresh input", "fresh input bekleniyor"));
    output.code.textContent = c("Waiting for capability execution…", "Capability çalışması bekleniyor…");
    output.hashValue.textContent = "—";
    seal.did.textContent = "—";
    seal.signature.textContent = c("signature pending", "imza bekleniyor");
    verifier.verifier.textContent = "verifier · —";
    verifier.agentResult.textContent = "—";
    verifier.flopResult.textContent = "—";
    verifier.match.textContent = c("WAITING", "BEKLİYOR");
    delete verifier.match.dataset.state;
    verdict.verdict.textContent = "—";
    verdict.reason.textContent = c("No decision recorded yet.", "Henüz karar kaydedilmedi.");
    certificate.did.textContent = "—";
    certificate.cert.textContent = "—";
    certificate.receipt.textContent = "—";
    delete certificate.card.dataset.state;
    Object.values(bottom.proof).forEach((item) => { item.item.dataset.state = "pending"; item.code.textContent = "—"; });
  }

  function setChallenge(caseData, meta = {}) {
    challenge.idValue.textContent = short(meta.challengeId ?? meta.challenge_id ?? "—", 30);
    challenge.idValue.title = meta.challengeId ?? meta.challenge_id ?? "";
    challenge.hashValue.textContent = short(meta.challengeHash ?? meta.challenge_hash ?? "—", 31);
    challenge.hashValue.title = meta.challengeHash ?? meta.challenge_hash ?? "";
    challenge.artifacts.forEach((artifact, key) => {
      const value = inputValue(caseData, key);
      artifact.value.textContent = value ? short(typeof value === "object" ? pretty(value, 140).replace(/\s+/g, " ") : value, 38) : c("present in challenge", "challenge içinde mevcut");
      artifact.value.title = typeof value === "object" ? pretty(value, 800) : String(value ?? "");
      artifact.tile.dataset.state = "ready";
    });
  }

  function setResult(result) {
    output.code.textContent = pretty(result, 560);
    const resultText = pretty(result, 4000);
    verifier.agentResult.textContent = short(resultText.replace(/\s+/g, " "), 22);
  }

  function setResultHash(value) {
    output.hashValue.textContent = short(value, 31);
    output.hashValue.title = String(value ?? "");
    verifier.agentResult.textContent = short(value, 22);
  }

  function setIdentity(did) {
    agent.did.textContent = `DID · ${short(did, 44)}`;
    agent.did.title = did;
    seal.did.textContent = short(did, 24);
    seal.did.title = did;
    certificate.did.textContent = short(did, 27);
    certificate.did.title = did;
  }

  function setSignature(signature) {
    seal.signature.textContent = short(signature, 24);
    seal.signature.title = signature;
  }

  function setVerifier(id, version) {
    const value = version ? `${id} @ ${version}` : id;
    verifier.verifier.textContent = short(value, 35);
    verifier.verifier.title = value;
  }

  function setDecision(decision = {}) {
    if (decision.receipt_id) {
      certificate.receipt.textContent = short(decision.receipt_id, 27);
      certificate.receipt.title = decision.receipt_id;
      bottom.proof.receipt.item.dataset.state = "ready";
      bottom.proof.receipt.code.textContent = short(decision.receipt_id, 28);
    }
    if (decision.certificate_id) {
      certificate.cert.textContent = short(decision.certificate_id, 27);
      certificate.cert.title = decision.certificate_id;
      bottom.proof.certificate.item.dataset.state = "ready";
      bottom.proof.certificate.code.textContent = short(decision.certificate_id, 28);
      bottom.proof.publicProof.item.dataset.state = "ready";
      bottom.proof.publicProof.code.textContent = `/certificate/${short(decision.certificate_id, 19)}`;
      bottom.proof.profile.item.dataset.state = "ready";
      bottom.proof.profile.code.textContent = c("profile updated", "profil güncellendi");
    }
    if (decision.result_hash) setResultHash(decision.result_hash);
    if (decision.verifier_id) setVerifier(decision.verifier_id, decision.verifier_version);
    if (decision.verdict === "PASS") {
      verifier.flopResult.textContent = output.hashValue.textContent !== "—" ? output.hashValue.textContent : c("expected result", "beklenen sonuç");
    }
  }

  function setReceiptProof(receipt = {}) {
    if (receipt.result_hash) setResultHash(receipt.result_hash);
    if (receipt.verifier_id) setVerifier(receipt.verifier_id, receipt.verifier_version);
    if (receipt.receipt_id) setDecision({ receipt_id: receipt.receipt_id });
    if (receipt.verdict === "PASS") verifier.flopResult.textContent = short(receipt.result_hash ?? "expected result", 22);
  }

  function completeProof(proof = {}) {
    mode = "proof";
    shell.dataset.mode = "proof";
    badge.lastElementChild.textContent = c("VERIFIED", "DOĞRULANDI");
    STEPS.forEach((step) => setState(step, "done"));
    if (proof.challengeHash) {
      challenge.hashValue.textContent = short(proof.challengeHash, 31);
      challenge.hashValue.title = proof.challengeHash;
    }
    if (proof.trial) {
      const artifact = challenge.artifacts.values().next().value;
      if (artifact) artifact.value.textContent = short(proof.trial, 38);
    }
    if (proof.did) setIdentity(proof.did);
    if (proof.receipt) setReceiptProof(proof.receipt);
    if (proof.certificate) {
      setDecision({ certificate_id: proof.certificate.certificate_id, receipt_id: proof.certificate.receipt_id });
    }
    if (proof.attestation) seal.signature.textContent = proof.attestation;
  }

  function localize() {
    breadcrumb.textContent = c("MY AGENT  /  CAPABILITIES  /  VERIFICATION", "AJANIM  /  CAPABILITY  /  DOĞRULAMA");
    subtitle.textContent = c("A fresh challenge proves what this installed capability can actually do.", "Fresh challenge, yüklü capability'nin gerçekten ne yapabildiğini kanıtlar.");
    badge.lastElementChild.textContent = mode === "proof" ? c("VERIFIED", "DOĞRULANDI") : c("VERIFICATION LIVE", "CANLI DOĞRULAMA");
    progress.items.forEach((item, step) => {
      item.title.textContent = c(STEP_COPY[step][0], STEP_COPY[step][1]);
      setProgress(step, states.get(step) ?? "pending");
    });
  }

  return {
    reset,
    begin(step) { setState(step, "active"); },
    complete(step, summary) { setState(step, "done", summary); },
    fail(step, summary) { setState(step, "fail", summary); },
    unknown(step, summary) { setState(step, "unknown", summary); },
    setChallenge,
    setResult,
    setResultHash,
    setIdentity,
    setSignature,
    setVerifier,
    setDecision,
    setReceiptProof,
    completeProof,
    localize,
    showCertificate() { certificate.pane.hidden = false; },
    destroy() { disposed = true; cancelAnimationFrame(frame); },
    get capabilityId() { return capabilityId; },
  };
}
