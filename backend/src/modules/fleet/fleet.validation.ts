import { z } from "zod";

export const createFleetSchema = z.object({
  name: z.string().min(2).max(100),
});

export const addFleetVehicleSchema = z.object({
  type: z.enum(["MOTORBIKE", "TUKTUK", "SEDAN", "SUV"]),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  color: z.string().min(1).max(30),
  plateNumber: z.string().min(3).max(20),
});

export const assignDriverSchema = z.object({
  driverProfileId: z.string().uuid(),
});
