import { prisma } from "@/database/prisma";
import { ForbiddenError, NotFoundError } from "@/common/errors";
import { getPaymentProvider } from "@/modules/payments/payment.provider";
import { notify } from "@/modules/notifications/notifications.service";
import { recordAuditLog } from "@/common/auditLog";
import type { GatewayWebhookInput } from "@/modules/payments/payments.validation";
import type { PaymentMethod } from "@prisma/client";

// spec §23-25: payments + ledger. Called once by rides.service.ts when a
// ride is completed — this module never initiates a charge on its own.
export async function createPaymentForRide(rideId: string, amountCents: number, method: PaymentMethod, currency: string) {
  const payment = await prisma.payment.create({
    data: { rideId, amountCents, method, currency, status: "PENDING" },
  });

  const provider = getPaymentProvider(method);
  const { confirmedImmediately, providerRef } = await provider.charge(payment.id, amountCents);

  if (confirmedImmediately) {
    return prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", providerRef, paidAt: new Date() },
    });
  }

  return prisma.payment.update({ where: { id: payment.id }, data: { providerRef } });
}

export async function getPayment(userId: string, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { ride: { select: { customerId: true, driverProfile: { select: { userId: true } } } } },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  const isOwner = payment.ride.customerId === userId || payment.ride.driverProfile?.userId === userId;
  if (!isOwner) throw new ForbiddenError("You cannot view this payment");

  return payment;
}

export async function listMyPayments(userId: string) {
  return prisma.payment.findMany({
    where: { ride: { customerId: userId } },
    include: { ride: { select: { pickupAddress: true, dropoffAddress: true, completedAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// The real gateway webhook (spec §24). Called by MTN MoMo / the card
// processor (or, locally, scripts/simulate-gateway-webhook.ts) with a
// signed payload — payments.routes.ts verifies the HMAC signature *before*
// this function ever runs, so by the time we're here the caller has proven
// it knows PAYMENT_WEBHOOK_SECRET, not just that it's an authenticated
// customer. This replaces the earlier design where a customer's own JWT
// was enough to mark their own payment PAID — a straightforward "pay
// nothing, mark it paid" fraud path — with something a customer cannot
// trigger on their own.
export async function processGatewayWebhook(input: GatewayWebhookInput, meta: { ipAddress?: string | null }) {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: { ride: { select: { customerId: true } } },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  // Idempotent: a gateway may retry a webhook delivery (at-least-once
  // delivery is the norm for these APIs). Once we've already resolved this
  // payment, re-processing the same callback is a no-op, not an error —
  // and definitely not a second "payment confirmed" notification.
  if (payment.status !== "PENDING") {
    return payment;
  }

  const updated = await prisma.payment.update({
    where: { id: input.paymentId },
    data:
      input.status === "PAID"
        ? { status: "PAID", providerRef: input.providerRef, paidAt: new Date() }
        : { status: "FAILED", providerRef: input.providerRef, failureReason: input.failureReason ?? "Payment declined by provider" },
  });

  await recordAuditLog({
    actorType: "WEBHOOK",
    action: input.status === "PAID" ? "PAYMENT_CONFIRMED" : "PAYMENT_FAILED",
    entityType: "Payment",
    entityId: payment.id,
    metadata: { providerRef: input.providerRef, amountCents: payment.amountCents, failureReason: input.failureReason },
    ipAddress: meta.ipAddress,
  });

  if (input.status === "PAID") {
    await notify({
      userId: payment.ride.customerId,
      type: "PAYMENT_CONFIRMED",
      title: "Payment received",
      body: `Your payment of GHS ${(payment.amountCents / 100).toFixed(2)} was successful.`,
    });
  } else {
    await notify({
      userId: payment.ride.customerId,
      type: "PAYMENT_FAILED",
      title: "Payment failed",
      body: `Your payment of GHS ${(payment.amountCents / 100).toFixed(2)} could not be completed. Please try again.`,
    });
  }

  return updated;
}
