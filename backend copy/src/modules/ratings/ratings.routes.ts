import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { createRatingSchema } from "@/modules/ratings/ratings.validation";
import * as ratingsService from "@/modules/ratings/ratings.service";

// spec §30.
export const ratingsRouter = Router();

ratingsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createRatingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid rating", parsed.error.flatten());

    const rating = await ratingsService.rateRide(
      authReq.user!.id,
      parsed.data.rideId,
      parsed.data.stars,
      parsed.data.comment
    );
    res.status(201).json({ success: true, data: rating });
  })
);

ratingsRouter.get(
  "/driver/:driverProfileId",
  asyncHandler(async (req, res) => {
    const summary = await ratingsService.getDriverRatingSummary(req.params.driverProfileId!);
    res.status(200).json({ success: true, data: summary });
  })
);
