import { bytesToBase64Url, parseEd25519DidKey } from "/identity-crypto.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const DB_NAME = "flop-agent-key-v1";
const STORE_NAME = "identity";
const ACTIVE_ID = "active";
const DRAFT_KEY = "flop-agent-profile-draft";
const encoder = new TextEncoder();
const cache = new Map();
let claiming = false;
let tickQueued = false;

const tr = () => document.documentElement.lang === "tr";
const copy = (en, trText) => tr() ? trText : en;

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  throw new Error("unsupported canonical JSON value");
}

function request(value) {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) open.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function identity() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    return await request(tx.objectStore(STORE_NAME).get(ACTIVE_ID));
  } finally {
    db.close();
  }
}

async function signedProfile(displayName, handle) {
  const id = await identity();
  if (!id?.did || !id?.privateKey) throw new Error(copy("A browser-owned FLOP identity is required.", "Tarayıcıya ait FLOP kimliği gerekli."));
  parseEd25519DidKey(id.did);
  const payload = {
    version: "1",
    action: "UPSERT_AGENT_PROFILE",
    actor_did: id.did,
    nonce: crypto.randomUUID(),
    issued_at: new Date().toISOString(),
    display_name: displayName,
    handle,
  };
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "Ed25519" },
    id.privateKey,
    encoder.encode(canonicalize(payload)),
  ));
  return {
    payload,
    signature: { algorithm: "Ed25519", encoding: "base64url", value: bytesToBase64Url(signature) },
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body?.error?.code ?? `HTTP_${response.status}`);
  return body;
}

function normalized(raw) {
  return raw ? {
    did: raw.did,
    displayName: raw.displayName ?? raw.display_name,
    handle: raw.handle,
  } : null;
}

async function profileForDid(did) {
  if (!did) return null;
  if (cache.has(did)) return cache.get(did);
  try {
    const body = await api(`/api/v1/agent-profiles/${encodeURIComponent(did)}`);
    const profile = normalized(body.profile);
    if (profile) cache.set(did, profile);
    return profile;
  } catch {
    return null;
  }
}

async function searchProfiles(query) {
  const body = await api(`/api/v1/agent-profiles/search?q=${encodeURIComponent(query)}`);
  return (body.profiles ?? []).map(normalized);
}

function statusHost() {
  return document.querySelector(".agent-status-card")
    ?? document.getElementById("identity-summary")
    ?? document.getElementById("create-path");
}

function setProfileStatus(text = "", state = "idle") {
  const host = statusHost();
  if (!host) return;
  let el = host.querySelector(".agent-profile-inline-status");
  if (!el) {
    el = document.createElement("p");
    el.className = "agent-profile-inline-status";
    host.appendChild(el);
  }
  if (el.textContent !== text) el.textContent = text;
  el.dataset.state = state;
  el.hidden = !text;
}

async function saveProfile(displayName, handle) {
  const name = displayName.trim();
  const normalizedHandle = handle.trim().toLowerCase().replace(/^@/, "");
  if (!name || name.length > 64) throw new Error(copy("Enter an agent name.", "Ajan adı gir."));
  if (!/^[a-z0-9_]{3,30}$/.test(normalizedHandle)) {
    throw new Error(copy(
      "Handle must be 3–30 lowercase letters, numbers or underscores.",
      "Handle 3–30 karakter olmalı; küçük harf, rakam veya alt çizgi kullan.",
    ));
  }
  const envelope = await signedProfile(name, normalizedHandle);
  const body = await api("/api/v1/agent-profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope),
  });
  const profile = normalized(body.profile);
  if (!profile?.did) throw new Error("AGENT_PROFILE_RESPONSE_INVALID");
  cache.set(profile.did, profile);
  sessionStorage.removeItem(DRAFT_KEY);
  document.dispatchEvent(new CustomEvent("flop:profile-updated", { detail: profile }));
  return profile;
}

function injectCreateFields() {
  const path = document.getElementById("create-path");
  const button = document.getElementById("create-identity");
  if (!path || !button || path.querySelector(".agent-profile-create")) return;

  const box = document.createElement("div");
  box.className = "agent-profile-create";
  box.innerHTML = `
    <label>${copy("Agent name", "Ajan adı")}</label>
    <input id="new-agent-name" maxlength="64" placeholder="${copy("e.g. Atlas", "örn. Atlas")}" autocomplete="off">
    <label>${copy("Unique handle", "Benzersiz handle")}</label>
    <div class="profile-handle-field"><span>@</span><input id="new-agent-handle" maxlength="30" placeholder="atlas7k2" autocomplete="off" spellcheck="false"></div>
    <p class="profile-help">${copy(
      "The name is human-readable. The unique handle prevents confusion; the DID remains the cryptographic identity.",
      "İsim insan tarafından okunur kimliktir. Benzersiz handle karışıklığı önler; kriptografik kimlik DID olarak kalır.",
    )}</p>`;
  path.insertBefore(box, button);

  button.addEventListener("click", (event) => {
    const name = box.querySelector("#new-agent-name").value.trim();
    const handle = box.querySelector("#new-agent-handle").value.trim().toLowerCase().replace(/^@/, "");
    if (!name || !/^[a-z0-9_]{3,30}$/.test(handle)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      box.classList.add("profile-error");
      box.querySelector(".profile-help").textContent = copy(
        "Enter a name and a unique handle using 3–30 lowercase letters, numbers or underscores.",
        "Bir ad ve 3–30 küçük harf, rakam veya alt çizgiden oluşan handle gir.",
      );
      return;
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ displayName: name, handle }));
    setProfileStatus("");
  }, { capture: true });
}

