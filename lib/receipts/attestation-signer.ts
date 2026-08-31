import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  type KeyObject,
} from "node:crypto";
import { decodeBase64Url, encodeBase64Url } from "../crypto/base64url.js";
import type { AttestationSigner } from "./receipt.js";

export const ATTESTATION_PRIVATE_KEY_ENV = "FLOP_ATTESTATION_PRIVATE_KEY_PKCS8_B64URL";
export const ATTESTATION_KEY_ID_ENV = "FLOP_ATTESTATION_KEY_ID";

const KEY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export class AttestationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttestationConfigurationError";
  }
}

function parsePrivateKey(encoded: string): KeyObject {
  let der: Uint8Array;
  try {
    der = decodeBase64Url(encoded);
  } catch {
    throw new AttestationConfigurationError(
      `${ATTESTATION_PRIVATE_KEY_ENV} must be canonical unpadded base64url`,
    );
  }
  if (der.length === 0) {
    throw new AttestationConfigurationError(`${ATTESTATION_PRIVATE_KEY_ENV} is empty`);
  }

  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(der),
      format: "der",
      type: "pkcs8",
    });
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new AttestationConfigurationError("attestation private key must be Ed25519 PKCS8");
    }
    return privateKey;
  } catch (error) {
    if (error instanceof AttestationConfigurationError) throw error;
    throw new AttestationConfigurationError("attestation private key is not valid Ed25519 PKCS8");
  } finally {
    der.fill(0);
  }
}

export function loadAttestationSignerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AttestationSigner {
  const encodedPrivateKey = env[ATTESTATION_PRIVATE_KEY_ENV];
  const keyId = env[ATTESTATION_KEY_ID_ENV];

  if (!encodedPrivateKey) {
    throw new AttestationConfigurationError(`${ATTESTATION_PRIVATE_KEY_ENV} is required`);
  }
  if (!keyId || !KEY_ID_PATTERN.test(keyId)) {
    throw new AttestationConfigurationError(
      `${ATTESTATION_KEY_ID_ENV} must match ${KEY_ID_PATTERN.source}`,
    );
  }

  const privateKey = parsePrivateKey(encodedPrivateKey);
  const publicJwk = createPublicKey(privateKey).export({ format: "jwk" }) as { x?: string };
  if (!publicJwk.x) {
    throw new AttestationConfigurationError("could not derive Ed25519 public key");
  }

  return {
    keyId,
    algorithm: "Ed25519",
    publicKeyEncoding: "base64url",
    publicKey: publicJwk.x,
    sign(message: Uint8Array): string {
      const signature = cryptoSign(null, Buffer.from(message), privateKey);
      return encodeBase64Url(new Uint8Array(signature));
    },
  };
}
