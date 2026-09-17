import { z } from "zod";

export const vehicleSchema = z.object({
  type: z.enum(["MOTORBIKE", "TUKTUK", "SEDAN", "SUV"]),
  make: z.string().min(1).max(40),
  model: z.string().min(1).max(40),
  color: z.string().min(1).max(30),
  plateNumber: z
    .string()
    .min(4)
    .max(15)
    .transform((s) => s.toUpperCase().replace(/\s+/g, "-")),
  year: z.coerce.number().min(1990).max(new Date().getFullYear() + 1).optional(),
});
