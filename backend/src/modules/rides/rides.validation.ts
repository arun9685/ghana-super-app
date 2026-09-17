import { z } from "zod";

const point = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1).max(200),
});

export const estimateSchema = z.object({
  pickup: point,
  dropoff: point,
  vehicleType: z.enum(["MOTORBIKE", "TUKTUK", "SEDAN", "SUV"]),
});

export const createRideSchema = estimateSchema.extend({
  paymentMethod: z.enum(["CASH", "MOMO", "CARD", "WALLET"]).default("CASH"),
});

export const cancelRideSchema = z.object({
  reason: z.string().max(200).optional(),
});
