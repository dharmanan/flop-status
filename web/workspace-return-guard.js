export function restoreProductSecondaryView(shell, target) {
  if (!shell || !target || typeof target.closest !== "function") return false;
  const item = target.closest(".product-nav-item");
  if (!item || item.dataset?.view === "capabilities") return false;

  const secondary = shell.querySelector?.(".workspace-secondary-view");
  if (!secondary) return false;

  secondary.classList?.remove?.("shell-view-hidden");
  secondary.hidden = false;
  return true;
}

function bind() {
  document.documentElement.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest(".product-nav-item");
    if (!target || !item || item.dataset?.view === "capabilities") return;
    const shell = target.closest(".product-shell");
    if (!shell) return;

    queueMicrotask(() => {
      restoreProductSecondaryView(shell, target);
    });
  });
}

if (typeof document !== "undefined") bind();
