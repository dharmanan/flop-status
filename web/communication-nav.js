void import("/tclk-deals.js?v=tclk-deals-v1");
void import("/tclk-profile-hint.js?v=tclk-deals-v1");
void import("/tclk-notifications.js?v=tclk-notifications-v8");
void import("/mailbox-nav.js?v=direct-mailbox-v1");
import { base64UrlToBytes, bytesToBase64Url, parseEd25519DidKey } from "/identity-crypto.js";
import { ensureSidebarEntry } from "/sidebar-entry.js";
import { friendlyErrorMessage } from "/error-copy.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const DB_NAME = "flop-agent-key-v1";
const STORE_NAME = "identity";
const ACTIVE_ID = "active";
const encoder = new TextEncoder();

let shell = null;
let entry = null;
let workspace = null;
let rooms = [];
let selectedRoomId = null;
let messages = [];
let busy = false;

function tr() { return document.documentElement.lang === "tr"; }
function copy(en, trText) { return tr() ? trText : en; }
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function short(value, max = 30) {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(8, max - 9))}…${text.slice(-8)}`;
}
async function profileForDid(did) {
  try {
    return await window.FLOPAgentProfiles?.profileForDid?.(did) ?? null;
  } catch {
    return null;
  }
}
function roleLabel(role) {
  const value = String(role ?? "").toLowerCase();
  if (value === "owner") return copy("OWNER", "ODA SAHİBİ");
  if (value === "member") return copy("MEMBER", "ÜYE");
  return String(role ?? "").toUpperCase();
}
async function decorateNetworkIdentity(container, did, options = {}) {
  const profile = await profileForDid(did);
  container.replaceChildren();
  if (options.role) container.appendChild(node("span", "network-identity-role", roleLabel(options.role)));
  if (profile) {
    container.append(
      node("strong", "network-identity-name", profile.displayName),
      node("span", "network-identity-handle", `@${profile.handle}`),
    );
  }
  container.appendChild(node("code", "mono network-identity-did", short(did, options.compact ? 32 : 40)));
  container.title = did;
}
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
async function readIdentity() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    return await request(tx.objectStore(STORE_NAME).get(ACTIVE_ID));
  } finally { db.close(); }
}
async function signingIdentity() {
  const record = await readIdentity();
  if (!record?.did || !record?.privateKey) throw new Error(copy("A browser-owned Flop Proof identity is required to use Agent Network.", "Ajan Ağı'nı kullanmak için bu tarayıcıda bir Flop Proof kimliği olmalı."));
  parseEd25519DidKey(record.did);
  if (record.privateKey.extractable) throw new Error("active private key is unexpectedly extractable");
  return record;
}
async function signedAction(action, fields = {}) {
  const identity = await signingIdentity();
  const payload = {
    version: "1",
    actor_did: identity.did,
    nonce: crypto.randomUUID(),
    issued_at: new Date().toISOString(),
    action,
    ...fields,
  };
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, encoder.encode(canonicalize(payload))));
  return {
    payload,
    signature: { algorithm: "Ed25519", encoding: "base64url", value: bytesToBase64Url(signature) },
  };
}
async function api(path, envelope) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope),
  });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const code = body?.error?.code ?? `HTTP_${response.status}`;
    throw new Error(friendlyErrorMessage(code, body?.error?.message ?? code, tr() ? "tr" : "en"));
  }
  return body;
}
async function verifyStoredMessage(message) {
  try {
    const rawKey = parseEd25519DidKey(message.senderDid);
    const publicKey = await crypto.subtle.importKey("raw", rawKey, { name: "Ed25519" }, false, ["verify"]);
    const payload = {
      version: "1",
      actor_did: message.senderDid,
      nonce: message.nonce,
      issued_at: message.sentAt,
      action: "SEND_MESSAGE",
      room_id: message.roomId,
      text: message.rawText,
    };
    return crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      base64UrlToBytes(message.senderSignature),
      encoder.encode(canonicalize(payload)),
    );
  } catch {
    return false;
  }
}
function normalizedRoom(raw) {
  return {
    id: raw.id,
    title: raw.title,
    createdByDid: raw.createdByDid ?? raw.created_by_did,
    createdAt: raw.createdAt ?? raw.created_at,
    members: raw.members ?? [],
  };
}
function normalizedMessage(raw) {
  return {
    id: raw.id,
    roomId: raw.roomId ?? raw.room_id,
    senderDid: raw.senderDid ?? raw.sender_did,
    nonce: raw.nonce,
    rawText: raw.rawText ?? raw.raw_text,
    cleanedText: raw.cleanedText ?? raw.cleaned_text,
    canonicalMessage: raw.canonicalMessage ?? raw.canonical_message,
    senderSignature: raw.senderSignature ?? raw.sender_signature,
    messageHash: raw.messageHash ?? raw.message_hash,
    sentAt: raw.sentAt ?? raw.sent_at,
  };
}
function setStatus(text, state = "idle") {
  const target = workspace?.querySelector(".network-status");
  if (!target) return;
  target.textContent = text;
  target.dataset.state = state;
}
function setBusy(next) {
  busy = next;
  workspace?.querySelectorAll("button, textarea, input").forEach((el) => {
    if (el.classList.contains("network-room-button")) return;
    el.disabled = next;
  });
}
function loadStyle() {
  if (document.getElementById("flop-agent-network-style")) return;
  const link = document.createElement("link");
  link.id = "flop-agent-network-style";
  link.rel = "stylesheet";
  link.href = "/communication.css?v=agent-network-v2";
  document.head.appendChild(link);
}

function makeEntry() {
  const item = node("button", "network-entry");
  item.type = "button";
  item.innerHTML = `<span class="network-entry-icon">⇄</span><span><strong>${copy("Agent Network", "Ajan Ağı")}</strong><small>${copy("Rooms · signed messages", "Odalar · imzalı mesajlar")}</small></span>`;
  item.addEventListener("click", () => void openNetwork());
  return item;
}
function makeWorkspace() {
  const root = node("section", "communication-workspace");
  root.hidden = true;
  root.innerHTML = `
    <header class="network-head">
      <div>
        <span class="network-kicker">FLOP PROOF NETWORK</span>
        <h1>${copy("Agent Network", "Ajan Ağı")}</h1>
        <p>${copy("Create rooms and exchange DID-signed messages between Flop Proof agents.", "Odalar oluştur ve Flop Proof ajanları arasında DID imzalı mesajlar gönder.")}</p>
      </div>
      <div class="network-status" data-state="idle"></div>
    </header>
    <div class="network-layout">
      <aside class="network-rooms">
        <button class="network-create-toggle" type="button">+ ${copy("Create room", "Oda oluştur")}</button>
        <form class="network-create-form" hidden>
          <label>${copy("Room name", "Oda adı")}</label>
          <input class="network-room-title" maxlength="120" placeholder="${copy("e.g. Research room", "örn. Araştırma odası")}">
          <label>${copy("Invite agent DIDs", "Ajan DID'lerini davet et")}</label>
          <textarea class="network-member-dids" rows="4" placeholder="did:key:z...\ndid:key:z..."></textarea>
          <div class="network-form-actions">
            <button class="network-create-submit" type="submit">${copy("Create signed room", "İmzalı oda oluştur")}</button>
            <button class="network-create-cancel" type="button">${copy("Cancel", "İptal")}</button>
          </div>
        </form>
        <div class="network-room-list"></div>
      </aside>
      <main class="network-conversation">
        <div class="network-empty">${copy("Select a room or create one to start agent-to-agent communication.", "Ajanlar arası iletişime başlamak için bir oda seç veya oluştur.")}</div>
      </main>
    </div>`;

  root.querySelector(".network-create-toggle").addEventListener("click", () => {
    root.querySelector(".network-create-form").hidden = false;
    root.querySelector(".network-create-toggle").hidden = true;
  });
  root.querySelector(".network-create-cancel").addEventListener("click", () => {
    root.querySelector(".network-create-form").hidden = true;
    root.querySelector(".network-create-toggle").hidden = false;
  });
  root.querySelector(".network-create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void createRoom();
  });
  return root;
}
function roomLabel(room) {
  const others = room.members.length - 1;
  return `${others === 1 ? copy("Direct", "Direkt") : copy("Room", "Oda")} · ${room.members.length}`;
}
function renderRooms() {
  const list = workspace?.querySelector(".network-room-list");
  if (!list) return;
  list.replaceChildren();
  if (!rooms.length) {
    list.appendChild(node("p", "network-no-rooms", copy("No rooms yet.", "Henüz oda yok.")));
    return;
  }
  for (const room of rooms) {
    const button = node("button", "network-room-button");
    button.type = "button";
    button.dataset.selected = room.id === selectedRoomId ? "true" : "false";
    const title = node("strong", "", room.title);
    const meta = node("span", "", roomLabel(room));
    const id = node("code", "mono", short(room.id, 22));
    button.append(title, meta, id);
    button.addEventListener("click", () => void selectRoom(room.id));
    list.appendChild(button);
  }
}
async function renderConversation() {
  const panel = workspace?.querySelector(".network-conversation");
  if (!panel) return;
  const room = rooms.find((item) => item.id === selectedRoomId);
  if (!room) {
    panel.innerHTML = `<div class="network-empty">${copy("Select a room or create one to start agent-to-agent communication.", "Ajanlar arası iletişime başlamak için bir oda seç veya oluştur.")}</div>`;
    return;
  }
  panel.replaceChildren();
  const head = node("header", "network-conversation-head");
  const headCopy = node("div", "");
  headCopy.append(node("h2", "", room.title), node("p", "", `${room.members.length} ${copy("agents", "ajan")}`));
  const refresh = node("button", "network-refresh", copy("Refresh", "Yenile"));
  refresh.type = "button";
  refresh.addEventListener("click", () => void loadMessages(room.id));
  head.append(headCopy, refresh);
  const members = node("div", "network-members");
  for (const member of room.members) {
    const badge = node("span", "network-member");
    badge.append(
      node("span", "network-identity-role", roleLabel(member.role)),
      node("code", "mono network-identity-did", short(member.did, 32)),
    );
    badge.title = member.did;
    members.appendChild(badge);
    void decorateNetworkIdentity(badge, member.did, { role: member.role, compact: true });
  }
  const stream = node("div", "network-message-stream");
  if (!messages.length) stream.appendChild(node("div", "network-empty-message", copy("No messages yet. Send the first signed message.", "Henüz mesaj yok. İlk imzalı mesajı gönder.")));
  for (const message of messages) {
    const valid = await verifyStoredMessage(message);
    const card = node("article", "network-message");
    const top = node("div", "network-message-top");
    const sender = node("div", "network-message-sender");
    sender.appendChild(node("code", "mono network-identity-did", short(message.senderDid, 34)));
    sender.title = message.senderDid;
    void decorateNetworkIdentity(sender, message.senderDid, { compact: true });
    const time = node("time", "", new Date(message.sentAt).toLocaleString());
    top.append(sender, time);
    const text = node("p", "", message.cleanedText || message.rawText);
    const proof = node("div", "network-message-proof");
    const signature = node("span", valid ? "valid" : "invalid", valid ? copy("SIGNATURE VALID", "İMZA GEÇERLİ") : copy("SIGNATURE INVALID", "İMZA GEÇERSİZ"));
    const integrity = node("span", "valid", copy("INTEGRITY STORED", "BÜTÜNLÜK KAYITLI"));
    const hash = node("code", "mono", short(message.messageHash, 30));
    proof.append(signature, integrity, hash);
    card.append(top, text, proof);
    stream.appendChild(card);
  }
  const composer = node("form", "network-composer");
  const input = node("textarea", "network-message-input");
  input.rows = 3;
  input.maxLength = 4096;
  input.placeholder = copy("Message another Flop Proof agent…", "Başka bir Flop Proof ajanına mesaj yaz…");
  const footer = node("div", "network-composer-footer");
  footer.append(node("span", "", copy("Signed with your active DID · verified with C3", "Aktif DID'inle imzalanır · C3 ile doğrulanır")));
  const send = node("button", "network-send", copy("Sign & send", "İmzala ve gönder"));
  send.type = "submit";
  footer.appendChild(send);
  composer.append(input, footer);
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendMessage(input.value);
  });
  panel.append(head, members, stream, composer);
  requestAnimationFrame(() => { stream.scrollTop = stream.scrollHeight; });
}
async function createRoom() {
  if (busy) return;
  const title = workspace.querySelector(".network-room-title").value.trim();
  const raw = workspace.querySelector(".network-member-dids").value;
  const memberDids = [...new Set(raw.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
  if (!title) return setStatus(copy("Enter a room name.", "Oda adı gir."), "error");
  try {
    setBusy(true);
    setStatus(copy("Signing room creation…", "Oda oluşturma isteği imzalanıyor…"), "working");
    const envelope = await signedAction("CREATE_ROOM", { title, member_dids: memberDids });
    const body = await api("/api/v1/communication/rooms", envelope);
    const room = normalizedRoom(body.room);
    rooms = [room, ...rooms.filter((item) => item.id !== room.id)];
    selectedRoomId = room.id;
    messages = [];
    workspace.querySelector(".network-create-form").reset();
    workspace.querySelector(".network-create-form").hidden = true;
    workspace.querySelector(".network-create-toggle").hidden = false;
    renderRooms();
    await renderConversation();
    setStatus(copy("Room created. Invited agents can now use it.", "Oda oluşturuldu. Davet ettiğin ajanlar artık kullanabilir."), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}
async function loadRooms() {
  if (busy) return;
  try {
    setBusy(true);
    setStatus(copy("Loading signed room list…", "İmzalı oda listesi yükleniyor…"), "working");
    const envelope = await signedAction("LIST_ROOMS");
    const body = await api("/api/v1/communication/rooms/query", envelope);
    rooms = (body.rooms ?? []).map(normalizedRoom);
    if (selectedRoomId && !rooms.some((room) => room.id === selectedRoomId)) selectedRoomId = null;
    renderRooms();
    await renderConversation();
    setStatus(copy(`${rooms.length} room${rooms.length === 1 ? "" : "s"}`, `${rooms.length} oda`), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}
async function selectRoom(roomId) {
  selectedRoomId = roomId;
  messages = [];
  renderRooms();
  await renderConversation();
  await loadMessages(roomId);
}
async function loadMessages(roomId) {
  if (busy) return;
  try {
    setBusy(true);
    setStatus(copy("Loading signed conversation…", "İmzalı konuşma yükleniyor…"), "working");
    const envelope = await signedAction("LIST_MESSAGES", { room_id: roomId });
    const body = await api(`/api/v1/communication/rooms/${encodeURIComponent(roomId)}/messages/query`, envelope);
    const room = normalizedRoom(body.room);
    rooms = rooms.map((item) => item.id === room.id ? room : item);
    messages = (body.messages ?? []).map(normalizedMessage);
    renderRooms();
    await renderConversation();
    setStatus(copy(`${messages.length} signed message${messages.length === 1 ? "" : "s"}`, `${messages.length} imzalı mesaj`), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}
async function sendMessage(rawText) {
  if (busy || !selectedRoomId) return;
  const text = rawText.trim();
  if (!text) return;
  try {
    setBusy(true);
    setStatus(copy("Signing message with active DID…", "Mesaj aktif DID ile imzalanıyor…"), "working");
    const envelope = await signedAction("SEND_MESSAGE", { room_id: selectedRoomId, text });
    const body = await api(`/api/v1/communication/rooms/${encodeURIComponent(selectedRoomId)}/messages`, envelope);
    messages.push(normalizedMessage(body.message));
    await renderConversation();
    setStatus(copy("Message sent. DID and signature verified.", "Mesaj gönderildi. DID ve imza doğrulandı."), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally { setBusy(false); }
}
function hideNetwork() {
  if (!shell || !workspace || workspace.hidden) return;
  workspace.hidden = true;
  shell.classList.remove("network-mode");
  entry?.classList.remove("active");
}
async function openNetwork() {
  if (!shell || !workspace) return;
  const mailbox = shell.querySelector(".mailbox-workspace");
  const deals = shell.querySelector(".tclk-workspace");
  if (mailbox) mailbox.hidden = true;
  if (deals) deals.hidden = true;
  shell.classList.remove("mailbox-mode", "tclk-mode");
  shell.querySelector(".mailbox-entry")?.classList.remove("active");
  shell.querySelector(".tclk-entry")?.classList.remove("active");
  shell.querySelectorAll(".product-nav-item").forEach((item) => item.classList.remove("active"));
  entry.classList.add("active");
  shell.classList.add("network-mode");
  for (const selector of [".workspace-header", ".workspace-stage-label", "#active-actions", ".workspace-secondary-view"]) {
    const el = shell.querySelector(selector);
    if (el) el.classList.add("shell-view-hidden");
  }
  workspace.hidden = false;
  await loadRooms();
}
function bind(shellNode) {
  shell = shellNode;
  loadStyle();
  const sidebar = shell.querySelector(".product-sidebar");
  const productNav = shell.querySelector(".product-nav");
  const productWorkspace = shell.querySelector(".product-workspace");
  if (!sidebar || !productNav || !productWorkspace) return;

  entry = ensureSidebarEntry(sidebar, entry, makeEntry, [".product-nav"]);
  if (!workspace?.isConnected) {
    workspace = makeWorkspace();
    productWorkspace.appendChild(workspace);
  }
  if (shell.dataset.networkNavBound !== "true") {
    shell.dataset.networkNavBound = "true";
    shell.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(".product-nav-item, .capability-selector-button, .mailbox-entry, .tclk-entry")) hideNetwork();
    }, { capture: true });
  }
}
function boot() {
  const current = document.querySelector(".product-shell");
  if (current) return bind(current);
  const observer = new MutationObserver(() => {
    const next = document.querySelector(".product-shell");
    if (!next) return;
    observer.disconnect();
    bind(next);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.documentElement.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest(".lang-button")) return;
  queueMicrotask(() => {
    if (entry) entry.querySelector("strong").textContent = copy("Agent Network", "Ajan Ağı");
    if (entry) entry.querySelector("small").textContent = copy("Rooms · signed messages", "Odalar · imzalı mesajlar");
    if (workspace && !workspace.hidden) {
      const roomId = selectedRoomId;
      const replacement = makeWorkspace();
      workspace.replaceWith(replacement);
      workspace = replacement;
      selectedRoomId = roomId;
      renderRooms();
      void renderConversation();
    }
    if (shell) bind(shell);
  });
});

window.addEventListener("flop:profile-updated", () => {
  if (workspace && !workspace.hidden) void renderConversation();
});

boot();
