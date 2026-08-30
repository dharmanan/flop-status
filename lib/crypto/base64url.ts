export class Base64UrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Base64UrlError";
  }
}

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

export function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function decodeBase64Url(value: string): Uint8Array {
  if (typeof value !== "string") {
    throw new Base64UrlError("base64url value must be a string");
  }
  if (!BASE64URL_PATTERN.test(value)) {
    throw new Base64UrlError(
      "base64url value contains characters outside the unpadded base64url alphabet",
    );
  }
  if (value.length % 4 === 1) {
    throw new Base64UrlError("base64url value has an invalid length");
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new Base64UrlError("base64url value is not a canonical encoding");
  }
  return new Uint8Array(decoded);
}
