import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import {
  createListingSchema,
  updateListingStatusSchema,
  enquireSchema,
  searchListingsSchema,
} from "@/modules/property/property.validation";
import * as propertyService from "@/modules/property/property.service";

// "Property" service tile — listings for rent/sale/short-stay + enquiries.
export const propertyRouter = Router();

propertyRouter.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const parsed = searchListingsSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid search", parsed.error.flatten());
    const listings = await propertyService.searchListings(parsed.data);
    res.status(200).json({ success: true, data: listings });
  })
);

propertyRouter.get(
  "/listings/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const listings = await propertyService.listMyListings(authReq.user!.id);
    res.status(200).json({ success: true, data: listings });
  })
);

propertyRouter.get(
  "/listings/:id",
  asyncHandler(async (req, res) => {
    const listing = await propertyService.getListing(req.params.id!);
    res.status(200).json({ success: true, data: listing });
  })
);

propertyRouter.post(
  "/listings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createListingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid listing", parsed.error.flatten());
    const listing = await propertyService.createListing(authReq.user!.id, parsed.data);
    res.status(201).json({ success: true, data: listing });
  })
);

propertyRouter.patch(
  "/listings/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = updateListingStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid status", parsed.error.flatten());
    const isAdmin = authReq.user!.roles.includes("PLATFORM_ADMIN");
    const listing = await propertyService.updateListingStatus(authReq.user!.id, isAdmin, req.params.id!, parsed.data.status);
    res.status(200).json({ success: true, data: listing });
  })
);

propertyRouter.post(
  "/listings/:id/enquiries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = enquireSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid enquiry", parsed.error.flatten());
    const enquiry = await propertyService.enquire(authReq.user!.id, req.params.id!, parsed.data.message);
    res.status(201).json({ success: true, data: enquiry });
  })
);

propertyRouter.get(
  "/listings/:id/enquiries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const enquiries = await propertyService.listEnquiriesForOwner(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: enquiries });
  })
);
