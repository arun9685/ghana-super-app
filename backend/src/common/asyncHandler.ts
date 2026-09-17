import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express doesn't forward rejected promises to error middleware by default.
// Wrapping every async controller in this is what makes `throw new
// ApiError(...)` inside an `async` function actually reach errorHandler.ts
// instead of crashing the process or hanging the request.
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
