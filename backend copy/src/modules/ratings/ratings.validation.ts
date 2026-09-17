import { z } from "zod";

export const createRatingSchema = z.object({
  rideId: z.string().uuid(),
  stars: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
