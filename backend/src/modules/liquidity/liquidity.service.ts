import { prisma } from "@/database/prisma";
import { notify } from "@/modules/notifications/notifications.service";
import { NotFoundError, ConflictError } from "@/common/errors";
import type { LoanStatus } from "@prisma/client";

// spec's "Liquidity" tile: a simple in-app wallet (top-up, balance,
// transaction history) plus loan applications. Real balances are moved
// only through WalletTransaction rows created in a transaction alongside
// the balance update, so balanceCents can never drift from its ledger.
export async function getOrCreateWallet(userId: string) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wallet.create({ data: { userId } });
}

export async function topUp(userId: string, amountCents: number) {
  const wallet = await getOrCreateWallet(userId);
  const balanceAfter = wallet.balanceCents + amountCents;

  const [updated] = await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: balanceAfter } }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "TOPUP",
        amountCents,
        balanceAfterCents: balanceAfter,
        note: "Wallet top-up",
      },
    }),
  ]);

  await notify({
    userId,
    type: "WALLET_TOPUP",
    title: "Wallet topped up",
    body: `GHS ${(amountCents / 100).toFixed(2)} added to your wallet. New balance: GHS ${(balanceAfter / 100).toFixed(2)}.`,
  });

  return updated;
}

export async function getWalletWithHistory(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { ...wallet, transactions };
}

export async function applyForLoan(userId: string, amountCents: number, purpose?: string) {
  return prisma.loanApplication.create({
    data: { userId, amountCents, purpose, status: "PENDING" },
  });
}

export async function listMyLoans(userId: string) {
  return prisma.loanApplication.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function listAllLoans(status?: LoanStatus) {
  return prisma.loanApplication.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
}

// Admin-only decision. On APPROVED, the loan is immediately disbursed
// into the applicant's wallet (spec's simplification: no separate
// disbursement step / repayment schedule engine — see loan.provider.ts
// for where automated underwriting slots in later).
export async function decideLoan(loanId: string, status: "APPROVED" | "REJECTED", reason?: string) {
  const loan = await prisma.loanApplication.findUnique({ where: { id: loanId } });
  if (!loan) throw new NotFoundError("Loan application not found");
  if (loan.status !== "PENDING") throw new ConflictError("This application has already been decided");

  if (status === "REJECTED") {
    const updated = await prisma.loanApplication.update({
      where: { id: loanId },
      data: { status: "REJECTED", decisionReason: reason, decidedAt: new Date() },
    });
    await notify({
      userId: loan.userId,
      type: "LOAN_DECISION",
      title: "Loan application update",
      body: `Your loan application was not approved. ${reason ?? ""}`.trim(),
    });
    return updated;
  }

  const wallet = await getOrCreateWallet(loan.userId);
  const balanceAfter = wallet.balanceCents + loan.amountCents;

  const [updatedLoan] = await prisma.$transaction([
    prisma.loanApplication.update({
      where: { id: loanId },
      data: { status: "DISBURSED", decisionReason: reason, decidedAt: new Date() },
    }),
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: balanceAfter } }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "TRANSFER_IN",
        amountCents: loan.amountCents,
        balanceAfterCents: balanceAfter,
        note: `Loan disbursement (${loanId})`,
      },
    }),
  ]);

  await notify({
    userId: loan.userId,
    type: "LOAN_DECISION",
    title: "Loan approved and disbursed",
    body: `GHS ${(loan.amountCents / 100).toFixed(2)} has been added to your wallet.`,
  });

  return updatedLoan;
}
