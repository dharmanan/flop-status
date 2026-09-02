import { bytesToBase64Url } from "/identity-crypto.js";
import {
  executeEd25519SignatureVerification,
  evaluatePractice as evaluateCapability1Practice,
  textMessageToBase64Url,
} from "/capabilities/ed25519-signature-verification.js";
import {
  executeCanonicalJsonSha256,
  evaluatePractice as evaluateCapability2Practice,
} from "/capabilities/canonical-json-sha256.js";
import {
  executeTechnocoreCanonicalMessage,
  evaluatePractice as evaluateCapability3Practice,
} from "/capabilities/technocore-canonical-message.js";
import {
  createPracticeFixture as createCapability4PracticeFixture,
  executeSignedReceiptVerification,
  evaluatePractice as evaluateCapability4Practice,
} from "/capabilities/signed-receipt-verification.js";
import {
  executeStructuredDataTransformation,
  evaluatePractice as evaluateCapability5Practice,
} from "/capabilities/structured-data-transformation.js";
import {
  executeConstraintPolicyCompliance,
  evaluatePractice as evaluateCapability6Practice,
} from "/capabilities/constraint-policy-compliance.js";
import {
  executeFailureRecoveryIdempotency,
  evaluatePractice as evaluateCapability7Practice,
} from "/capabilities/failure-recovery-idempotency.js";
import { canonicalizeJson } from "/capabilities/jcs.js";

const encoder = new TextEncoder();

function randomToken(length = 8) {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

function randomInt(min, max) {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return min + (bytes[0] % (max - min + 1));
}

async function sha256Base64Url(text) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
  return `sha256:${bytesToBase64Url(digest)}`;
}

async function capability1Fixture() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const messageText = `FLOP practice ${randomToken(10)}`;
  const message = encoder.encode(messageText);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, message));
  const makeInvalid = crypto.getRandomValues(new Uint8Array(1))[0] >= 128;
  if (makeInvalid) signature[0] ^= 0xff;
  return {
    input: {
      public_key: bytesToBase64Url(publicKey),
      message: bytesToBase64Url(message),
      signature: bytesToBase64Url(signature),
    },
    expected_valid: !makeInvalid,
    display: { message: messageText },
  };
}

async function capability2Fixture() {
  const token = randomToken(8);
  const document = {
    z: randomInt(2, 99),
    a: { b: randomInt(2, 9), a: 1 },
    list: [true, null, `flop-${token}`],
  };
  const canonical = canonicalizeJson(document);
  return {
    input: { document },
    expected: {
      canonical_json: canonical,
      sha256: await sha256Base64Url(canonical),
    },
  };
}

function capability3Fixture() {
  const token = randomToken(8);
  const room = `practice-${randomToken(6)}`;
  const nonce = String(Date.now()) + String(randomInt(10, 99));
  const cleaned = `alpha ${token} beta`;
  const text = `  alpha\n\t${token}   beta  `;
  return {
    input: { room, nonce, text },
    expected: {
      cleaned_text: cleaned,
      canonical_message: `${room}|${nonce}|${cleaned}`,
    },
  };
}

function capability5Fixture() {
  const suffix = randomToken(5);
  const quantity = randomInt(1, 6);
  const price = randomInt(1000, 25000) / 100;
  const country = ["TR", "DE", "NL"][randomInt(0, 2)];
  const name = `Ada ${suffix}`;
  const sku = `A${randomInt(10, 99)}`;
  const source = {
    customer: { name, country },
    items: [{ sku, qty: String(quantity), price }],
  };
  const spec = {
    version: "1",
    operations: [
      { op: "rename", from: "customer.name", to: "buyer.full_name" },
      { op: "copy", from: "customer.country", to: "buyer.country" },
      {
        op: "map_array",
        from: "items",
        to: "lines",
        fields: {
          sku: { from: "sku", type: "string" },
          quantity: { from: "qty", type: "integer" },
          unit_price: { from: "price", type: "number" },
        },
      },
    ],
  };
  return {
    input: { source, spec },
    expected: {
      reason_code: "TRANSFORMATION_MATCH",
      result: {
        buyer: { full_name: name, country },
        lines: [{ sku, quantity, unit_price: price }],
      },
    },
  };
}

