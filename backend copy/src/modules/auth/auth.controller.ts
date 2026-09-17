import type { Request, Response } from "express";
import * as authService from "@/modules/auth/auth.service";
import { logoutSchema, refreshSchema, requestOtpSchema, verifyOtpSchema } from "@/modules/auth/auth.validation";
import { ValidationError } from "@/common/errors";

export async function requestOtpHandler(req: Request, res: Response): Promise<void> {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError("Invalid phone number", parsed.error.flatten());

  await authService.requestOtp(parsed.data.phone);
  // Deliberately do not reveal whether the number is new or existing in
  // the response — that's account-enumeration information leakage.
  res.status(200).json({ success: true, data: { message: "OTP sent" } });
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());

  const result = await authService.verifyOtp(parsed.data.phone, parsed.data.otp);
  res.status(200).json({ success: true, data: result });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());

  const result = await authService.refreshSession(parsed.data.refreshToken);
  res.status(200).json({ success: true, data: result });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const parsed = logoutSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError("Invalid request", parsed.error.flatten());

  await authService.logout(parsed.data.refreshToken);
  res.status(200).json({ success: true, data: { message: "Logged out" } });
}
