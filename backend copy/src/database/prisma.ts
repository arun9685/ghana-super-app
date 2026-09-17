import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";
import { encryptPII, decryptPII, hashLookupValue } from "@/common/crypto/piiEncryption";

// A single shared Prisma client per process — creating a new one per
// request exhausts the Postgres connection pool under load (this is the
// #1 cause of "works locally, falls over at 50 concurrent users").
const basePrisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// ---------------------------------------------------------------------
// Transparent field-level encryption for User.phone/name/email.
//
// Every other module in this codebase reads `user.phone` / `user.name` /
// `user.email` as plain strings — directly, or nested through relations
// (ride.customer.phone, driverProfile.user.name, artisan.user.phone, and
// so on across eat/fix/fleet/property). Rather than touch every one of
// those call sites, this extension does the encryption/decryption once,
// here, transparently:
//   - `result.user`: whenever a User record comes back from ANY query —
//     top-level or nested via include/select on another model — decrypt
//     phone/name/email before the application ever sees them.
//   - `query.user`: whenever a User record is created or updated, encrypt
//     those same fields (and compute `phoneHash`, the deterministic blind
//     index) before the write hits Postgres.
//
// The one thing this does NOT make transparent is looking a user up BY
// phone number: since AES-GCM ciphertext differs every time (random IV),
// `where: { phone: "..." }` can no longer match anything. Call sites that
// need that (auth.service.ts, prisma/seed.ts) look up by `phoneHash`
// instead — see piiEncryption.ts's hashLookupValue.
// ---------------------------------------------------------------------

type UserWritableData = {
  phone?: string;
  phoneHash?: string;
  name?: string | null;
  email?: string | null;
};

function encryptUserWriteData<T extends UserWritableData>(data: T): T {
  const next = { ...data };
  if (typeof next.phone === "string") {
    // Compute the blind index from the PLAINTEXT phone before encrypting
    // it — order matters, encrypting first would hash the ciphertext instead.
    next.phoneHash = hashLookupValue(next.phone);
    next.phone = encryptPII(next.phone);
  }
  if (typeof next.name === "string") {
    next.name = encryptPII(next.name);
  }
  if (typeof next.email === "string") {
    next.email = encryptPII(next.email);
  }
  return next;
}

export const prisma = basePrisma.$extends({
  name: "pii-encryption",
  query: {
    user: {
      create({ args, query }) {
        args.data = encryptUserWriteData(args.data as unknown as UserWritableData) as unknown as typeof args.data;
        return query(args);
      },
      update({ args, query }) {
        args.data = encryptUserWriteData(args.data as unknown as UserWritableData) as unknown as typeof args.data;
        return query(args);
      },
      updateMany({ args, query }) {
        args.data = encryptUserWriteData(args.data as unknown as UserWritableData) as unknown as typeof args.data;
        return query(args);
      },
      upsert({ args, query }) {
        args.create = encryptUserWriteData(args.create as unknown as UserWritableData) as unknown as typeof args.create;
        args.update = encryptUserWriteData(args.update as unknown as UserWritableData) as unknown as typeof args.update;
        return query(args);
      },
      // createMany deliberately not covered — nothing in this codebase
      // bulk-creates users today. Add the same encryptUserWriteData
      // mapping over args.data if that ever changes.
    },
  },
  result: {
    user: {
      phone: {
        needs: { phone: true },
        compute(user) {
          return decryptPII(user.phone);
        },
      },
      name: {
        needs: { name: true },
        compute(user) {
          return user.name != null ? decryptPII(user.name) : user.name;
        },
      },
      email: {
        needs: { email: true },
        compute(user) {
          return user.email != null ? decryptPII(user.email) : user.email;
        },
      },
    },
  },
});

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