function capability6Fixture() {
  const amount = randomInt(250, 4500);
  const customerType = ["individual", "business"][randomInt(0, 1)];
  const document = {
    order: {
      country: "TR",
      currency: "TRY",
      amount,
      customer_type: customerType,
      priority: `practice-${randomToken(4)}`,
    },
  };
  const policy = {
    version: "1",
    rules: [
      { id: "currency_by_country", type: "equals", path: "order.currency", value: "TRY" },
      { id: "amount_limit", type: "number_max", path: "order.amount", value: 5000 },
      { id: "customer_type", type: "one_of", path: "order.customer_type", values: ["individual", "business"] },
      { id: "required_country", type: "required", path: "order.country" },
    ],
  };
  return {
    input: { document, policy },
    expected: {
      reason_code: "POLICY_COMPLIANT",
      result: {
        compliant: true,
        violations: [],
        evaluated_rules: ["currency_by_country", "amount_limit", "customer_type", "required_country"],
      },
    },
  };
}

function capability7Fixture() {
  const initial = randomInt(50, 250);
  const amount = randomInt(1, 50);
  const idempotencyKey = `op_${randomToken(10)}`;
  const input = {
    operation: { idempotency_key: idempotencyKey, type: "increment", path: "balance", amount },
    initial_state: { balance: initial },
    attempt_plan: [
      { attempt: 1, outcome: "TRANSIENT_FAILURE" },
      { attempt: 2, outcome: "SUCCESS" },
      { attempt: 3, outcome: "DUPLICATE_DELIVERY" },
    ],
    retry_policy: { max_attempts: 3, retry_on: ["TRANSIENT_FAILURE"] },
  };
  return {
    input,
    expected: {
      reason_code: "IDEMPOTENT_REPLAY",
      result: {
        status: "COMMITTED",
        final_state: { balance: initial + amount },
        applied_count: 1,
        idempotency_key: idempotencyKey,
        attempts: [
          { attempt: 1, status: "RETRYABLE_FAILURE" },
          { attempt: 2, status: "APPLIED" },
          { attempt: 3, status: "DUPLICATE_REPLAY" },
        ],
      },
    },
  };
}

export async function createFreshPracticeFixture(number) {
  if (number === 1) return capability1Fixture();
  if (number === 2) return capability2Fixture();
  if (number === 3) return capability3Fixture();
  if (number === 4) return createCapability4PracticeFixture();
  if (number === 5) return capability5Fixture();
  if (number === 6) return capability6Fixture();
  if (number === 7) return capability7Fixture();
  throw new Error(`UNKNOWN_CAPABILITY_${number}`);
}

export async function executePracticeFixture(number, fixture) {
  if (number === 1) return executeEd25519SignatureVerification(fixture.input);
  if (number === 2) return executeCanonicalJsonSha256(fixture.input);
  if (number === 3) return executeTechnocoreCanonicalMessage(fixture.input);
  if (number === 4) return executeSignedReceiptVerification(fixture.input);
  if (number === 5) return executeStructuredDataTransformation(fixture.input);
  if (number === 6) return executeConstraintPolicyCompliance(fixture.input);
  if (number === 7) return executeFailureRecoveryIdempotency(fixture.input);
  throw new Error(`UNKNOWN_CAPABILITY_${number}`);
}

export async function evaluatePracticeFixture(number, result, fixture) {
  if (number === 1) return evaluateCapability1Practice(result, fixture);
  if (number === 2) return evaluateCapability2Practice(result, fixture);
  if (number === 3) return evaluateCapability3Practice(result, fixture);
  if (number === 4) return evaluateCapability4Practice(result, fixture);
  if (number === 5) return evaluateCapability5Practice(result, fixture);
  if (number === 6) return evaluateCapability6Practice(result, fixture);
  if (number === 7) return evaluateCapability7Practice(result, fixture);
  throw new Error(`UNKNOWN_CAPABILITY_${number}`);
}

export function practiceFieldValues(number, fixture) {
  const pretty = (value) => JSON.stringify(value, null, 2);
  if (number === 1) return {
    "use-message": fixture.display?.message ?? "",
    "use-public-key": fixture.input.public_key,
    "use-signature": fixture.input.signature,
  };
  if (number === 2) return { "use-json-2": pretty(fixture.input.document) };
  if (number === 3) return {
    "use-room": fixture.input.room,
    "use-nonce": fixture.input.nonce,
    "use-text": fixture.input.text,
  };
  if (number === 4) return {
    "use-receipt": pretty(fixture.input.receipt),
    "use-server-keys": pretty(fixture.input.server_keys),
  };
  if (number === 5) return {
    "use-source-5": pretty(fixture.input.source),
    "use-spec-5": pretty(fixture.input.spec),
  };
  if (number === 6) return {
    "use-document-6": pretty(fixture.input.document),
    "use-policy-6": pretty(fixture.input.policy),
  };
  if (number === 7) return { "use-scenario-7": pretty(fixture.input) };
  throw new Error(`UNKNOWN_CAPABILITY_${number}`);
}

