import rateLimit from "express-rate-limit";
import { env } from "@/config/env";

// spec §37: every endpoint needs rate limiting; sensitive ones (OTP request)
// need a tighter limit than general API traffic to block SMS-bombing abuse
// (spec §44: "OTP abuse detection").
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

export const otpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 OTP requests per phone-adjacent IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many OTP requests — please wait before trying again" } },
});

// Security-audit follow-up: verify-otp had NO rate limit beyond the
// general API limiter, which is far too loose for a 4-6 digit code — a
// generalRateLimiter budget (env.RATE_LIMIT_MAX_REQUESTS, shared across
// every route) is nowhere near tight enough to stop an attacker from
// simply guessing every code for a phone number before the OTP expires.
// This caps verify attempts specifically, independent of general traffic.
export const otpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 verify attempts per IP per 15 minutes — enough for a legitimate typo or two, not a brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many verification attempts — please request a new code" } },
});

// Refresh-token rotation is a valuable target (a stolen/guessed token
// mints a fresh access token) and — unlike login — has no natural
// per-user throttle upstream, so it gets its own tighter budget too.
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many token refresh attempts" } },
});

// The payment webhook is authenticated by HMAC signature (see
// payments.routes.ts), so this isn't a brute-force concern the way OTP
// is — but a flood of even correctly-signed calls (a compromised or
// misbehaving gateway integration) shouldn't be able to hammer the
// payments-processing path unbounded. Generous ceiling, real gateways
// send nowhere near this volume per IP.
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many webhook calls" } },
});
