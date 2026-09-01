import { getLanguage } from "/i18n.js";

/**
 * Certified capabilities stay compact on the main lab page.
 *
 * A completed certificate is historical proof, not a live verification run.
 * The animated verification ceremony is therefore created only by agent.js
 * after the user explicitly starts a new certification test.
 *
 * Existing certificate links, receipt evidence and public proof remain owned
 * by the normal product state rendered in agent.js.
 */
function keepCertifiedProofCompact() {
  const active = document.getElementById("active-actions");
  if (!active) return;

  for (const number of [1, 2, 3, 4]) {
    const liveFlow = document.getElementById(`capability-${number}-flow`);
    if (liveFlow && !liveFlow.dataset.verificationRunning) liveFlow.hidden = true;
  }
}

keepCertifiedProofCompact();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) keepCertifiedProofCompact();
});

void getLanguage;