function resultTarget(number) {
  return document.getElementById(`use-capability-${number}-result`);
}

function practiceStatusTarget(number) {
  return document.getElementById(number === 1 ? "practice-result" : `practice-result-${number}`);
}

function tr() {
  return document.documentElement.lang === "tr";
}

export function interpretCapabilityUseResult(number, result, language = "en") {
  const isTr = language === "tr";
  const pair = (tone, enTitle, trTitle, enDetail, trDetail) => ({
    tone,
    title: isTr ? trTitle : enTitle,
    detail: isTr ? trDetail : enDetail,
  });

  if (number === 1) {
    return result?.valid === true
      ? pair("success", "Signature verified", "İmza doğrulandı", "The message, public key and signature match.", "Mesaj, public key ve imza birbiriyle eşleşiyor.")
      : pair("error", "Signature could not be verified", "İmza doğrulanamadı", "The message, key or signature does not match.", "Mesaj, anahtar veya imza eşleşmiyor.");
  }
  if (number === 2) {
    return typeof result?.canonical_json === "string" && typeof result?.sha256 === "string"
      ? pair("success", "Canonical fingerprint created", "Kanonik parmak izi oluşturuldu", "The JSON was canonicalized and its SHA256 digest was produced.", "JSON kanonikleştirildi ve SHA256 özeti üretildi.")
      : pair("error", "JSON could not be processed", "JSON işlenemedi", "Check the input and try again.", "Girdiyi kontrol edip tekrar dene.");
  }
  if (number === 3) {
    return typeof result?.canonical_message === "string"
      ? pair("success", "Canonical message created", "Kanonik mesaj oluşturuldu", "The room, nonce and message were normalized into the Technocore format.", "Room, nonce ve mesaj Technocore biçimine dönüştürüldü.")
      : pair("error", "Message could not be built", "Mesaj oluşturulamadı", "Check the room, nonce and message text.", "Room, nonce ve mesaj metnini kontrol et.");
  }
  if (number === 4) {
    if (result?.status === "VALID") return pair("success", "Receipt verified", "Makbuz doğrulandı", "The signed receipt matches a supplied FLOP server key.", "İmzalı makbuz verilen FLOP sunucu anahtarlarından biriyle eşleşiyor.");
    if (result?.status === "UNKNOWN") return pair("warning", "Verification incomplete", "Doğrulama tamamlanamadı", "The receipt references a server key that is not in the supplied key set.", "Makbuz, verilen anahtar kümesinde bulunmayan bir sunucu anahtarına başvuruyor.");
    return pair("error", "Receipt is not valid", "Makbuz geçerli değil", "The signature or declared server key does not match.", "İmza veya belirtilen sunucu anahtarı eşleşmiyor.");
  }
  if (number === 5) {
    return result?.reason_code === "TRANSFORMATION_MATCH" && result?.result !== null
      ? pair("success", "Transformation completed", "Dönüşüm tamamlandı", "The source data was transformed according to the specification.", "Kaynak veri spesifikasyona göre dönüştürüldü.")
      : pair("error", "Transformation failed", "Dönüşüm başarısız", `Reason: ${result?.reason_code ?? "UNKNOWN"}.`, `Neden: ${result?.reason_code ?? "UNKNOWN"}.`);
  }
  if (number === 6) {
    if (result?.reason_code === "POLICY_COMPLIANT") return pair("success", "Policy compliant", "Politikaya uygun", "All evaluated rules passed.", "Değerlendirilen tüm kurallar geçti.");
    if (result?.reason_code === "POLICY_VIOLATION") {
      const count = Array.isArray(result?.result?.violations) ? result.result.violations.length : 0;
      return pair("warning", "Policy violations found", "Politika ihlali bulundu", `${count} rule violation${count === 1 ? "" : "s"} detected.`, `${count} kural ihlali tespit edildi.`);
    }
    return pair("error", "Policy could not be evaluated", "Politika değerlendirilemedi", `Reason: ${result?.reason_code ?? "UNKNOWN"}.`, `Neden: ${result?.reason_code ?? "UNKNOWN"}.`);
  }
  if (number === 7) {
    if (result?.result?.status === "COMMITTED" && ["RECOVERY_SUCCESS", "IDEMPOTENT_REPLAY"].includes(result?.reason_code)) {
      const applied = result.result.applied_count ?? 0;
      return pair("success", "Recovery completed safely", "Kurtarma güvenle tamamlandı", `The operation was committed and applied ${applied} time${applied === 1 ? "" : "s"}.`, `İşlem commit edildi ve ${applied} kez uygulandı.`);
    }
    if (["RETRY_LIMIT_EXCEEDED", "PERMANENT_FAILURE"].includes(result?.reason_code)) {
      return pair("warning", "Scenario ended without commit", "Senaryo commit olmadan sonlandı", `The simulator completed with ${result.reason_code}.`, `Simülasyon ${result.reason_code} sonucuyla tamamlandı.`);
    }
    return pair("error", "Recovery scenario is invalid", "Kurtarma senaryosu geçersiz", `Reason: ${result?.reason_code ?? "UNKNOWN"}.`, `Neden: ${result?.reason_code ?? "UNKNOWN"}.`);
  }
  return pair("error", "Unknown capability result", "Bilinmeyen yetenek sonucu", "The result could not be interpreted.", "Sonuç yorumlanamadı.");
}

