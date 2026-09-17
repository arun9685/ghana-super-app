import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/modules/auth/jwt.service";
import { UnauthorizedError } from "@/common/errors";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; roles: string[] };
}

// spec §12, steps 1–3: "Request → JWT validation → User identification".
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or malformed Authorization header"));
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = { id: payload.sub, roles: payload.roles };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}
