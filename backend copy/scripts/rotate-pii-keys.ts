// Key-rotation follow-up (technical readiness checklist, P0 #3): before
// this script existed, there was no way to rotate PII_ENCRYPTION_KEY or
// PII_HASH_KEY without losing every encrypted phone/name/email in the
// User table — the Prisma client extension (src/database/prisma.ts) only
// ever reads/writes with whatever key is in the CURRENT environment, so
// simply changing the env var would leave every existing row
// undecryptable garbage.
//
// What this does: for every User row, decrypt phone/name/email with the
// OLD key, re-encrypt with the NEW key, recompute phoneHash with the NEW
// hash key, and write all four columns back — using a plain, UN-extended
// PrismaClient so this script controls both keys explicitly rather than
// going through the extension (which only knows one key: whatever is in
// process.env right now).
//
// This has NOT been run against a live database from this sandbox (no
// Postgres is reachable here) — read it carefully and dry-run it (see
// --dry-run below) against a staging copy before ever pointing it at
// production.
//
// Usage:
//   PII_ENCRYPTION_KEY_OLD=<old 64-hex key> \
//   PII_HASH_KEY_OLD=<old hash key> \
//   PII_ENCRYPTION_KEY=<new 64-hex key> \
//   PII_HASH_KEY=<new hash key> \
//   npm run rotate:pii-keys -- --dry-run     # prints what would change, writes nothing
//   npm run rotate:pii-keys -- --batch-size=200
//
// Rollout: this only touches the User table's own columns, in place —
// take an RDS snapshot first (see docs/runbooks/backup-restore.md), then:
//   1. Deploy this script's image/commit with BOTH old and new keys set.
//   2. Run it once, off-peak, with --dry-run first, then for real.
//   3. Update the running task's PII_ENCRYPTION_KEY/PII_HASH_KEY secrets
//      (Secrets Manager) to the NEW values only, and redeploy — the app
//      itself only ever needs one key at a time.
//   4. Only after confirming the app reads normally on the new key,
//      destroy the old key value everywhere it was staged (shell history,
//      CI logs, local .env files).
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Deliberately re-implemented here rather than imported from
// src/common/crypto/piiEncryption.ts: that module always reads the key
// from `env.PII_ENCRYPTION_KEY` (one key, the current one); this script
// needs to operate with TWO keys (old + new) side by side, so it takes
// the key as an explicit argument instead. The algorithm/format must stay
// identical to piiEncryption.ts — if that file's format ever changes,
// mirror the change here too.
function keyFromHex(hex: string, label: string): Buffer {
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(`${label} must be 64 hex characters (32 bytes) for AES-256`);
  }
  return key;
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

function decryptWithKey(stored: string, key: Buffer): string {
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function hashWithKey(value: string, hashKey: string): string {
  return crypto.createHmac("sha256", hashKey).update(value).digest("hex");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} — see this script's header comment for usage.`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchSizeArg ? Number(batchSizeArg.split("=")[1]) : 200;

  const oldKey = keyFromHex(requireEnv("PII_ENCRYPTION_KEY_OLD"), "PII_ENCRYPTION_KEY_OLD");
  const oldHashKey = requireEnv("PII_HASH_KEY_OLD");
  const newKey = keyFromHex(requireEnv("PII_ENCRYPTION_KEY"), "PII_ENCRYPTION_KEY");
  const newHashKey = requireEnv("PII_HASH_KEY");

  if (oldKey.equals(newKey)) {
    throw new Error("PII_ENCRYPTION_KEY_OLD and PII_ENCRYPTION_KEY are identical — nothing to rotate.");
  }

  // Deliberately a plain, un-extended client: the pii-encryption extension
  // in src/database/prisma.ts would try to decrypt with whatever is in
  // process.env.PII_ENCRYPTION_KEY right now, which conflicts with this
  // script needing to read raw ciphertext and handle both keys itself.
  const rawPrisma = new PrismaClient();

  let processed = 0;
  let rotated = 0;
  let cursor: string | undefined;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const users = await rawPrisma.user.findMany({
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });
      if (users.length === 0) break;

      for (const user of users) {
        processed += 1;
        const plainPhone = decryptWithKey(user.phone, oldKey);
        const plainName = user.name != null ? decryptWithKey(user.name, oldKey) : null;
        const plainEmail = user.email != null ? decryptWithKey(user.email, oldKey) : null;

        const nextPhone = encryptWithKey(plainPhone, newKey);
        const nextName = plainName != null ? encryptWithKey(plainName, newKey) : null;
        const nextEmail = plainEmail != null ? encryptWithKey(plainEmail, newKey) : null;
        const nextPhoneHash = hashWithKey(plainPhone, newHashKey);

        if (dryRun) {
          console.log(`[dry-run] would rotate user ${user.id} (phoneHash ${user.phoneHash} -> ${nextPhoneHash})`);
        } else {
          await rawPrisma.user.update({
            where: { id: user.id },
            data: {
              phone: nextPhone,
              phoneHash: nextPhoneHash,
              name: nextName,
              email: nextEmail,
            },
          });
        }
        rotated += 1;
      }

      cursor = users[users.length - 1]!.id;
      console.log(`Processed ${processed} users so far${dryRun ? " (dry-run, no writes)" : ""}...`);
    }

    console.log(`Done. ${rotated} user rows ${dryRun ? "would be" : "were"} rotated to the new key.`);
    if (dryRun) {
      console.log("Re-run without --dry-run to apply.");
    }
  } finally {
    await rawPrisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Key rotation failed:", err);
  process.exit(1);
});