function ensureFeedbackStyle() {
  if (document.getElementById("flop-capability-use-feedback-style")) return;
  const style = document.createElement("style");
  style.id = "flop-capability-use-feedback-style";
  style.textContent = `
    .capability-use-feedback { margin: 12px 0 10px; padding: 12px 14px; border: 1px solid #2d3c33; border-radius: 10px; background: #0f1712; display: grid; gap: 4px; }
    .capability-use-feedback strong { font-size: 13px; color: #dff5e5; }
    .capability-use-feedback span { font-size: 12px; line-height: 1.45; color: #a8b8ad; }
    .capability-use-feedback[data-tone="warning"] { border-color: #66552c; background: #18150d; }
    .capability-use-feedback[data-tone="warning"] strong { color: #ead18a; }
    .capability-use-feedback[data-tone="warning"] span { color: #b9aa80; }
    .capability-use-feedback[data-tone="error"] { border-color: #62403d; background: #181110; }
    .capability-use-feedback[data-tone="error"] strong { color: #efb4ad; }
    .capability-use-feedback[data-tone="error"] span { color: #bd9995; }
  `;
  document.head.appendChild(style);
}

function feedbackTarget(number) {
  let target = document.getElementById(`use-capability-${number}-feedback`);
  if (target) return target;
  const resultNode = resultTarget(number);
  if (!resultNode?.parentElement) return null;
  target = document.createElement("div");
  target.id = `use-capability-${number}-feedback`;
  target.className = "capability-use-feedback";
  target.hidden = true;
  target.setAttribute("role", "status");
  target.setAttribute("aria-live", "polite");
  resultNode.insertAdjacentElement("beforebegin", target);
  return target;
}

