import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { addMessageSchema, createTicketSchema } from "@/modules/support/support.validation";
import * as supportService from "@/modules/support/support.service";

// spec §32.
export const supportRouter = Router();

supportRouter.post(
  "/tickets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid ticket", parsed.error.flatten());

    const ticket = await supportService.createTicket(
      authReq.user!.id,
      parsed.data.subject,
      parsed.data.description,
      parsed.data.rideId
    );
    res.status(201).json({ success: true, data: ticket });
  })
);

supportRouter.get(
  "/tickets",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const tickets = await supportService.listMyTickets(authReq.user!.id);
    res.status(200).json({ success: true, data: tickets });
  })
);

supportRouter.get(
  "/tickets/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const ticket = await supportService.getTicket(authReq.user!.id, authReq.user!.roles, req.params.id!);
    res.status(200).json({ success: true, data: ticket });
  })
);

supportRouter.post(
  "/tickets/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = addMessageSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid message", parsed.error.flatten());

    const message = await supportService.addMessage(authReq.user!.id, authReq.user!.roles, req.params.id!, parsed.data.body);
    res.status(201).json({ success: true, data: message });
  })
);
