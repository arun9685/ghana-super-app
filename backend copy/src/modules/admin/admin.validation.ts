import { z } from "zod";

export const verifyDriverSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(300).optional(),
});

// Security-audit follow-up: these three admin PATCH routes used to do
// `req.body?.status as string` plus a manual `.includes()` check — it
// worked, but every other write route in this codebase validates through
// a zod schema first (see verifyDriverSchema/updatePricingSchema above).
// Bringing these in line closes that inconsistency rather than leaving a
// second, ad-hoc validation style alongside the real one.
export const updateSupportTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export const verifyArtisanSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export const updatePropertyListingStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING_REVIEW", "REMOVED"]),
});

export const updatePricingSchema = z.object({
  baseFareCents: z.coerce.number().int().positive().optional(),
  perKmCents: z.coerce.number().int().positive().optional(),
  perMinCents: z.coerce.number().int().positive().optional(),
  minFareCents: z.coerce.number().int().positive().optional(),
  bookingFeeCents: z.coerce.number().int().min(0).optional(),
  surgeMultiplier: z.coerce.number().min(0.5).max(5).optional(),
});
