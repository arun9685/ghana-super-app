import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { requireRole } from "@/middleware/roleGuard";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { topUpSchema, applyLoanSchema, loanDecisionSchema } from "@/modules/liquidity/liquidity.validation";
import * as liquidityService from "@/modules/liquidity/liquidity.service";
import type { LoanStatus } from "@prisma/client";

// "Liquidity" service tile — in-app wallet + microloans.
export const liquidityRouter = Router();

liquidityRouter.get(
  "/wallet",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const wallet = await liquidityService.getWalletWithHistory(authReq.user!.id);
    res.status(200).json({ success: true, data: wallet });
  })
);

liquidityRouter.post(
  "/wallet/topup",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = topUpSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid top-up request", parsed.error.flatten());
    const wallet = await liquidityService.topUp(authReq.user!.id, parsed.data.amountCents);
    res.status(201).json({ success: true, data: wallet });
  })
);

liquidityRouter.post(
  "/loans",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = applyLoanSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid loan application", parsed.error.flatten());
    const loan = await liquidityService.applyForLoan(authReq.user!.id, parsed.data.amountCents, parsed.data.purpose);
    res.status(201).json({ success: true, data: loan });
  })
);

liquidityRouter.get(
  "/loans",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const loans = await liquidityService.listMyLoans(authReq.user!.id);
    res.status(200).json({ success: true, data: loans });
  })
);

liquidityRouter.get(
  "/loans/all",
  requireAuth,
  requireRole("PLATFORM_ADMIN"),
  asyncHandler(async (req, res) => {
    const status = req.query.status as LoanStatus | undefined;
    const loans = await liquidityService.listAllLoans(status);
    res.status(200).json({ success: true, data: loans });
  })
);

liquidityRouter.patch(
  "/loans/:id/decision",
  requireAuth,
  requireRole("PLATFORM_ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = loanDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid decision", parsed.error.flatten());
    const loan = await liquidityService.decideLoan(req.params.id!, parsed.data.status, parsed.data.reason);
    res.status(200).json({ success: true, data: loan });
  })
);
