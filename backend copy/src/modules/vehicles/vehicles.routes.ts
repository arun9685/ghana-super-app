import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { requireRole } from "@/middleware/roleGuard";
import { asyncHandler } from "@/common/asyncHandler";
import { NotFoundError, ValidationError } from "@/common/errors";
import { vehicleSchema } from "@/modules/vehicles/vehicles.validation";
import * as vehiclesService from "@/modules/vehicles/vehicles.service";
import { prisma } from "@/database/prisma";

// spec §29.
export const vehiclesRouter = Router();

vehiclesRouter.get(
  "/me",
  requireAuth,
  requireRole("DRIVER"),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: authReq.user!.id } });
    if (!driverProfile) throw new NotFoundError("No driver profile");
    const vehicle = await vehiclesService.getVehicleForDriver(driverProfile.id);
    res.status(200).json({ success: true, data: vehicle });
  })
);

vehiclesRouter.put(
  "/me",
  requireAuth,
  requireRole("DRIVER"),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = vehicleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid vehicle details", parsed.error.flatten());

    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: authReq.user!.id } });
    if (!driverProfile) throw new NotFoundError("No driver profile — apply to drive first");

    const vehicle = await vehiclesService.upsertVehicleForDriver(driverProfile.id, parsed.data);
    res.status(200).json({ success: true, data: vehicle });
  })
);
