import { z } from "zod";

export const pingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  vehicleType: z.enum(["MOTORBIKE", "TUKTUK", "SEDAN", "SUV"]).default("SEDAN"),
});
