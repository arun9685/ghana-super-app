import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "@/common/errors";
import type { AuthenticatedRequest } from "@/modules/auth/auth.middleware";

// spec §12: Request → JWT validation → user identification → role
// validation → permission validation → business logic. This middleware is
// the "role validation" step; `requireAuth` (auth.middleware.ts) handles
// the two steps before it. Kept separate so a route can require auth
// without requiring a specific role (e.g. GET /users/me).
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      next(new UnauthorizedError());
      return;
    }
    const hasRole = authReq.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      next(new ForbiddenError(`This action requires one of: ${allowedRoles.join(", ")}`));
      return;
    }
    next();
  };
}
