void import("/capability-names.js?v=capability-names-v4");
void import("/c1-practice-positive.js?v=c1-practice-v1").then(() => import("/practice-ui.js?v=practice-ui-v3"));

function loadPracticeFeedbackStyle() {
  if (document.getElementById("flop-capability-use-feedback-style")) return;
  const link = document.createElement("link");
  link.id = "flop-capability-use-feedback-style";
  link.rel = "stylesheet";
  link.href = "/capability-use-feedback.css?v=practice-feedback-v1";
  document.head.appendChild(link);
}

loadPracticeFeedbackStyle();

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
