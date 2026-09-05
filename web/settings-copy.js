export function settingsCustodyCopy(language = "en") {
  return language === "tr"
    ? "Aktif imzalama anahtarı IndexedDB içinde dışarı aktarılamaz. Taşınabilir kimlik yedeğinin sahibi sensin, Flop Proof değil."
    : "The active signing key is nonextractable in IndexedDB. The portable identity backup belongs to you, not Flop Proof.";
}

export function syncSettingsCustodyCopy() {
  if (typeof document === "undefined") return false;
  const language = document.documentElement.lang === "tr" ? "tr" : "en";
  const text = settingsCustodyCopy(language);
  const source = document.getElementById("custody");
  if (source) source.textContent = text;

  let changed = Boolean(source);
  document.querySelectorAll(".shell-settings-card p").forEach((node) => {
    const current = node.textContent ?? "";
    if (
      current.includes("IndexedDB") &&
      (current.includes("signing key") || current.includes("imzalama anahtarı"))
    ) {
      node.textContent = text;
      changed = true;
    }
  });
  return changed;
}

if (typeof document !== "undefined") {
  syncSettingsCustodyCopy();
  document.documentElement.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(".product-nav-item[data-view=\"settings\"], .lang-button")) return;
    queueMicrotask(syncSettingsCustodyCopy);
  });
}
