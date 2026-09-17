import { prisma } from "@/database/prisma";
import { ConflictError, NotFoundError } from "@/common/errors";
import type { VehicleType } from "@prisma/client";

// spec §29: vehicle registration. One active vehicle per driver profile
// (kept simple — a fleet-owner-managed multi-vehicle roster is the
// documented FLEET_OWNER-role extension point, not needed for a driver
// registering their own car).
export interface VehicleInput {
  type: VehicleType;
  make: string;
  model: string;
  color: string;
  plateNumber: string;
  year?: number;
}

export async function upsertVehicleForDriver(driverProfileId: string, input: VehicleInput) {
  const platePreviouslyUsed = await prisma.vehicle.findFirst({
    where: { plateNumber: input.plateNumber, driverProfileId: { not: driverProfileId } },
  });
  if (platePreviouslyUsed) {
    throw new ConflictError("This plate number is already registered to another driver");
  }

  return prisma.vehicle.upsert({
    where: { driverProfileId },
    update: input,
    create: { ...input, driverProfileId },
  });
}

export async function getVehicleForDriver(driverProfileId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverProfileId } });
  if (!vehicle) throw new NotFoundError("No vehicle registered yet");
  return vehicle;
}
