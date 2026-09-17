import { prisma } from "@/database/prisma";
import { ConflictError, NotFoundError, ForbiddenError } from "@/common/errors";

// spec's "Fleet" service tile: lets a FLEET_OWNER register multiple
// vehicles and assign drivers to them, distinct from the individual
// owner-operator flow in modules/drivers + modules/vehicles. Same
// self-service role upgrade pattern as applyAsArtisan (fix.service.ts):
// registering a fleet for the first time grants FLEET_OWNER so the
// caller's own next request already has access to the FLEET_OWNER-gated
// endpoints (vehicles, assignment).
export async function getOrCreateFleet(ownerId: string, name?: string) {
  const existing = await prisma.fleet.findUnique({ where: { ownerId }, include: { vehicles: { include: { assignedDriver: { include: { user: true } } } } } });
  if (existing) return existing;
  return prisma.$transaction(async (tx) => {
    const fleet = await tx.fleet.create({ data: { ownerId, name: name ?? "My Fleet" } });
    await tx.userRole.upsert({
      where: { userId_role: { userId: ownerId, role: "FLEET_OWNER" } },
      update: {},
      create: { userId: ownerId, role: "FLEET_OWNER" },
    });
    return { ...fleet, vehicles: [] as never[] };
  });
}

export async function addVehicle(
  ownerId: string,
  input: { type: "MOTORBIKE" | "TUKTUK" | "SEDAN" | "SUV"; make: string; model: string; color: string; plateNumber: string }
) {
  const fleet = await getOrCreateFleet(ownerId);
  const existingPlate = await prisma.fleetVehicle.findUnique({ where: { plateNumber: input.plateNumber } });
  if (existingPlate) throw new ConflictError("A vehicle with this plate number already exists");

  return prisma.fleetVehicle.create({
    data: { fleetId: fleet.id, ...input },
  });
}

export async function assignDriver(ownerId: string, fleetVehicleId: string, driverProfileId: string) {
  const fleet = await prisma.fleet.findUnique({ where: { ownerId } });
  if (!fleet) throw new NotFoundError("No fleet found for this owner");

  const vehicle = await prisma.fleetVehicle.findUnique({ where: { id: fleetVehicleId } });
  if (!vehicle || vehicle.fleetId !== fleet.id) throw new NotFoundError("Vehicle not found in your fleet");

  const driverProfile = await prisma.driverProfile.findUnique({ where: { id: driverProfileId } });
  if (!driverProfile) throw new NotFoundError("Driver profile not found");
  if (driverProfile.verificationStatus !== "APPROVED") {
    throw new ForbiddenError("Driver must be an approved driver before assignment");
  }

  return prisma.fleetVehicle.update({
    where: { id: fleetVehicleId },
    data: { assignedDriverProfileId: driverProfileId },
  });
}

export async function unassignDriver(ownerId: string, fleetVehicleId: string) {
  const fleet = await prisma.fleet.findUnique({ where: { ownerId } });
  if (!fleet) throw new NotFoundError("No fleet found for this owner");
  const vehicle = await prisma.fleetVehicle.findUnique({ where: { id: fleetVehicleId } });
  if (!vehicle || vehicle.fleetId !== fleet.id) throw new NotFoundError("Vehicle not found in your fleet");

  return prisma.fleetVehicle.update({ where: { id: fleetVehicleId }, data: { assignedDriverProfileId: null } });
}

export async function listFleetVehicles(ownerId: string) {
  const fleet = await prisma.fleet.findUnique({
    where: { ownerId },
    include: { vehicles: { include: { assignedDriver: { include: { user: true } } } } },
  });
  return fleet?.vehicles ?? [];
}
