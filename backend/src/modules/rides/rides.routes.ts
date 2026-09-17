import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { NotFoundError, ValidationError } from "@/common/errors";
import { cancelRideSchema, createRideSchema, estimateSchema } from "@/modules/rides/rides.validation";
import * as ridesService from "@/modules/rides/rides.service";
import { prisma } from "@/database/prisma";

// spec §36 base path is /api/v1, mounted as /rides in main.ts.
export const ridesRouter = Router();

ridesRouter.post(
  "/estimate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = estimateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid estimate request", parsed.error.flatten());

    const estimate = await ridesService.estimateRide(parsed.data.pickup, parsed.data.dropoff, parsed.data.vehicleType);
    res.status(200).json({ success: true, data: estimate });
  })
);

ridesRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createRideSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid ride request", parsed.error.flatten());

    const ride = await ridesService.createRide(
      authReq.user!.id,
      parsed.data.pickup,
      parsed.data.dropoff,
      parsed.data.vehicleType,
      parsed.data.paymentMethod
    );
    res.status(201).json({ success: true, data: ride });
  })
);

ridesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const active = req.query.status !== "history";
    const asDriver = req.query.as === "driver";

    const rides = asDriver
      ? await ridesService.listMyRidesAsDriver(authReq.user!.id, active)
      : await ridesService.listMyRidesAsCustomer(authReq.user!.id, active);

    res.status(200).json({ success: true, data: rides });
  })
);

ridesRouter.get(
  "/active-for-driver",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: authReq.user!.id } });
    if (!driverProfile) throw new NotFoundError("No driver profile");
    const ride = await prisma.ride.findFirst({
      where: { driverProfileId: driverProfile.id, status: { in: ["ASSIGNED", "ARRIVED", "IN_PROGRESS"] } },
      include: { customer: { select: { name: true, phone: true } } },
    });
    res.status(200).json({ success: true, data: ride });
  })
);

ridesRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ride = await ridesService.getRide(authReq.user!.id, authReq.user!.roles, req.params.id!);
    res.status(200).json({ success: true, data: ride });
  })
);

ridesRouter.post(
  "/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = cancelRideSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());

    const ride = await ridesService.cancelRide(authReq.user!.id, authReq.user!.roles, req.params.id!, parsed.data.reason);
    res.status(200).json({ success: true, data: ride });
  })
);

ridesRouter.post(
  "/:id/arrived",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ride = await ridesService.markArrived(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: ride });
  })
);

ridesRouter.post(
  "/:id/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ride = await ridesService.startRide(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: ride });
  })
);

ridesRouter.post(
  "/:id/complete",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const result = await ridesService.completeRide(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: result });
  })
);
