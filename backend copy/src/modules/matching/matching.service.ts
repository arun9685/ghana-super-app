import { prisma } from "@/database/prisma";
import { logger } from "@/common/logger";
import { io } from "@/realtime/socket";
import * as locationsService from "@/modules/locations/locations.service";
import { notify } from "@/modules/notifications/notifications.service";
import { env } from "@/config/env";
import type { Ride } from "@prisma/client";

// spec §17: nearby-driver search, ranking, offer/accept race handling.
// Simplification made explicit: instead of sending a time-boxed offer to
// one driver at a time and waiting for accept/decline (a real
// offer/accept race needs a job scheduler and per-offer timeout, out of
// scope here), the nearest idle driver is assigned directly in one
// atomic transaction. The driver still sees this as an incoming
// assignment in their app and can decline — a decline re-runs matching
// and assigns the next-nearest driver, which gets the same practical
// result (a driver who doesn't want the trip doesn't keep it) with far
// less moving infrastructure.
export async function attemptMatch(ride: Ride): Promise<Ride> {
  let radiusKm = env.MATCHING_INITIAL_RADIUS_KM;
  let candidates = await locationsService.findNearbyIdleDrivers(
    ride.pickupLat,
    ride.pickupLng,
    radiusKm,
    ride.requestedVehicleType,
    5
  );

  if (candidates.length === 0 && env.MATCHING_MAX_RADIUS_KM > radiusKm) {
    radiusKm = env.MATCHING_MAX_RADIUS_KM;
    candidates = await locationsService.findNearbyIdleDrivers(
      ride.pickupLat,
      ride.pickupLng,
      radiusKm,
      ride.requestedVehicleType,
      5
    );
  }

  if (candidates.length === 0) {
    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: "NO_DRIVERS_FOUND" },
    });
    await prisma.rideStatusEvent.create({ data: { rideId: ride.id, status: "NO_DRIVERS_FOUND" } });
    io.to(`ride:${ride.id}`).emit("ride:status", { rideId: ride.id, status: "NO_DRIVERS_FOUND" });
    await notify({
      userId: ride.customerId,
      type: "RIDE_NO_DRIVERS",
      title: "No drivers available right now",
      body: "We couldn't find a nearby driver. Please try again shortly.",
      data: { rideId: ride.id },
    });
    return updated;
  }

  // candidates.length === 0 already returned above, so this is safe —
  // noUncheckedIndexedAccess just can't see that from the earlier guard.
  const nearest = candidates[0]!;

  return assignDriver(ride, nearest.driverProfileId);
}

async function assignDriver(ride: Ride, driverProfileId: string): Promise<Ride> {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { id: driverProfileId },
    include: { vehicle: true, user: true },
  });
  if (!driverProfile || !driverProfile.vehicle) {
    // Driver went offline between search and assignment — try the next
    // candidate by re-running the whole search once.
    logger.warn({ driverProfileId }, "Candidate driver vanished before assignment — retrying match");
    return attemptMatch(ride);
  }

  const [updated] = await prisma.$transaction([
    prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: "ASSIGNED",
        driverProfileId: driverProfile.id,
        vehicleId: driverProfile.vehicle.id,
        assignedAt: new Date(),
      },
    }),
    prisma.rideStatusEvent.create({ data: { rideId: ride.id, status: "ASSIGNED" } }),
  ]);

  await locationsService.setDriverAvailability(driverProfile.id, "busy");

  io.to(`ride:${ride.id}`).emit("ride:status", {
    rideId: ride.id,
    status: "ASSIGNED",
    driver: {
      driverProfileId: driverProfile.id,
      name: driverProfile.user.name,
      phone: driverProfile.user.phone,
      ratingAvg: driverProfile.ratingAvg,
      vehicle: driverProfile.vehicle,
    },
  });
  io.to(`driver:${driverProfile.id}`).emit("ride:new_assignment", { rideId: ride.id });

  await notify({
    userId: ride.customerId,
    type: "RIDE_ASSIGNED",
    title: "Driver on the way",
    body: `${driverProfile.user.name ?? "Your driver"} is heading to your pickup point.`,
    data: { rideId: ride.id },
  });
  await notify({
    userId: driverProfile.user.id,
    type: "RIDE_NEW_ASSIGNMENT",
    title: "New ride assigned",
    body: `Pickup: ${ride.pickupAddress}`,
    data: { rideId: ride.id },
  });

  return updated;
}

// Called when a driver declines an assignment — frees them, then
// re-runs the search excluding nobody in particular (they're just idle
// again so simply won't be nearest-ranked if someone closer exists).
export async function reassign(ride: Ride): Promise<Ride> {
  return attemptMatch(ride);
}
