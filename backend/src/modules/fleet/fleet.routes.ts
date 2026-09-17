import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { requireRole } from "@/middleware/roleGuard";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { createFleetSchema, addFleetVehicleSchema, assignDriverSchema } from "@/modules/fleet/fleet.validation";
import * as fleetService from "@/modules/fleet/fleet.service";

// "Fleet" service tile — multi-vehicle fleet owners. Registration
// (GET/POST "/") is open to any authenticated user — that's how a
// CUSTOMER self-upgrades to FLEET_OWNER (see fleet.service.ts). Every
// other route needs the role that registration just granted.
export const fleetRouter = Router();
fleetRouter.use(requireAuth);

fleetRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const fleet = await fleetService.getOrCreateFleet(authReq.user!.id);
    res.status(200).json({ success: true, data: fleet });
  })
);

fleetRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createFleetSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid fleet name", parsed.error.flatten());
    const fleet = await fleetService.getOrCreateFleet(authReq.user!.id, parsed.data.name);
    res.status(201).json({ success: true, data: fleet });
  })
);

fleetRouter.use(requireRole("FLEET_OWNER", "PLATFORM_ADMIN"));

fleetRouter.get(
  "/vehicles",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const vehicles = await fleetService.listFleetVehicles(authReq.user!.id);
    res.status(200).json({ success: true, data: vehicles });
  })
);

fleetRouter.post(
  "/vehicles",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = addFleetVehicleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid vehicle", parsed.error.flatten());
    const vehicle = await fleetService.addVehicle(authReq.user!.id, parsed.data);
    res.status(201).json({ success: true, data: vehicle });
  })
);

fleetRouter.post(
  "/vehicles/:id/assign",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = assignDriverSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid assignment", parsed.error.flatten());
    const vehicle = await fleetService.assignDriver(authReq.user!.id, req.params.id!, parsed.data.driverProfileId);
    res.status(200).json({ success: true, data: vehicle });
  })
);

fleetRouter.post(
  "/vehicles/:id/unassign",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const vehicle = await fleetService.unassignDriver(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: vehicle });
  })
);
