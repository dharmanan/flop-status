import { z } from "zod";
import { decodeBase64Url } from "../crypto/base64url.js";
import { ED25519_PUBLIC_KEY_LENGTH, ED25519_SIGNATURE_LENGTH } from "../crypto/ed25519.js";
import { isSha256Hash } from "../crypto/sha256.js";
import type {
  PublicVerificationRepository,
  StoredServerKey,
} from "../db/public-verification-repository.js";
import { parseEd25519DidKey } from "../identity/did-key.js";
import {
  RECEIPT_EVIDENCE_TYPE,
  RECEIPT_VERSION,
  verifyPassReceiptSignature,
  type SignedPassReceipt,
} from "../receipts/receipt.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuidSchema = z.string().regex(UUID_PATTERN);
const hashSchema = z.string().refine(isSha256Hash);
const didSchema = z.string().refine((value) => {
  try {
    parseEd25519DidKey(value);
    return true;
  } catch {
    return false;
  }
});
const publicKeySchema = z.string().refine((value) => {
  try {
    return decodeBase64Url(value).length === ED25519_PUBLIC_KEY_LENGTH;
  } catch {
    return false;
  }
});
const signatureSchema = z.string().refine((value) => {
  try {
    return decodeBase64Url(value).length === ED25519_SIGNATURE_LENGTH;
  } catch {
    return false;
  }
});

const unsignedReceiptSchema = z
  .object({
    receipt_version: z.literal(RECEIPT_VERSION),
    receipt_id: uuidSchema,
    agent_did: didSchema,
    capability_id: z.string().min(1),
    trial_id: z.string().min(1),
    trial_version: z.string().min(1),
    challenge_id: uuidSchema,
    challenge_hash: hashSchema,
    result_hash: hashSchema,
    verifier_id: z.string().min(1),
    verifier_version: z.string().min(1),
    verdict: z.literal("PASS"),
    evidence_type: z.literal(RECEIPT_EVIDENCE_TYPE),
    issued_at: z.string().datetime(),
    server_key_id: z.string().min(1),
  })
  .strict();

const signedReceiptSchema = unsignedReceiptSchema.extend({ server_signature: signatureSchema }).strict();

const serverKeySchema = z
  .object({
    key_id: z.string().min(1),
    algorithm: z.literal("Ed25519"),
    public_key: publicKeySchema,
    encoding: z.literal("base64url"),
    status: z.enum(["ACTIVE", "RETIRED", "COMPROMISED"]),
    valid_from: z.string().datetime(),
    valid_until: z.string().datetime().nullable(),
  })
  .strict();

export type PublicServerKey = z.infer<typeof serverKeySchema>;

export interface PublicReceiptVerification {
  receipt: SignedPassReceipt;
  server_key: PublicServerKey;
  signature_status: "VALID" | "INVALID";
}

export class PublicVerificationIntegrityError extends Error {
  constructor(readonly code: "STORED_RECEIPT_INVALID" | "SERVER_KEY_NOT_FOUND" | "SERVER_KEY_INVALID") {
    super(code);
    this.name = "PublicVerificationIntegrityError";
  }
}

export class PublicVerificationService {
  constructor(private readonly repository: PublicVerificationRepository) {}

  async getReceipt(receiptId: string): Promise<SignedPassReceipt | null> {
    if (!UUID_PATTERN.test(receiptId)) return null;
    const stored = await this.repository.findReceiptById(receiptId);
    if (!stored) return null;

    const parsed = signedReceiptSchema.safeParse({
      ...(stored.unsignedPayload as Record<string, unknown>),
      server_signature: stored.serverSignature,
    });
    if (!parsed.success || parsed.data.receipt_id !== receiptId) {
      throw new PublicVerificationIntegrityError("STORED_RECEIPT_INVALID");
    }
    return parsed.data;
  }

  async getVerification(receiptId: string): Promise<PublicReceiptVerification | null> {
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) return null;

    const storedKey = await this.repository.findServerKeyById(receipt.server_key_id);
    if (!storedKey) {
      throw new PublicVerificationIntegrityError("SERVER_KEY_NOT_FOUND");
    }
    const serverKey = this.parseServerKey(storedKey);
    return {
      receipt,
      server_key: serverKey,
      signature_status: verifyPassReceiptSignature(receipt, serverKey.public_key) ? "VALID" : "INVALID",
    };
  }

  async getServerKeys(): Promise<PublicServerKey[]> {
    const keys = await this.repository.listServerKeys();
    return keys.map((key) => this.parseServerKey(key));
  }

  private parseServerKey(storedKey: StoredServerKey): PublicServerKey {
    const parsed = serverKeySchema.safeParse(storedKey);
    if (!parsed.success) {
      throw new PublicVerificationIntegrityError("SERVER_KEY_INVALID");
    }
    return parsed.data;
  }
}
