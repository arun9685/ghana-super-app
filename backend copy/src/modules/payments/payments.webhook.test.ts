import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "@/main";
import { prisma } from "@/database/prisma";
import { redis } from "@/database/redis";
import { computeWebhookSignature } from "@/modules/payments/webhookSignature";
import { hashLookupValue } from "@/common/crypto/piiEncryption";
import { env } from "@/config/env";

// Security-review follow-up: proves the fraud fix actually holds —
// a customer's JWT alone can no longer move a payment to PAID (the old
// POST /:id/confirm no longer exists at all), and the new webhook route
// only accepts a request whose HMAC signature matches PAYMENT_WEBHOOK_SECRET.
const TEST_PHONE = "0209998888";

describe("Payments webhook (fraud-fix follow-up)", () => {
  let userId: string;
  let paymentId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  beforeEach(async () => {
    // phone is encrypted at rest (random IV per write) — filter by
    // phoneHash, same as auth.service.ts's lookups. See database/prisma.ts.
    const testPhoneHash = hashLookupValue(TEST_PHONE);
    await prisma.payment.deleteMany({});
    await prisma.ride.deleteMany({ where: { customer: { phoneHash: testPhoneHash } } });
    await prisma.user.deleteMany({ where: { phoneHash: testPhoneHash } });

    const user = await prisma.user.create({
      data: { phone: TEST_PHONE, phoneHash: testPhoneHash, name: "Webhook Test", isPhoneVerified: true },
    });
    userId = user.id;

    const ride = await prisma.ride.create({
      data: {
        customerId: userId,
        status: "COMPLETED",
        pickupLat: 5.6,
        pickupLng: -0.19,
        pickupAddress: "Test pickup",
        dropoffLat: 5.61,
        dropoffLng: -0.2,
        dropoffAddress: "Test dropoff",
        estimatedFareCents: 2000,
        finalFareCents: 2000,
        paymentMethod: "MOMO",
      },
    });

    const payment = await prisma.payment.create({
      data: { rideId: ride.id, amountCents: 2000, method: "MOMO", status: "PENDING", providerRef: "MOCK-GW-initial" },
    });
    paymentId = payment.id;
  });

  it("the old customer self-confirm endpoint no longer exists", async () => {
    const res = await request(app).post(`/api/v1/payments/${paymentId}/confirm`);
    expect(res.status).toBe(404);
  });

  it("rejects a webhook call with no signature", async () => {
    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .send({ paymentId, providerRef: "FORGED-1", status: "PAID" });
    expect(res.status).toBe(401);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("PENDING");
  });

  it("rejects a webhook call with a forged signature", async () => {
    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .set("X-Signature", "0".repeat(64))
      .send({ paymentId, providerRef: "FORGED-2", status: "PAID" });
    expect(res.status).toBe(401);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("PENDING");
  });

  it("accepts a correctly-signed webhook and marks the payment PAID exactly once", async () => {
    const payload = { paymentId, providerRef: "REAL-GW-1", status: "PAID" as const };
    // supertest/superagent serializes an object body with JSON.stringify
    // under the hood, so signing that same serialization here matches
    // exactly what the server receives as its raw body.
    const signature = computeWebhookSignature(JSON.stringify(payload), env.PAYMENT_WEBHOOK_SECRET);

    const res = await request(app).post("/api/v1/payments/webhook").set("X-Signature", signature).send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PAID");

    const auditEntries = await prisma.auditLog.findMany({ where: { entityId: paymentId } });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]!.action).toBe("PAYMENT_CONFIRMED");

    // Re-delivery of the same webhook (gateways retry) must not double-notify
    // or flip state — it's a no-op once already resolved.
    const retry = await request(app).post("/api/v1/payments/webhook").set("X-Signature", signature).send(payload);
    expect(retry.status).toBe(200);

    const auditEntriesAfterRetry = await prisma.auditLog.findMany({ where: { entityId: paymentId } });
    expect(auditEntriesAfterRetry).toHaveLength(1);
  });

  it("marks the payment FAILED on a signed failure callback", async () => {
    const payload = { paymentId, providerRef: "REAL-GW-2", status: "FAILED" as const, failureReason: "Insufficient funds" };
    const signature = computeWebhookSignature(JSON.stringify(payload), env.PAYMENT_WEBHOOK_SECRET);

    const res = await request(app).post("/api/v1/payments/webhook").set("X-Signature", signature).send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("FAILED");
    expect(res.body.data.failureReason).toBe("Insufficient funds");
  });
});
