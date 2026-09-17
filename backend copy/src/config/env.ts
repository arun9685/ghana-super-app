import "dotenv/config";
import { z } from "zod";

// Fail fast on boot if required config is missing, rather than failing
// confusingly deep inside a request handler at 2am (spec §37: error handling
// is a required property of every endpoint, and that starts with config).
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL_MIN: z.coerce.number().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),

  OTP_TTL_MIN: z.coerce.number().default(5),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),

  SMS_PROVIDER: z.enum(["console", "twilio", "hubtel", "africastalking"]).default("console"),
  SMS_PROVIDER_API_KEY: z.string().optional(),
  SMS_PROVIDER_SENDER_ID: z.string().default("GhanaSuperApp"),

  // Signs/verifies the payment gateway webhook (payments.routes.ts's
  // POST /payments/webhook) — the same shared-secret HMAC scheme MoMo/
  // Paystack/Flutterwave use for callback authenticity. A real gateway
  // integration replaces the *provider* (payment.provider.ts) but keeps
  // this secret and the signature check as-is.
  PAYMENT_WEBHOOK_SECRET: z.string().min(16, "PAYMENT_WEBHOOK_SECRET must be at least 16 characters"),

  // Field-level encryption for PII at rest (User.phone/name/email) — see
  // src/common/crypto/piiEncryption.ts and the Prisma client extension in
  // src/database/prisma.ts that applies it transparently on every read/write.
  PII_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "PII_ENCRYPTION_KEY must be 64 hex characters (32 bytes) — generate with `openssl rand -hex 32`"),
  PII_HASH_KEY: z.string().min(16, "PII_HASH_KEY must be at least 16 characters"),

  RATE_LIMIT_WINDOW_MIN: z.coerce.number().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // spec §17: nearby-driver search radius. Starts tight, widens once if
  // nothing is found, rather than a single very wide (slow, low-quality)
  // search.
  MATCHING_INITIAL_RADIUS_KM: z.coerce.number().default(3),
  MATCHING_MAX_RADIUS_KM: z.coerce.number().default(8),

  CORS_ORIGIN: z.string().default("*"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
