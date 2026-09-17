import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "@/main";
import { prisma } from "@/database/prisma";
import { redis } from "@/database/redis";
import { getLastOtpForTesting } from "@/modules/auth/otp.provider";
import { hashLookupValue } from "@/common/crypto/piiEncryption";

// This is the "Critical End-to-End Test" opening sequence from spec §51:
// Create Customer → OTP → Verify → JWT → Authenticated. Subsequent sprints
// extend this same test file's setup pattern for the ride lifecycle.
//
// Requires a running Postgres + Redis (docker compose up) and
// DATABASE_URL / REDIS_URL pointed at them — this is an integration test,
// not a unit test, per spec §50's distinction between the two. Also
// requires SMS_PROVIDER=console (the .env.example / CI default) so
// getLastOtpForTesting can read the code back out.

const TEST_PHONE = "0201234567";

describe("Auth flow (spec §13, §36)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  beforeEach(async () => {
    await prisma.otpCode.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.userRole.deleteMany({});
    // `phone` is encrypted at rest (random IV per write), so it can't be
    // filtered on directly anymore — same reason auth.service.ts looks
    // users up by phoneHash instead of phone. See database/prisma.ts.
    await prisma.user.deleteMany({ where: { phoneHash: hashLookupValue(TEST_PHONE) } });
    await redis.flushdb();
  });

  it("rejects an invalid phone number on request-otp", async () => {
    const res = await request(app).post("/api/v1/auth/request-otp").send({ phone: "123" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects verify-otp with no prior request", async () => {
    const res = await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({ phone: TEST_PHONE, otp: "000000" });
    expect(res.status).toBe(401);
  });

  it("rejects an incorrect OTP", async () => {
    await request(app).post("/api/v1/auth/request-otp").send({ phone: TEST_PHONE });
    const res = await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({ phone: TEST_PHONE, otp: "000000" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("full happy path: request → verify → access /users/me → refresh → logout", async () => {
    await request(app).post("/api/v1/auth/request-otp").send({ phone: TEST_PHONE });

    const code = getLastOtpForTesting(TEST_PHONE);
    expect(code).toBeTruthy();

    const verifyRes = await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({ phone: TEST_PHONE, otp: code });
    expect(verifyRes.status).toBe(200);
    const { accessToken, refreshToken } = verifyRes.body.data;
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const meRes = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.phone).toBe(TEST_PHONE);
    expect(meRes.body.data.roles).toContain("CUSTOMER");

    // Refresh rotation: the old refresh token must stop working once used.
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    const newRefreshToken = refreshRes.body.data.refreshToken;
    expect(newRefreshToken).not.toBe(refreshToken);

    const replayRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken }); // reusing the now-rotated-out token
    expect(replayRes.status).toBe(401);

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken: newRefreshToken });
    expect(logoutRes.status).toBe(200);

    const postLogoutRefresh = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: newRefreshToken });
    expect(postLogoutRefresh.status).toBe(401);
  });

  it("rejects /users/me without a token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
  });
});
