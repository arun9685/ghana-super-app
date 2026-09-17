import { prisma } from "@/database/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/common/errors";
import { estimateDurationMin, estimateRoadDistanceKm } from "@/common/geo";
import * as pricingService from "@/modules/pricing/pricing.service";
import * as matchingService from "@/modules/matching/matching.service";
import * as locationsService from "@/modules/locations/locations.service";
import * as paymentsService from "@/modules/payments/payments.service";
import { notify } from "@/modules/notifications/notifications.service";
import { io } from "@/realtime/socket";
import { logger } from "@/common/logger";
import type { PaymentMethod, RideStatus, VehicleType } from "@prisma/client";

interface RidePoint {
  lat: number;
  lng: number;
  address: string;
}

// spec §15-16: ride creation, fare estimate, ride state machine.
const CANCELLABLE_STATUSES: RideStatus[] = ["REQUESTED", "SEARCHING", "ASSIGNED", "ARRIVED"];

export async function estimateRide(pickup: RidePoint, dropoff: RidePoint, vehicleType: VehicleType) {
  const distanceKm = estimateRoadDistanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  if (distanceKm < 0.1) throw new ValidationError("Pickup and dropoff are too close together");
  const durationMin = estimateDurationMin(distanceKm, vehicleType);
  const fare = await pricingService.estimateFare(vehicleType, distanceKm, durationMin);
  return { distanceKm, durationMin, fare };
}

export async function createRide(
  customerId: string,
  pickup: RidePoint,
  dropoff: RidePoint,
  vehicleType: VehicleType,
  paymentMethod: PaymentMethod
) {
  const activeExisting = await prisma.ride.findFirst({
    where: { customerId, status: { notIn: ["COMPLETED", "CANCELLED", "NO_DRIVERS_FOUND"] } },
  });
  if (activeExisting) throw new ConflictError("You already have an active ride");

  const { distanceKm, durationMin, fare } = await estimateRide(pickup, dropoff, vehicleType);

  const ride = await prisma.ride.create({
    data: {
      customerId,
      status: "SEARCHING",
      requestedVehicleType: vehicleType,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      pickupAddress: pickup.address,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      dropoffAddress: dropoff.address,
      distanceKm,
      durationMin,
      estimatedFareCents: fare.totalCents,
      currency: fare.currency,
      paymentMethod,
    },
  });
  await prisma.rideStatusEvent.create({ data: { rideId: ride.id, status: "SEARCHING" } });

  // Matching runs synchronously in the same request — simple, and fast
  // enough at MVP scale (a Redis GEO search over a few hundred drivers is
  // low-single-digit milliseconds). A high-volume deployment would push
  // this onto a queue instead; see matching.service.ts's own comment on
  // the offer/accept simplification this shares the same reasoning with.
  const matched = await matchingService.attemptMatch(ride).catch((err) => {
    logger.error({ err, rideId: ride.id }, "Matching failed unexpectedly");
    return ride;
  });

  return matched;
}

async function loadRideOrThrow(rideId: string) {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      driverProfile: { include: { user: true, vehicle: true } },
      customer: { select: { id: true, name: true, phone: true } },
      payment: true,
    },
  });
  if (!ride) throw new NotFoundError("Ride not found");
  return ride;
}

function assertParticipant(ride: Awaited<ReturnType<typeof loadRideOrThrow>>, userId: string, roles: string[]) {
  const isCustomer = ride.customerId === userId;
  const isDriver = ride.driverProfile?.userId === userId;
  const isAdmin = roles.includes("PLATFORM_ADMIN");
  if (!isCustomer && !isDriver && !isAdmin) throw new ForbiddenError("You cannot access this ride");
}

export async function getRide(userId: string, roles: string[], rideId: string) {
  const ride = await loadRideOrThrow(rideId);
  assertParticipant(ride, userId, roles);
  return ride;
}

