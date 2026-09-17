import { prisma } from "@/database/prisma";
import { ConflictError, NotFoundError } from "@/common/errors";
import * as vehiclesService from "@/modules/vehicles/vehicles.service";
import type { VehicleInput } from "@/modules/vehicles/vehicles.service";

// spec §28: driver profile, document submission, verification status.
// Driving is opt-in on top of an existing account (a CUSTOMER can also
// become a DRIVER) — this composes vehicles.service rather than owning
// vehicle logic itself, matching the modular-monolith module boundaries
// spec §8 asks for.
export async function applyToDrive(userId: string, licenseNumber: string, vehicle: VehicleInput) {
  let driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });

  if (driverProfile && driverProfile.verificationStatus === "APPROVED") {
    throw new ConflictError("You are already an approved driver");
  }

  if (!driverProfile) {
    driverProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.driverProfile.create({
        data: { userId, licenseNumber, verificationStatus: "PENDING" },
      });
      await tx.userRole.upsert({
        where: { userId_role: { userId, role: "DRIVER" } },
        update: {},
        create: { userId, role: "DRIVER" },
      });
      return profile;
    });
  } else {
    driverProfile = await prisma.driverProfile.update({
      where: { id: driverProfile.id },
      data: { licenseNumber, verificationStatus: "PENDING", rejectionReason: null },
    });
  }

  await vehiclesService.upsertVehicleForDriver(driverProfile.id, vehicle);

  return getFullDriverProfile(userId);
}

export async function getFullDriverProfile(userId: string) {
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { vehicle: true, user: { select: { name: true, phone: true } } },
  });
  if (!driverProfile) throw new NotFoundError("No driver profile");
  return driverProfile;
}

export async function listDriversByStatus(status?: "PENDING" | "APPROVED" | "REJECTED") {
  return prisma.driverProfile.findMany({
    where: status ? { verificationStatus: status } : undefined,
    include: { vehicle: true, user: { select: { name: true, phone: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function setVerificationStatus(
  driverProfileId: string,
  status: "APPROVED" | "REJECTED",
  reason?: string
) {
  const driverProfile = await prisma.driverProfile.update({
    where: { id: driverProfileId },
    data: { verificationStatus: status, rejectionReason: status === "REJECTED" ? reason ?? null : null },
    include: { user: true },
  });
  return driverProfile;
}
