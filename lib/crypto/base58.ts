const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_CHAR_INDEX = new Map<string, number>(
  Array.from(BASE58_ALPHABET, (char, index) => [char, index]),
);

export class Base58Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Base58Error";
  }
}

export function encodeBase58btc(bytes: Uint8Array): string {
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros += 1;
  }

  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }

  let body = "";
  while (num > 0n) {
    const remainder = Number(num % 58n);
    body = BASE58_ALPHABET[remainder] + body;
    num = num / 58n;
  }

  return "1".repeat(leadingZeros) + body;
}

export function decodeBase58btc(value: string): Uint8Array {
  if (typeof value !== "string") {
    throw new Base58Error("base58btc value must be a string");
  }
  if (value.length === 0) {
    return new Uint8Array(0);
  }

  let leadingZeros = 0;
  while (leadingZeros < value.length && value[leadingZeros] === "1") {
    leadingZeros += 1;
  }

  let num = 0n;
  for (let i = leadingZeros; i < value.length; i += 1) {
    const char = value[i]!;
    const digit = BASE58_CHAR_INDEX.get(char);
    if (digit === undefined) {
      throw new Base58Error(
        `base58btc value contains an invalid character: ${JSON.stringify(char)}`,
      );
    }
    num = num * 58n + BigInt(digit);
  }

  let hex = num.toString(16);
  if (hex.length % 2 === 1) {
    hex = `0${hex}`;
  }
  const body = num === 0n ? new Uint8Array(0) : Uint8Array.from(Buffer.from(hex, "hex"));

  const result = new Uint8Array(leadingZeros + body.length);
  result.set(body, leadingZeros);
  return result;
}
