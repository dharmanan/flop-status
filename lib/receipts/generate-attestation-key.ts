import { generateKeyPairSync, randomBytes } from "node:crypto";
import { encodeBase64Url } from "../crypto/base64url.js";
import {
  ATTESTATION_KEY_ID_ENV,
  ATTESTATION_PRIVATE_KEY_ENV,
} from "./attestation-signer.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" });
const publicJwk = publicKey.export({ format: "jwk" }) as { x: string };
const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const suffix = randomBytes(4).toString("hex");
const keyId = `capability-lab-attestation-${date}-${suffix}`;

process.stdout.write(
  [
    "Generate once, then store these values as Railway service variables.",
    "Do not paste the private key into chat, source control, logs, or PostgreSQL.",
    "",
    `${ATTESTATION_KEY_ID_ENV}=${keyId}`,
    `${ATTESTATION_PRIVATE_KEY_ENV}=${encodeBase64Url(new Uint8Array(pkcs8))}`,
    `FLOP_ATTESTATION_PUBLIC_KEY_B64URL=${publicJwk.x}`,
    "",
    "Only the first two values are runtime configuration. The public key line is printed for independent checking.",
  ].join("\n") + "\n",
);

pkcs8.fill(0);
