import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { applyArtisanSchema, createServiceRequestSchema, quoteSchema } from "@/modules/fix/fix.validation";
import * as fixService from "@/modules/fix/fix.service";
import type { ArtisanCategory, ServiceRequestStatus } from "@prisma/client";

// "Fix" service tile — home services & artisans.
export const fixRouter = Router();

fixRouter.post(
  "/artisans/apply",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = applyArtisanSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid application", parsed.error.flatten());
    const profile = await fixService.applyAsArtisan(authReq.user!.id, parsed.data.category, parsed.data.bio);
    res.status(200).json({ success: true, data: profile });
  })
);

fixRouter.get(
  "/artisans",
  asyncHandler(async (req, res) => {
    const artisans = await fixService.listArtisans(req.query.category as ArtisanCategory | undefined);
    res.status(200).json({ success: true, data: artisans });
  })
);

fixRouter.post(
  "/requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createServiceRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());
    const request = await fixService.createServiceRequest(
      authReq.user!.id,
      parsed.data.category,
      parsed.data.description,
      parsed.data.address,
      parsed.data.lat,
      parsed.data.lng
    );
    res.status(201).json({ success: true, data: request });
  })
);

fixRouter.get(
  "/requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const open = req.query.open === "true";
    const requests = open
      ? await fixService.listOpenServiceRequests(req.query.category as ArtisanCategory | undefined)
      : await fixService.listMyServiceRequests(authReq.user!.id);
    res.status(200).json({ success: true, data: requests });
  })
);

fixRouter.post(
  "/requests/:id/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid quote", parsed.error.flatten());
    const request = await fixService.acceptServiceRequest(authReq.user!.id, req.params.id!, parsed.data.quotedPriceCents);
    res.status(200).json({ success: true, data: request });
  })
);

fixRouter.patch(
  "/requests/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const status = req.body?.status as ServiceRequestStatus;
    if (!["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
      throw new ValidationError("Invalid status");
    }
    const request = await fixService.updateServiceRequestStatus(authReq.user!.id, req.params.id!, status);
    res.status(200).json({ success: true, data: request });
  })
);
