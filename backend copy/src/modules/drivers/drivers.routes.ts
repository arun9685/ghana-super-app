import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { applySchema } from "@/modules/drivers/drivers.validation";
import * as driversService from "@/modules/drivers/drivers.service";

// spec §28.
export const driversRouter = Router();

driversRouter.post(
  "/apply",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid application", parsed.error.flatten());

    const driverProfile = await driversService.applyToDrive(
      authReq.user!.id,
      parsed.data.licenseNumber,
      parsed.data.vehicle
    );
    res.status(200).json({ success: true, data: driverProfile });
  })
);

driversRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const driverProfile = await driversService.getFullDriverProfile(authReq.user!.id);
    res.status(200).json({ success: true, data: driverProfile });
  })
);