async function claimDraftWhenReady() {
  if (claiming) return "busy";
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return "none";

  const active = document.getElementById("active-actions");
  const seed = document.getElementById("seed-gate");
  if (!active || active.hidden || (seed && !seed.hidden)) return "not-ready";

  const id = await identity();
  if (!id?.did || !id?.privateKey) return "not-ready";

  claiming = true;
  try {
    const draft = JSON.parse(raw);
    setProfileStatus(copy("Binding agent name to DID…", "Ajan adı DID'e bağlanıyor…"), "working");
    const profile = await saveProfile(draft.displayName, draft.handle);
    setProfileStatus(`${profile.displayName} · @${profile.handle}`, "success");
    await syncSidebarNames();
    return "success";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("agent profile claim failed", error);
    setProfileStatus(copy(`Agent profile could not be saved: ${message}`, `Ajan profili kaydedilemedi: ${message}`), "error");
    return "failed";
  } finally {
    claiming = false;
  }
}

function retryDraftClaim(attempt = 0) {
  if (attempt > 20 || !sessionStorage.getItem(DRAFT_KEY)) return;
  void claimDraftWhenReady().then((result) => {
    if (result === "not-ready" || result === "busy") {
      setTimeout(() => retryDraftClaim(attempt + 1), 250);
    }
  });
}

async function syncSidebarNames() {
  const did = document.getElementById("did")?.textContent?.trim();
  if (!did) return;
  const profile = await profileForDid(did);
  if (!profile) return;

  document.querySelectorAll(".agent-identity-copy").forEach((copyNode) => {
    const name = copyNode.querySelector("strong");
    if (name && name.textContent !== profile.displayName) name.textContent = profile.displayName;

    let handle = copyNode.querySelector(".agent-handle");
    if (!handle) {
      handle = document.createElement("span");
      handle.className = "agent-handle";
      name?.insertAdjacentElement("afterend", handle);
    }
    const handleText = `@${profile.handle}`;
    if (handle.textContent !== handleText) handle.textContent = handleText;
  });
}

function injectSettingsEditor() {
  const screen = [...document.querySelectorAll(".shell-screen")]
    .find((el) => el.querySelector(".shell-screen-title")?.textContent?.match(/Settings|Ayarlar/));
  if (!screen || screen.querySelector(".agent-profile-settings")) return;

  const card = document.createElement("section");
  card.className = "shell-settings-card agent-profile-settings";
  card.innerHTML = `
    <span class="shell-settings-label">${copy("Agent profile", "Ajan profili")}</span>
    <label>${copy("Name", "Ad")}</label>
    <input class="profile-settings-name" maxlength="64">
    <label>${copy("Handle", "Handle")}</label>
    <div class="profile-handle-field"><span>@</span><input class="profile-settings-handle" maxlength="30" spellcheck="false"></div>
    <button class="shell-action-button profile-settings-save" type="button">${copy("Sign & save profile", "Profili imzala ve kaydet")}</button>
    <p class="profile-settings-status"></p>`;
  screen.insertBefore(card, screen.lastElementChild ?? null);

  const did = document.getElementById("did")?.textContent?.trim();
  if (did) {
    void profileForDid(did).then((profile) => {
      if (!profile) return;
      card.querySelector(".profile-settings-name").value = profile.displayName;
      card.querySelector(".profile-settings-handle").value = profile.handle;
    });
  }

  card.querySelector(".profile-settings-save").addEventListener("click", async () => {
    const status = card.querySelector(".profile-settings-status");
    try {
      status.textContent = copy("Signing profile claim…", "Profil claim'i imzalanıyor…");
      const profile = await saveProfile(
        card.querySelector(".profile-settings-name").value,
        card.querySelector(".profile-settings-handle").value,
      );
      status.textContent = copy(
        `Saved as ${profile.displayName} @${profile.handle}`,
        `${profile.displayName} @${profile.handle} olarak kaydedildi`,
      );
      setProfileStatus(`${profile.displayName} · @${profile.handle}`, "success");
      await syncSidebarNames();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  });
}

async function decorateDids(root = document) {
  const nodes = [...root.querySelectorAll("code.mono, .network-member code, .mailbox-message-top code")];
  for (const el of nodes) {
    const full = `${el.title || ""}\n${el.textContent || ""}`;
    const match = full.match(/did:key:z[1-9A-HJ-NP-Za-km-z]+/);
    if (!match || el.dataset.profileDecorated === match[0]) continue;
    const profile = await profileForDid(match[0]);
    if (!profile) continue;
    el.dataset.profileDecorated = match[0];
    el.title = `${profile.displayName} @${profile.handle}\n${match[0]}`;
    if (el.closest(".network-member")) {
      el.textContent = `${profile.displayName} · @${profile.handle}`;
    } else if (el.closest(".mailbox-message-top")) {
      const prefix = el.textContent.startsWith("From") ? "From · " : el.textContent.startsWith("To") ? "To · " : "";
      el.textContent = `${prefix}${profile.displayName} · @${profile.handle}`;
    }
  }
}

function enhanceMailboxCompose() {
  const form = document.querySelector(".mailbox-compose");
  if (!form || form.querySelector(".profile-directory-search")) return;
  const recipient = form.querySelector(".mailbox-recipient");
  if (!recipient) return;

  recipient.hidden = true;
  const wrap = document.createElement("div");
  wrap.className = "profile-directory-search";
  wrap.innerHTML = `
    <input class="profile-search-input" placeholder="${copy("Search agent name or @handle…", "Ajan adı veya @handle ara…")}" autocomplete="off">
    <div class="profile-search-results"></div>
    <div class="profile-selected-recipient"></div>`;
  recipient.parentElement.insertBefore(wrap, recipient.nextSibling);

  const input = wrap.querySelector(".profile-search-input");
  const results = wrap.querySelector(".profile-search-results");
  const selected = wrap.querySelector(".profile-selected-recipient");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const query = input.value.trim().replace(/^@/, "");
      results.replaceChildren();
      if (!query) return;
      try {
        for (const profile of await searchProfiles(query)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "profile-search-result";
          button.innerHTML = `<strong>${profile.displayName}</strong><span>@${profile.handle}</span><code>${profile.did}</code>`;
          button.addEventListener("click", () => {
            recipient.value = profile.did;
            selected.textContent = `${profile.displayName} · @${profile.handle}`;
            results.replaceChildren();
            input.value = "";
          });
          results.appendChild(button);
        }
      } catch {}
    }, 180);
  });
}

