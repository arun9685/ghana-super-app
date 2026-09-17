import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import * as notificationsService from "@/modules/notifications/notifications.service";

// spec §31.
export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const unreadOnly = req.query.unread === "true";
    const notifications = await notificationsService.listForUser(authReq.user!.id, { unreadOnly });
    const unread = await notificationsService.unreadCount(authReq.user!.id);
    res.status(200).json({ success: true, data: { notifications, unreadCount: unread } });
  })
);

notificationsRouter.patch(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    await notificationsService.markRead(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: { updated: true } });
  })
);

notificationsRouter.patch(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    await notificationsService.markAllRead(authReq.user!.id);
    res.status(200).json({ success: true, data: { updated: true } });
  })
);
