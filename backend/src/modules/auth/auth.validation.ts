import { z } from "zod";

export const requestOtpSchema = z.object({
  phone: z.string().min(9).max(15),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(9).max(15),
  otp: z.string().min(4).max(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});