function enhanceRoomInvite() {
  const form = document.querySelector(".network-create-form");
  if (!form || form.querySelector(".profile-room-search")) return;
  const dids = form.querySelector(".network-member-dids");
  if (!dids) return;

  const wrap = document.createElement("div");
  wrap.className = "profile-room-search profile-directory-search";
  wrap.innerHTML = `
    <input class="profile-search-input" placeholder="${copy("Find agent by name or @handle…", "Ajanı ad veya @handle ile bul…")}" autocomplete="off">
    <div class="profile-search-results"></div>`;
  dids.parentElement.insertBefore(wrap, dids);

  const input = wrap.querySelector(".profile-search-input");
  const results = wrap.querySelector(".profile-search-results");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const query = input.value.trim().replace(/^@/, "");
      results.replaceChildren();
      if (!query) return;
      try {
        for (const profile of await searchProfiles(query)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "profile-search-result";
          button.innerHTML = `<strong>${profile.displayName}</strong><span>@${profile.handle}</span><code>${profile.did}</code>`;
          button.addEventListener("click", () => {
            const existing = new Set(dids.value.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean));
            existing.add(profile.did);
            dids.value = [...existing].join("\n");
            results.replaceChildren();
            input.value = "";
          });
          results.appendChild(button);
        }
      } catch {}
    }, 180);
  });
}

function loadStyle() {
  if (document.getElementById("flop-agent-profile-style")) return;
  const link = document.createElement("link");
  link.id = "flop-agent-profile-style";
  link.rel = "stylesheet";
  link.href = "/agent-profile.css?v=profile-v2";
  document.head.appendChild(link);
}

function tick() {
  injectCreateFields();
  injectSettingsEditor();
  enhanceMailboxCompose();
  enhanceRoomInvite();
  void syncSidebarNames();
  void decorateDids();
  void claimDraftWhenReady();
}

function scheduleTick() {
  if (tickQueued) return;
  tickQueued = true;
  queueMicrotask(() => {
    tickQueued = false;
    tick();
  });
}

loadStyle();

const bodyObserver = new MutationObserver(() => scheduleTick());
bodyObserver.observe(document.body, { childList: true, subtree: true });

const seedConfirm = document.getElementById("confirm-seed-saved");
if (seedConfirm) {
  seedConfirm.addEventListener("click", () => {
    setTimeout(() => retryDraftClaim(), 0);
  });
}

document.addEventListener("flop:profile-updated", () => {
  void syncSidebarNames();
  void decorateDids();
});

document.documentElement.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest(".lang-button")) scheduleTick();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    scheduleTick();
    retryDraftClaim();
  }
});

window.addEventListener("focus", () => {
  scheduleTick();
  retryDraftClaim();
});

scheduleTick();
retryDraftClaim();

window.FLOPAgentProfiles = { profileForDid, searchProfiles, saveProfile };
