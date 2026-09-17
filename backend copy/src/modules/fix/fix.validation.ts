import { z } from "zod";

const CATEGORY = z.enum(["PLUMBING", "ELECTRICAL", "CLEANING", "CARPENTRY", "PAINTING", "APPLIANCE_REPAIR", "OTHER"]);

export const applyArtisanSchema = z.object({
  category: CATEGORY,
  bio: z.string().max(500).optional(),
});

export const createServiceRequestSchema = z.object({
  category: CATEGORY,
  description: z.string().min(3).max(1000),
  address: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const quoteSchema = z.object({
  quotedPriceCents: z.coerce.number().int().positive(),
});
