import { identityFromSeed, readIdentitySeedProfile } from "/identity-crypto.js";

const API_BASE = "https://flop-status-production.up.railway.app";
const DRAFT_KEY = "flop-agent-profile-draft";
let inputTimer = null;
let sequence = 0;

async function backendProfile(did) {
  const response = await fetch(`${API_BASE}/api/v1/agent-profiles/${encodeURIComponent(did)}`, { cache: "no-store" });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.profile ?? null;
}

async function stageProfileMetadata(text) {
  const request = ++sequence;
  const metadata = readIdentitySeedProfile(text);
  if (!metadata) {
    sessionStorage.removeItem(DRAFT_KEY);
    return;
  }

  let restored;
  try {
    restored = await identityFromSeed(text);
  } catch {
    return;
  }
  if (request !== sequence) return;

  try {
    const existing = await backendProfile(restored.did);
    if (request !== sequence) return;
    if (existing) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
  } catch {
    // If the public lookup is temporarily unavailable, preserve portable
    // metadata as a recovery fallback. The signed claim still requires the
    // restored private key before the backend can accept it.
  }

  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(metadata));
}

const seedFile = document.getElementById("seed-file");
if (seedFile) {
  seedFile.addEventListener("change", () => {
    const file = seedFile.files?.[0];
    if (!file) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    void file.text().then(stageProfileMetadata);
  });
}

const seedInput = document.getElementById("seed-input");
if (seedInput) {
  seedInput.addEventListener("input", () => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      const text = seedInput.value.trim();
      if (!text) {
        sessionStorage.removeItem(DRAFT_KEY);
        return;
      }
      void stageProfileMetadata(text);
    }, 180);
  });
}
