import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/common/errors";
import { logger } from "@/common/logger";

// Every endpoint funnels through this (spec §37: "Error handling" is a
// required property of every endpoint) — routes just `throw`, this is the
// single place that decides what the client sees.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, "Unhandled server error");
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  logger.error({ err, path: req.path }, "Unexpected error");
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
}
