import { prisma } from "@/database/prisma";
import { getUtilityProvider } from "@/modules/utilities/utility.provider";
import { notify } from "@/modules/notifications/notifications.service";
import type { UtilityType } from "@prisma/client";

const provider = getUtilityProvider();

export async function payUtility(userId: string, type: UtilityType, providerName: string, accountRef: string, amountCents: number) {
  const payment = await prisma.utilityPayment.create({
    data: { userId, type, provider: providerName, accountRef, amountCents, status: "PENDING" },
  });

  const result = await provider.pay(providerName, accountRef, amountCents);

  const updated = await prisma.utilityPayment.update({
    where: { id: payment.id },
    data: { status: result.success ? "SUCCESS" : "FAILED", providerRef: result.providerRef },
  });

  await notify({
    userId,
    type: "UTILITY_PAYMENT",
    title: result.success ? "Payment successful" : "Payment failed",
    body: `${type} top-up of GHS ${(amountCents / 100).toFixed(2)} to ${accountRef} ${result.success ? "succeeded" : "failed"}.`,
    data: { paymentId: payment.id },
  });

  return updated;
}

export async function listMyUtilityPayments(userId: string) {
  return prisma.utilityPayment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
}
