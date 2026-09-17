import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { createBookingSchema } from "@/modules/travel/travel.validation";
import * as travelService from "@/modules/travel/travel.service";

// "Travel" service tile — flights & inter-city bus bookings.
export const travelRouter = Router();

travelRouter.post(
  "/bookings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid booking", parsed.error.flatten());
    const booking = await travelService.createBooking(authReq.user!.id, parsed.data);
    res.status(201).json({ success: true, data: booking });
  })
);

travelRouter.get(
  "/bookings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const bookings = await travelService.listMyBookings(authReq.user!.id);
    res.status(200).json({ success: true, data: bookings });
  })
);

travelRouter.get(
  "/bookings/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const booking = await travelService.getBooking(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: booking });
  })
);

travelRouter.post(
  "/bookings/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const booking = await travelService.cancelBooking(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: booking });
  })
);
