void import("/capability-names.js?v=capability-names-v4");
void import("/practice-ui.js?v=practice-ui-v1");

function attachProtocolHint() {
  const card = document.querySelector(".product-shell .agent-status-card");
  if (!card || card.querySelector(".agent-protocol-hint")) return Boolean(card);
  const hint = document.createElement("div");
  hint.className = "agent-protocol-hint";
  hint.setAttribute("aria-label", "Network protocols");
  hint.innerHTML = '<span>TCLK 1</span><span>PAPER</span><span class="alpha">ALPHA</span>';
  card.appendChild(hint);
  return true;
}

if (!attachProtocolHint()) {
  const observer = new MutationObserver(() => {
    if (!attachProtocolHint()) return;
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
