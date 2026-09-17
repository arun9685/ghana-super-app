import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { requireRole } from "@/middleware/roleGuard";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError, ForbiddenError, NotFoundError } from "@/common/errors";
import { pingSchema, nearbyQuerySchema } from "@/modules/locations/locations.validation";
import * as locationsService from "@/modules/locations/locations.service";
import { prisma } from "@/database/prisma";
import { io } from "@/realtime/socket";

// spec §18: live location, driver online/offline.
export const locationsRouter = Router();

async function requireApprovedDriverProfile(userId: string) {
  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId }, include: { vehicle: true } });
  if (!driverProfile) throw new NotFoundError("No driver profile — apply to drive first");
  if (driverProfile.verificationStatus !== "APPROVED") {
    throw new ForbiddenError("Your driver account is not yet approved");
  }
  if (!driverProfile.vehicle) throw new ForbiddenError("Add a vehicle before going online");
  return driverProfile;
}

locationsRouter.post(
  "/online",
  requireAuth,
  requireRole("DRIVER"),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const driverProfile = await requireApprovedDriverProfile(authReq.user!.id);
    await locationsService.setDriverOnline(driverProfile.id, driverProfile.vehicle!.type);
    res.status(200).json({ success: true, data: { online: true } });
  })
);

locationsRouter.post(
  "/offline",
  requireAuth,
  requireRole("DRIVER"),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: authReq.user!.id } });
    if (!driverProfile) throw new NotFoundError("No driver profile");
    await locationsService.setDriverOffline(driverProfile.id);
    res.status(200).json({ success: true, data: { online: false } });
  })
);

locationsRouter.post(
  "/ping",
  requireAuth,
  requireRole("DRIVER"),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = pingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid coordinates", parsed.error.flatten());

    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: authReq.user!.id } });
    if (!driverProfile) throw new NotFoundError("No driver profile");

    await locationsService.updateDriverLocation(driverProfile.id, parsed.data.lat, parsed.data.lng);

    // If this driver is mid-ride, push their position to whoever is
    // watching that ride (the customer's live tracking screen).
    const activeRide = await prisma.ride.findFirst({
      where: { driverProfileId: driverProfile.id, status: { in: ["ASSIGNED", "ARRIVED", "IN_PROGRESS"] } },
      select: { id: true },
    });
    if (activeRide) {
      io.to(`ride:${activeRide.id}`).emit("driver:location", {
        rideId: activeRide.id,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        heading: parsed.data.heading ?? null,
      });
    }

    res.status(200).json({ success: true, data: { received: true } });
  })
);

locationsRouter.get(
  "/nearby",
  asyncHandler(async (req, res) => {
    const parsed = nearbyQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid query", parsed.error.flatten());

    const drivers = await locationsService.findNearbyIdleDrivers(
      parsed.data.lat,
      parsed.data.lng,
      6,
      parsed.data.vehicleType,
      20
    );
    // Public-facing: only expose a count + rough ETA, never raw driver
    // positions — that's a privacy/safety leak (a customer app should
    // never be able to track drivers who aren't assigned to them).
    const nearest = drivers[0];
    const nearestEtaMin = nearest ? Math.max(1, Math.round((nearest.distanceKm / 30) * 60)) : null;
    res.status(200).json({ success: true, data: { driversNearby: drivers.length, nearestEtaMin } });
  })
);
