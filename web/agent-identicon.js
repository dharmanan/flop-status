const PALETTES = [
  { background: "#101923", accent: "#8fb3ff", soft: "#d9e5ff" },
  { background: "#101b17", accent: "#79c9a1", soft: "#d8f1e4" },
  { background: "#181421", accent: "#b6a0e8", soft: "#e5dcf7" },
  { background: "#1b1610", accent: "#d5a66f", soft: "#f0dcc2" },
  { background: "#101a1c", accent: "#82c4ca", soft: "#d5eef0" },
  { background: "#1a1216", accent: "#d58fa2", soft: "#f0d4dc" },
];

function hashString(value, seed = 2166136261) {
  let hash = seed >>> 0;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function createAgentIdenticonModel(did) {
  const identity = String(did ?? "").trim();
  const primary = hashString(identity || "flop-agent");
  const secondary = hashString(`${identity}|shape`, 2246822519);
  return {
    paletteIndex: primary % PALETTES.length,
    spokes: 5 + (secondary % 4),
    rotation: (primary >>> 5) % 360,
    orbitRadius: 18 + ((secondary >>> 7) % 5),
    nodeRadius: 2 + ((primary >>> 11) % 2),
    innerRadius: 7 + ((secondary >>> 13) % 4),
    dash: 3 + ((primary >>> 17) % 5),
  };
}

function svgNode(tag, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

export function renderAgentIdenticon(target, did) {
  if (!(target instanceof Element)) return false;
  const identity = String(did ?? "").trim();
  if (!identity.startsWith("did:key:")) return false;

  const model = createAgentIdenticonModel(identity);
  const palette = PALETTES[model.paletteIndex];
  const svg = svgNode("svg", {
    viewBox: "0 0 64 64",
    width: "64",
    height: "64",
    role: "img",
    "aria-label": "Agent DID identicon",
  });

  svg.appendChild(svgNode("circle", {
    cx: 32,
    cy: 32,
    r: 30,
    fill: palette.background,
    stroke: palette.accent,
    "stroke-opacity": "0.34",
    "stroke-width": "1.2",
  }));

  svg.appendChild(svgNode("circle", {
    cx: 32,
    cy: 32,
    r: model.orbitRadius,
    fill: "none",
    stroke: palette.accent,
    "stroke-opacity": "0.5",
    "stroke-width": "1",
    "stroke-dasharray": `${model.dash} ${model.dash + 3}`,
    transform: `rotate(${model.rotation} 32 32)`,
  }));

  for (let index = 0; index < model.spokes; index += 1) {
    const angle = ((360 / model.spokes) * index + model.rotation) * (Math.PI / 180);
    const innerX = 32 + Math.cos(angle) * model.innerRadius;
    const innerY = 32 + Math.sin(angle) * model.innerRadius;
    const outerX = 32 + Math.cos(angle) * model.orbitRadius;
    const outerY = 32 + Math.sin(angle) * model.orbitRadius;
    svg.appendChild(svgNode("line", {
      x1: innerX.toFixed(2),
      y1: innerY.toFixed(2),
      x2: outerX.toFixed(2),
      y2: outerY.toFixed(2),
      stroke: palette.accent,
      "stroke-opacity": index % 2 === 0 ? "0.86" : "0.48",
      "stroke-width": index % 2 === 0 ? "1.4" : "1",
    }));
    svg.appendChild(svgNode("circle", {
      cx: outerX.toFixed(2),
      cy: outerY.toFixed(2),
      r: index % 3 === 0 ? model.nodeRadius + 0.8 : model.nodeRadius,
      fill: index % 2 === 0 ? palette.soft : palette.accent,
      "fill-opacity": index % 2 === 0 ? "0.95" : "0.72",
    }));
  }

  const diamondSize = 5 + (model.paletteIndex % 3);
  svg.appendChild(svgNode("path", {
    d: `M32 ${32 - diamondSize} L${32 + diamondSize} 32 L32 ${32 + diamondSize} L${32 - diamondSize} 32 Z`,
    fill: palette.soft,
    "fill-opacity": "0.95",
    stroke: palette.accent,
    "stroke-width": "1",
  }));
  svg.appendChild(svgNode("circle", { cx: 32, cy: 32, r: 1.6, fill: palette.background }));

  target.replaceChildren(svg);
  target.classList.add("identicon-ready");
  target.setAttribute("title", identity);
  return true;
}

function loadStyle() {
  if (document.getElementById("flop-agent-identicon-style")) return;
  const link = document.createElement("link");
  link.id = "flop-agent-identicon-style";
  link.rel = "stylesheet";
  link.href = "/agent-identicon.css?v=agent-identicon-v1";
  document.head.appendChild(link);
}

export function syncAgentIdenticon() {
  if (typeof document === "undefined") return false;
  const didNode = document.querySelector(".product-shell .shell-did");
  const did = didNode?.getAttribute("title")?.trim() || didNode?.textContent?.trim();
  const avatar = document.querySelector(".product-shell .agent-avatar");
  if (!avatar || !did) return false;
  return renderAgentIdenticon(avatar, did);
}

function bind() {
  loadStyle();

  let observedDidNode = null;
  let didObserver = null;

  const connect = () => {
    const didNode = document.querySelector(".product-shell .shell-did");
    if (!didNode) return false;

    if (didNode !== observedDidNode) {
      didObserver?.disconnect();
      observedDidNode = didNode;
      didObserver = new MutationObserver(syncAgentIdenticon);
      didObserver.observe(didNode, {
        attributes: true,
        attributeFilter: ["title"],
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    syncAgentIdenticon();
    return true;
  };

  connect();

  const shellObserver = new MutationObserver(connect);
  shellObserver.observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== "undefined") bind();
