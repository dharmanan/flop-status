void import("/capability-names.js?v=capability-names-v4");
void import("/agent-identicon.js?v=agent-identicon-v1");
void import("/workspace-return-guard.js?v=workspace-return-v1");
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

function syncDealProtocolMetadata() {
  const head = document.querySelector(".tclk-workspace .tclk-head");
  const badges = head?.querySelector(".tclk-protocol-badges");
  const kicker = head?.querySelector(".tclk-kicker");
  if (!head || !badges || !kicker) return false;

  kicker.textContent = "FLOP LABS PROTOCOL";
  badges.replaceChildren();
  const protocol = document.createElement("span");
  protocol.textContent = "TCLK 1";
  const rail = document.createElement("span");
  rail.textContent = "PAPERRAIL";
  const alpha = document.createElement("span");
  alpha.className = "alpha";
  alpha.textContent = "ALPHA";
  const lock = document.createElement("span");
  lock.className = "tclk-lock-badge";
  lock.textContent = "HASH LOCK";
  badges.append(protocol, rail, alpha, lock);
  return true;
}

if (!syncDealProtocolMetadata()) {
  const observer = new MutationObserver(() => {
    if (!syncDealProtocolMetadata()) return;
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
