import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { payUtilitySchema } from "@/modules/utilities/utilities.validation";
import * as utilitiesService from "@/modules/utilities/utilities.service";

// "Utilities" service tile — airtime, data, and bill top-ups.
export const utilitiesRouter = Router();

utilitiesRouter.post(
  "/pay",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = payUtilitySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());
    const payment = await utilitiesService.payUtility(
      authReq.user!.id,
      parsed.data.type,
      parsed.data.provider,
      parsed.data.accountRef,
      parsed.data.amountCents
    );
    res.status(201).json({ success: true, data: payment });
  })
);

utilitiesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payments = await utilitiesService.listMyUtilityPayments(authReq.user!.id);
    res.status(200).json({ success: true, data: payments });
  })
);
