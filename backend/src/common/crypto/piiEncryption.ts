import crypto from "node:crypto";
import { env } from "@/config/env";

// Field-level encryption for PII at rest (phone, name, email on the User
// model — see src/database/prisma.ts's client extension, which is the only
// caller of this module). AES-256-GCM: authenticated encryption, so a
// tampered ciphertext fails to decrypt rather than silently returning
// garbage. A fresh random IV per call means the same plaintext (the same
// phone number twice) never produces the same ciphertext — which is
// exactly why lookups can't use the encrypted column directly; see
// hashLookupValue below for the deterministic blind index that's used for
// that instead.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV is the recommended size for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = Buffer.from(env.PII_ENCRYPTION_KEY, "hex");
  if (key.length !== 32) {
    throw new Error("PII_ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256");
  }
  return key;
}

// Output layout: base64(iv [12 bytes] || authTag [16 bytes] || ciphertext).
// Self-contained so decryption never needs anything but the key.
export function encryptPII(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptPII(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// Deterministic HMAC-SHA256 "blind index": same input always produces the
// same output, which is what lets the database enforce uniqueness and
// answer `WHERE phoneHash = ?` without ever storing the phone number in
// queryable plaintext. A keyed hash (not a plain SHA-256) so the index
// can't be reversed by precomputing hashes of every possible Ghana phone
// number (a 10-digit space is small enough that an unkeyed hash would be
// trivially brute-forceable from a leaked column).
export function hashLookupValue(value: string): string {
  return crypto.createHmac("sha256", env.PII_HASH_KEY).update(value).digest("hex");
}
