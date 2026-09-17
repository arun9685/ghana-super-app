import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().min(4).max(150),
  description: z.string().min(10).max(3000),
  type: z.enum(["RENT", "SALE", "SHORT_STAY"]),
  priceCents: z.coerce.number().int().positive(),
  area: z.string().min(2).max(120),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
});

export const updateListingStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING_REVIEW", "REMOVED"]),
});

export const enquireSchema = z.object({
  message: z.string().min(2).max(1000),
});

export const searchListingsSchema = z.object({
  type: z.enum(["RENT", "SALE", "SHORT_STAY"]).optional(),
  area: z.string().optional(),
  maxPriceCents: z.coerce.number().int().positive().optional(),
});
