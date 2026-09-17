import { Router, type Response } from "express";
import { z } from "zod";
import * as usersService from "@/modules/users/users.service";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { UnauthorizedError, ValidationError } from "@/common/errors";

// spec §36: GET /users/me, PATCH /users/me
export const usersRouter = Router();

const updateMeSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
});

usersRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) throw new UnauthorizedError();
    const user = await usersService.getUserById(authReq.user.id);
    res.status(200).json({ success: true, data: user });
  })
);

usersRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) throw new UnauthorizedError();

    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());

    const user = await usersService.updateUser(authReq.user.id, parsed.data);
    res.status(200).json({ success: true, data: user });
  })
);
