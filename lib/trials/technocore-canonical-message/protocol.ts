export const TECHNOCORE_TEXT_LIMIT = 4096;

export function cleanTechnocoreLine(value: string, limit = TECHNOCORE_TEXT_LIMIT): string {
  const result = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!result) throw new Error("Technocore text cannot be empty after cleaning");
  if (result.length > limit) throw new Error(`Technocore text is limited to ${limit} characters`);
  return result;
}

export function buildCanonicalTechnocoreMessage(room: string, nonce: string, rawText: string): {
  cleanedText: string;
  canonicalMessage: string;
} {
  const cleanedText = cleanTechnocoreLine(rawText);
  return {
    cleanedText,
    canonicalMessage: `${room}|${nonce}|${cleanedText}`,
  };
}
