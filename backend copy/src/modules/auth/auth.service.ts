import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/database/prisma";
import { redis } from "@/database/redis";
import { env } from "@/config/env";
import { hashLookupValue } from "@/common/crypto/piiEncryption";
import { getSmsProvider } from "@/modules/auth/otp.provider";
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken, signAccessToken } from "@/modules/auth/jwt.service";
import { TooManyRequestsError, UnauthorizedError, ValidationError } from "@/common/errors";
import { logger } from "@/common/logger";

const smsProvider = getSmsProvider();

function generateOtp(): string {
  const max = 10 ** env.OTP_LENGTH;
  const code = crypto.randomInt(0, max).toString().padStart(env.OTP_LENGTH, "0");
  return code;
}

function normalizePhone(phone: string): string {
  // Accepts Ghana local format (0XXXXXXXXX) — normalize to a consistent
  // stored format. Extend this if/when the platform supports other
  // countries; keep the normalization in one place either way.
  const digits = phone.replace(/\D/g, "");
  if (!/^0\d{9}$/.test(digits)) {
    throw new ValidationError("Enter a valid 10-digit Ghana phone number, e.g. 0244123456");
  }
  return digits;
}

// spec §13 flow, step 1: "Backend requests OTP → SMS provider".
export async function requestOtp(rawPhone: string): Promise<{ userId: string }> {
  const phone = normalizePhone(rawPhone);

  // Cheap abuse guard on top of the route-level rate limiter — spec §44
  // ("OTP abuse detection") wants this checked at more than one layer.
  const cooldownKey = `otp:cooldown:${phone}`;
  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) {
    throw new TooManyRequestsError("Please wait before requesting another code");
  }

  // Looked up by the deterministic blind index, not `phone` itself — see
  // database/prisma.ts's PII-encryption extension for why: `phone` is
  // encrypted at rest with a random IV per write, so it can never be an
  // equality-lookup key. The extension still handles encrypting the
  // plaintext `phone` passed into `create` below and computing its hash —
  // callers just pass plaintext in, the ciphertext/hash split is internal.
  const user = await prisma.user.upsert({
    where: { phoneHash: hashLookupValue(phone) },
    update: {},
    // `phoneHash` is passed explicitly (not left for the extension to
    // infer) so this compiles against Prisma's generated types, which
    // don't know about the runtime encryption extension and still
    // require every non-optional column — the extension recomputes it
    // from `phone` anyway as a consistency safety net, so this can never
    // drift from the encrypted value actually stored.
    create: { phone, phoneHash: hashLookupValue(phone), roles: { create: { role: "CUSTOMER" } } },
  });

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MIN * 60 * 1000);

  await prisma.otpCode.create({ data: { userId: user.id, codeHash, expiresAt } });
  await redis.set(cooldownKey, "1", "EX", 60); // 60s between requests

  await smsProvider.sendOtp(phone, code);
  logger.info({ userId: user.id }, "OTP requested");

  return { userId: user.id };
}

// spec §13 flow, remaining steps: "User enters OTP → Backend validates →
// Access Token + Refresh Token → Authenticated".
export async function verifyOtp(
  rawPhone: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; phone: string; roles: string[] } }> {
  const phone = normalizePhone(rawPhone);

  const user = await prisma.user.findUnique({
    where: { phoneHash: hashLookupValue(phone) },
    include: { roles: true },
  });
  if (!user) {
    throw new UnauthorizedError("No account found for this number — request a code first");
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otpRecord) {
    throw new UnauthorizedError("Code has expired — request a new one");
  }

  if (otpRecord.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new TooManyRequestsError("Too many incorrect attempts — request a new code");
  }

  const isValid = await bcrypt.compare(code, otpRecord.codeHash);
  if (!isValid) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    throw new UnauthorizedError("Incorrect code");
  }

  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otpRecord.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { isPhoneVerified: true } }),
  ]);

  const roles = user.roles.map((r) => r.role);
  const accessToken = signAccessToken(user.id, roles);
  const refreshToken = await issueRefreshToken(user.id);

  logger.info({ userId: user.id }, "OTP verified — session issued");

  return { accessToken, refreshToken, user: { id: user.id, phone: user.phone, roles } };
}

export async function refreshSession(
  rawRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const rotated = await rotateRefreshToken(rawRefreshToken);
  if (!rotated) {
    throw new UnauthorizedError("Session expired — please log in again");
  }

  const user = await prisma.user.findUnique({
    where: { id: rotated.userId },
    include: { roles: true },
  });
  if (!user) {
    throw new UnauthorizedError("Account no longer exists");
  }

  const accessToken = signAccessToken(user.id, user.roles.map((r) => r.role));
  return { accessToken, refreshToken: rotated.newRefreshToken };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  await revokeRefreshToken(rawRefreshToken);
}
