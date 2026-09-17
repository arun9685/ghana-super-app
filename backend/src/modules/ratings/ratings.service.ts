import { prisma } from "@/database/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/common/errors";

// spec §30: post-trip ratings, server-side average calculation. Only the
// customer rates the driver in this scope (a driver-rates-customer
// direction is the documented symmetric extension, same shape, not
// wired to a UI yet).
export async function rateRide(raterId: string, rideId: string, stars: number, comment?: string) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw new NotFoundError("Ride not found");
  if (ride.customerId !== raterId) throw new ForbiddenError("Only the customer on this ride can rate it");
  if (ride.status !== "COMPLETED") throw new ValidationError("Only completed rides can be rated");

  const existing = await prisma.rating.findUnique({ where: { rideId } });
  if (existing) throw new ConflictError("This ride has already been rated");

  return prisma.$transaction(async (tx) => {
    const rating = await tx.rating.create({
      data: {
        rideId,
        ratedByUserId: raterId,
        ratedDriverProfileId: ride.driverProfileId,
        stars,
        comment,
      },
    });

    if (ride.driverProfileId) {
      const driver = await tx.driverProfile.findUniqueOrThrow({ where: { id: ride.driverProfileId } });
      // Incremental weighted average — avoids re-scanning every past
      // rating on every write.
      const newCount = driver.ratingCount + 1;
      const newAvg = (driver.ratingAvg * driver.ratingCount + stars) / newCount;
      await tx.driverProfile.update({
        where: { id: ride.driverProfileId },
        data: { ratingAvg: Math.round(newAvg * 100) / 100, ratingCount: newCount },
      });
    }

    return rating;
  });
}

export async function getDriverRatingSummary(driverProfileId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverProfileId },
    select: { ratingAvg: true, ratingCount: true },
  });
  if (!driver) throw new NotFoundError("Driver not found");

  const recent = await prisma.rating.findMany({
    where: { ratedDriverProfileId: driverProfileId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { stars: true, comment: true, createdAt: true },
  });

  return { ...driver, recent };
}
