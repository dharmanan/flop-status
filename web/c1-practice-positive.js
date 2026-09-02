import { bytesToBase64Url } from "/identity-crypto.js";
import { executeEd25519SignatureVerification } from "/capabilities/ed25519-signature-verification.js";

const encoder = new TextEncoder();

function randomToken(length = 10) {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

export async function createValidC1PracticeFixture() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const messageText = `FLOP practice ${randomToken()}`;
  const message = encoder.encode(messageText);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, message));

  return {
    input: {
      public_key: bytesToBase64Url(publicKey),
      message: bytesToBase64Url(message),
      signature: bytesToBase64Url(signature),
    },
    expected_valid: true,
    display: { message: messageText },
  };
}

export async function executeValidC1PracticeFixture(fixture) {
  return executeEd25519SignatureVerification(fixture.input);
}

function setValue(id, value) {
  const field = document.getElementById(id);
  if (field && "value" in field) field.value = value;
}

async function run(button) {
  button.disabled = true;
  try {
    const fixture = await createValidC1PracticeFixture();
    const result = await executeValidC1PracticeFixture(fixture);

    setValue("use-message", fixture.display.message);
    setValue("use-public-key", fixture.input.public_key);
    setValue("use-signature", fixture.input.signature);

    const details = document.getElementById("capability-1-use");
    if (details instanceof HTMLDetailsElement) details.open = true;

    const resultNode = document.getElementById("use-capability-1-result");
    if (resultNode) resultNode.textContent = JSON.stringify(result, null, 2);

    const status = document.getElementById("practice-result");
    if (status) {
      status.textContent = document.documentElement.lang === "tr"
        ? "Pratik başarılı. Aşağıdaki taze ve geçerli imza örneği gerçek yetenekle işlendi."
        : "Practice passed. The fresh valid signature example below was processed by the real capability.";
    }
  } finally {
    button.disabled = false;
  }
}

function bind() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("#practice-capability-1");
    if (!(button instanceof HTMLButtonElement)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void run(button).catch((error) => {
      const status = document.getElementById("practice-result");
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    });
  }, { capture: true });
}

if (typeof document !== "undefined") bind();
