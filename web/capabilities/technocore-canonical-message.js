export const CAPABILITY_ID = "protocol.technocore-canonical-message";
export const PRODUCTION_TRIAL_ID = "technocore-canonical-message-certification";
export const TRIAL_VERSION = "1";

const TECHNOCORE_TEXT_LIMIT = 4096;

/**
 * Reference Technocore cleaning rule: control characters and line/paragraph
 * separators become spaces, runs of whitespace collapse to one space, and the
 * result is trimmed. Mirrors lib/trials/technocore-canonical-message/protocol.ts
 * and must not diverge from it.
 */
function cleanTechnocoreLine(value, limit = TECHNOCORE_TEXT_LIMIT) {
  const result = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!result) throw new Error("Technocore text cannot be empty after cleaning");
  if (result.length > limit) throw new Error(`Technocore text is limited to ${limit} characters`);
  return result;
}

/**
 * The signed canonical form is room|nonce|cleaned text. This is the single
 * executor used by practice, certification and normal FLOP use.
 */
export async function executeTechnocoreCanonicalMessage(input) {
  const cleanedText = cleanTechnocoreLine(input.text);
  return {
    cleaned_text: cleanedText,
    canonical_message: `${input.room}|${input.nonce}|${cleanedText}`,
  };
}

export function createPracticeFixture() {
  const input = { room: "practice-room", nonce: "1700000000001", text: "  alpha\n\tbeta  " };
  return {
    input,
    expected: {
      cleaned_text: "alpha beta",
      canonical_message: `${input.room}|${input.nonce}|alpha beta`,
    },
  };
}

export async function evaluatePractice(result, fixture) {
  return (
    result.cleaned_text === fixture.expected.cleaned_text &&
    result.canonical_message === fixture.expected.canonical_message
  );
}
