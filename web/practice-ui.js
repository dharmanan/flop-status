import { bytesToBase64Url } from "/identity-crypto.js";
import {
  executeEd25519SignatureVerification,
  evaluatePractice as evaluateCapability1Practice,
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
    ? (document.documentElement.lang === "tr" ? "Pratik başarılı. Aşağıdaki taze örnek gerçek yetenekle işlendi." : "Practice passed. The fresh example below was processed by the real capability.")
    : (document.documentElement.lang === "tr" ? "Pratik başarısız. Yeni bir örnekle tekrar dene." : "Practice failed. Try again with a new example.");
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

function bind() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest('button[id^="practice-capability-"]') : null;
    if (!(target instanceof HTMLButtonElement)) return;
    const number = Number(target.id.match(/practice-capability-(\d+)/)?.[1]);
    if (!Number.isInteger(number) || number < 1 || number > 7) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void runPractice(number, target).catch((error) => {
      const status = practiceStatusTarget(number);
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    });
  }, { capture: true });
}

if (typeof document !== "undefined") bind();