export async function listMyRidesAsCustomer(customerId: string, active: boolean) {
  return prisma.ride.findMany({
    where: {
      customerId,
      status: active ? { notIn: ["COMPLETED", "CANCELLED", "NO_DRIVERS_FOUND"] } : { in: ["COMPLETED", "CANCELLED", "NO_DRIVERS_FOUND"] },
    },
    include: { driverProfile: { include: { user: { select: { name: true, phone: true } }, vehicle: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listMyRidesAsDriver(userId: string, active: boolean) {
  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driverProfile) throw new NotFoundError("No driver profile");
  return prisma.ride.findMany({
    where: {
      driverProfileId: driverProfile.id,
      status: active ? { notIn: ["COMPLETED", "CANCELLED", "NO_DRIVERS_FOUND"] } : { in: ["COMPLETED", "CANCELLED"] },
    },
    include: { customer: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function transition(
  rideId: string,
  expectedCurrent: RideStatus[],
  nextStatus: RideStatus,
  extra: Record<string, unknown> = {}
) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw new NotFoundError("Ride not found");
  if (!expectedCurrent.includes(ride.status)) {
    throw new ConflictError(`Ride cannot move from ${ride.status} to ${nextStatus}`);
  }
  const [updated] = await prisma.$transaction([
    prisma.ride.update({ where: { id: rideId }, data: { status: nextStatus, ...extra } }),
    prisma.rideStatusEvent.create({ data: { rideId, status: nextStatus } }),
  ]);
  io.to(`ride:${rideId}`).emit("ride:status", { rideId, status: nextStatus });
  return updated;
}

export async function cancelRide(userId: string, roles: string[], rideId: string, reason: string | undefined) {
  const ride = await loadRideOrThrow(rideId);
  assertParticipant(ride, userId, roles);
  if (!CANCELLABLE_STATUSES.includes(ride.status)) {
    throw new ConflictError(`A ride in ${ride.status} status can no longer be cancelled`);
  }

  const cancelledBy = ride.customerId === userId ? "CUSTOMER" : ride.driverProfile?.userId === userId ? "DRIVER" : "ADMIN";

  const updated = await transition(rideId, CANCELLABLE_STATUSES, "CANCELLED", {
    cancelledAt: new Date(),
    cancelledBy,
    cancellationReason: reason ?? null,
  });

  if (ride.driverProfileId) {
    await locationsService.setDriverAvailability(ride.driverProfileId, "idle");
  }

  const notifyUserId = cancelledBy === "CUSTOMER" ? ride.driverProfile?.userId : ride.customerId;
  if (notifyUserId) {
    await notify({
      userId: notifyUserId,
      type: "RIDE_CANCELLED",
      title: "Ride cancelled",
      body: reason ? `Reason: ${reason}` : "The ride was cancelled.",
      data: { rideId },
    });
  }

  return updated;
}

async function requireDriverOwnsRide(userId: string, rideId: string) {
  const ride = await loadRideOrThrow(rideId);
  if (ride.driverProfile?.userId !== userId) throw new ForbiddenError("You are not the driver on this ride");
  return ride;
}

export async function markArrived(userId: string, rideId: string) {
  await requireDriverOwnsRide(userId, rideId);
  const updated = await transition(rideId, ["ASSIGNED"], "ARRIVED", { arrivedAt: new Date() });
  const ride = await loadRideOrThrow(rideId);
  await notify({
    userId: ride.customerId,
    type: "RIDE_ARRIVED",
    title: "Your driver has arrived",
    body: "Your driver is waiting at the pickup point.",
    data: { rideId },
  });
  return updated;
}

export async function startRide(userId: string, rideId: string) {
  await requireDriverOwnsRide(userId, rideId);
  return transition(rideId, ["ARRIVED"], "IN_PROGRESS", { startedAt: new Date() });
}

export async function completeRide(userId: string, rideId: string) {
  const ride = await requireDriverOwnsRide(userId, rideId);
  const updated = await transition(rideId, ["IN_PROGRESS"], "COMPLETED", {
    completedAt: new Date(),
    finalFareCents: ride.estimatedFareCents,
  });

  if (ride.driverProfileId) {
    await locationsService.setDriverAvailability(ride.driverProfileId, "idle");
    await prisma.driverProfile.update({
      where: { id: ride.driverProfileId },
      data: { completedRideCount: { increment: 1 } },
    });
  }

  const payment = await paymentsService.createPaymentForRide(rideId, ride.estimatedFareCents, ride.paymentMethod, ride.currency);

  await notify({
    userId: ride.customerId,
    type: "RIDE_COMPLETED",
    title: "Trip complete",
    body: `Total: ${ride.currency} ${(ride.estimatedFareCents / 100).toFixed(2)}. Rate your driver!`,
    data: { rideId, paymentId: payment.id },
  });

  return { ride: updated, payment };
}
