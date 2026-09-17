import { Router } from "express";
import { requireAuth } from "@/modules/auth/auth.middleware";
import { requireRole } from "@/middleware/roleGuard";
import { asyncHandler } from "@/common/asyncHandler";
import { NotFoundError, ValidationError } from "@/common/errors";
import {
  updatePricingSchema,
  verifyDriverSchema,
  updateSupportTicketStatusSchema,
  verifyArtisanSchema,
  updatePropertyListingStatusSchema,
} from "@/modules/admin/admin.validation";
import * as adminService from "@/modules/admin/admin.service";
import * as driversService from "@/modules/drivers/drivers.service";
import * as supportService from "@/modules/support/support.service";
import * as pricingService from "@/modules/pricing/pricing.service";
import { notify } from "@/modules/notifications/notifications.service";
import { prisma } from "@/database/prisma";
import type { RideStatus, TicketStatus } from "@prisma/client";

// spec §32-33: every route here requires PLATFORM_ADMIN.
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("PLATFORM_ADMIN"));

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const stats = await adminService.getDashboardStats();
    res.status(200).json({ success: true, data: stats });
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await adminService.listUsers(req.query.search as string | undefined);
    res.status(200).json({ success: true, data: users });
  })
);

adminRouter.get(
  "/rides",
  asyncHandler(async (req, res) => {
    const rides = await adminService.listRides(req.query.status as RideStatus | undefined);
    res.status(200).json({ success: true, data: rides });
  })
);

adminRouter.get(
  "/drivers",
  asyncHandler(async (req, res) => {
    const status = req.query.status as "PENDING" | "APPROVED" | "REJECTED" | undefined;
    const drivers = await driversService.listDriversByStatus(status);
    res.status(200).json({ success: true, data: drivers });
  })
);

adminRouter.patch(
  "/drivers/:id/verify",
  asyncHandler(async (req, res) => {
    const parsed = verifyDriverSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());

    const driverProfile = await driversService.setVerificationStatus(
      req.params.id!,
      parsed.data.status,
      parsed.data.reason
    );

    await notify({
      userId: driverProfile.userId,
      type: "DRIVER_VERIFICATION",
      title: parsed.data.status === "APPROVED" ? "You're approved to drive!" : "Driver application update",
      body:
        parsed.data.status === "APPROVED"
          ? "Your documents have been verified. You can now go online and accept rides."
          : `Your application needs attention: ${parsed.data.reason ?? "please contact support"}.`,
    });

    res.status(200).json({ success: true, data: driverProfile });
  })
);

adminRouter.patch(
  "/pricing/:vehicleType",
  asyncHandler(async (req, res) => {
    const parsed = updatePricingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid pricing update", parsed.error.flatten());

    const vehicleType = req.params.vehicleType! as "MOTORBIKE" | "TUKTUK" | "SEDAN" | "SUV";
    const rule = await pricingService.updatePricingRule(vehicleType, parsed.data);
    res.status(200).json({ success: true, data: rule });
  })
);

adminRouter.get(
  "/support/tickets",
  asyncHandler(async (req, res) => {
    const status = req.query.status as TicketStatus | undefined;
    const tickets = await supportService.listAllTickets(status);
    res.status(200).json({ success: true, data: tickets });
  })
);

adminRouter.patch(
  "/support/tickets/:id/status",
  asyncHandler(async (req, res) => {
    const parsed = updateSupportTicketStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid status", parsed.error.flatten());

    const ticket = await supportService.updateStatus(req.params.id!, parsed.data.status as TicketStatus);
    res.status(200).json({ success: true, data: ticket });
  })
);

// Artisan verification — same admin-gated pattern as driver verification
// above (spec's general "supply-side onboarding needs a human check"
// approach), needed before an artisan appears in Fix search results or
// can accept a job (see fix.service.ts's listArtisans/acceptServiceRequest).
adminRouter.get(
  "/artisans",
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const artisans = await prisma.artisanProfile.findMany({
      where: status ? { verificationStatus: status } : undefined,
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: artisans });
  })
);

adminRouter.patch(
  "/artisans/:id/verify",
  asyncHandler(async (req, res) => {
    const parsed = verifyArtisanSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid status", parsed.error.flatten());
    const status = parsed.data.status;
    const profile = await prisma.artisanProfile.update({
      where: { id: req.params.id! },
      data: { verificationStatus: status },
    });
    await notify({
      userId: profile.userId,
      type: "ARTISAN_VERIFICATION",
      title: status === "APPROVED" ? "You're approved on Fix!" : "Artisan application update",
      body:
        status === "APPROVED"
          ? "Your artisan profile has been verified. You can now accept jobs."
          : "Your artisan application needs attention — please contact support.",
    });
    res.status(200).json({ success: true, data: profile });
  })
);

// Property listing moderation — mirrors updateListingStatus's own-listing
// check in property.service.ts but exposes it under /admin too, for a
// consistent single "admin queue" surface.
adminRouter.get(
  "/property/listings",
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const listings = await prisma.propertyListing.findMany({
      where: status ? { status: status as "ACTIVE" | "PENDING_REVIEW" | "REMOVED" } : undefined,
      include: { owner: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: listings });
  })
);

adminRouter.patch(
  "/property/listings/:id/status",
  asyncHandler(async (req, res) => {
    const parsed = updatePropertyListingStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid status", parsed.error.flatten());
    const listing = await prisma.propertyListing.update({
      where: { id: req.params.id! },
      data: { status: parsed.data.status },
    });
    res.status(200).json({ success: true, data: listing });
  })
);

adminRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id! },
      include: { roles: true, driverProfile: { include: { vehicle: true } } },
    });
    if (!user) throw new NotFoundError("User not found");
    res.status(200).json({ success: true, data: user });
  })
);
