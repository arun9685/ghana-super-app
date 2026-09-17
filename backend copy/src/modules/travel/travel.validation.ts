import { z } from "zod";

export const createBookingSchema = z.object({
  type: z.enum(["FLIGHT", "BUS"]),
  origin: z.string().min(2).max(100),
  destination: z.string().min(2).max(100),
  departureDate: z.coerce.date(),
  passengerCount: z.coerce.number().int().positive().max(10).default(1),
});
