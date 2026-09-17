import { prisma } from "@/database/prisma";
import { getTravelProvider } from "@/modules/travel/travel.provider";
import { notify } from "@/modules/notifications/notifications.service";
import { NotFoundError, ForbiddenError, ConflictError } from "@/common/errors";
import type { TravelType } from "@prisma/client";

const provider = getTravelProvider();

// spec's "Travel" service tile — flight & inter-city bus bookings.
export async function createBooking(
  userId: string,
  input: { type: TravelType; origin: string; destination: string; departureDate: Date; passengerCount: number }
) {
  const booking = await prisma.travelBooking.create({
    data: { userId, ...input, status: "PENDING" },
  });

  const result = await provider.book(input);

  const updated = await prisma.travelBooking.update({
    where: { id: booking.id },
    data: {
      status: result.success ? "CONFIRMED" : "CANCELLED",
      priceCents: result.priceCents,
      providerRef: result.providerRef,
    },
  });

  await notify({
    userId,
    type: "TRAVEL_BOOKING",
    title: result.success ? "Trip booked" : "Booking failed",
    body: `${input.type === "FLIGHT" ? "Flight" : "Bus"} ${input.origin} → ${input.destination} on ${input.departureDate.toDateString()}.`,
    data: { bookingId: booking.id },
  });

  return updated;
}

export async function listMyBookings(userId: string) {
  return prisma.travelBooking.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getBooking(userId: string, bookingId: string) {
  const booking = await prisma.travelBooking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundError("Booking not found");
  if (booking.userId !== userId) throw new ForbiddenError("Not your booking");
  return booking;
}

export async function cancelBooking(userId: string, bookingId: string) {
  const booking = await getBooking(userId, bookingId);
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw new ConflictError("This booking can no longer be cancelled");
  }
  return prisma.travelBooking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
}
