import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import { env } from "@/config/env";
import { prisma } from "@/database/prisma";

export interface AccessTokenPayload {
  sub: string; // userId
  roles: string[];
  jti: string;
}

function hashToken(token: string): string {
  // Refresh tokens are bearer secrets — store a hash, never the raw value,
  // same principle as a password (spec §41).
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(userId: string, roles: string[]): string {
  const payload: AccessTokenPayload = { sub: userId, roles, jti: uuid() };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: `${env.JWT_ACCESS_TTL_MIN}m` });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return raw;
}

// Refresh-token rotation (spec §41): every use invalidates the old token
// and issues a new one. If a stolen token is replayed after the legitimate
// user has already rotated it, the replay fails and we can detect theft.
export async function rotateRefreshToken(
  rawToken: string
): Promise<{ userId: string; newRefreshToken: string } | null> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const newRefreshToken = await issueRefreshToken(existing.userId);
  return { userId: existing.userId, newRefreshToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