export function renderCapabilityUseFeedback(number, result) {
  ensureFeedbackStyle();
  const interpreted = interpretCapabilityUseResult(number, result, tr() ? "tr" : "en");
  const target = feedbackTarget(number);
  if (target) {
    target.replaceChildren();
    target.dataset.tone = interpreted.tone;
    target.append(
      Object.assign(document.createElement("strong"), { textContent: `${interpreted.tone === "success" ? "✓ " : interpreted.tone === "warning" ? "! " : "✕ "}${interpreted.title}` }),
      Object.assign(document.createElement("span"), { textContent: interpreted.detail }),
    );
    target.hidden = false;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  const resultNode = resultTarget(number);
  if (resultNode) resultNode.textContent = JSON.stringify(result, null, 2);
  return interpreted;
}

function renderUseError(number, error) {
  ensureFeedbackStyle();
  const target = feedbackTarget(number);
  if (!target) return;
  target.replaceChildren();
  target.dataset.tone = "error";
  const title = tr() ? "İşlem tamamlanamadı" : "Operation could not be completed";
  const detail = error instanceof SyntaxError
    ? (tr() ? "JSON alanlarından biri geçerli değil." : "One of the JSON fields is not valid.")
    : (error instanceof Error ? error.message : String(error));
  target.append(
    Object.assign(document.createElement("strong"), { textContent: `✕ ${title}` }),
    Object.assign(document.createElement("span"), { textContent: detail }),
  );
  target.hidden = false;
}

export function renderPracticeFixture(number, fixture, result, passed) {
  const values = practiceFieldValues(number, fixture);
  for (const [id, value] of Object.entries(values)) {
    const field = document.getElementById(id);
    if (field && "value" in field) field.value = value;
  }
  const details = document.getElementById(`capability-${number}-use`);
  if (details instanceof HTMLDetailsElement) details.open = true;
  const resultNode = resultTarget(number);
  if (resultNode) resultNode.textContent = JSON.stringify(result, null, 2);
  const status = practiceStatusTarget(number);
  if (status) status.textContent = passed
    ? (tr() ? "Pratik başarılı. Aşağıdaki taze örnek gerçek yetenekle işlendi." : "Practice passed. The fresh example below was processed by the real capability.")
    : (tr() ? "Pratik başarısız. Yeni bir örnekle tekrar dene." : "Practice failed. Try again with a new example.");
}

async function runPractice(number, button) {
  button.disabled = true;
  try {
    const fixture = await createFreshPracticeFixture(number);
    const result = await executePracticeFixture(number, fixture);
    const passed = await evaluatePracticeFixture(number, result, fixture);
    renderPracticeFixture(number, fixture, result, passed);
  } finally {
    button.disabled = false;
  }
}

function requiredValue(id) {
  const field = document.getElementById(id);
  const value = field && "value" in field ? String(field.value) : "";
  if (!value.trim()) throw new Error(tr() ? "Gerekli alanları doldur." : "Complete the required fields.");
  return value;
}

function parseJsonField(id) {
  return JSON.parse(requiredValue(id));
}

async function runCapabilityUse(number, button) {
  button.disabled = true;
  try {
    let result;
    if (number === 1) {
      result = await executeEd25519SignatureVerification({
        public_key: requiredValue("use-public-key").trim(),
        message: textMessageToBase64Url(requiredValue("use-message")),
        signature: requiredValue("use-signature").trim(),
      });
    } else if (number === 2) {
      result = await executeCanonicalJsonSha256({ document: parseJsonField("use-json-2") });
    } else if (number === 3) {
      result = await executeTechnocoreCanonicalMessage({
        room: requiredValue("use-room").trim(),
        nonce: requiredValue("use-nonce").trim(),
        text: requiredValue("use-text"),
      });
    } else if (number === 4) {
      result = await executeSignedReceiptVerification({ receipt: parseJsonField("use-receipt"), server_keys: parseJsonField("use-server-keys") });
    } else if (number === 5) {
      result = await executeStructuredDataTransformation({ source: parseJsonField("use-source-5"), spec: parseJsonField("use-spec-5") });
    } else if (number === 6) {
      result = await executeConstraintPolicyCompliance({ document: parseJsonField("use-document-6"), policy: parseJsonField("use-policy-6") });
    } else if (number === 7) {
      result = await executeFailureRecoveryIdempotency(parseJsonField("use-scenario-7"));
    } else {
      throw new Error(`UNKNOWN_CAPABILITY_${number}`);
    }
    renderCapabilityUseFeedback(number, result);
  } catch (error) {
    renderUseError(number, error);
  } finally {
    button.disabled = false;
  }
}

function bind() {
  document.addEventListener("click", (event) => {
    const element = event.target instanceof Element ? event.target : null;
    const practiceButton = element?.closest('button[id^="practice-capability-"]');
    if (practiceButton instanceof HTMLButtonElement) {
      const number = Number(practiceButton.id.match(/practice-capability-(\d+)/)?.[1]);
      if (!Number.isInteger(number) || number < 1 || number > 7) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void runPractice(number, practiceButton).catch((error) => {
        const status = practiceStatusTarget(number);
        if (status) status.textContent = error instanceof Error ? error.message : String(error);
      });
      return;
    }

    const useButton = element?.closest('button[id^="use-capability-"][id$="-run"]');
    if (!(useButton instanceof HTMLButtonElement)) return;
    const number = Number(useButton.id.match(/use-capability-(\d+)-run/)?.[1]);
    if (!Number.isInteger(number) || number < 1 || number > 7) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void runCapabilityUse(number, useButton);
  }, { capture: true });
}

if (typeof document !== "undefined") bind();
