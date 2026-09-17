import { Router } from "express";
import * as authController from "@/modules/auth/auth.controller";
import { otpRequestRateLimiter, otpVerifyRateLimiter, refreshRateLimiter } from "@/middleware/rateLimiter";
import { asyncHandler } from "@/common/asyncHandler";

// Matches spec §36 exactly:
//   POST /auth/request-otp
//   POST /auth/verify-otp
//   POST /auth/refresh
//   POST /auth/logout
export const authRouter = Router();

authRouter.post("/request-otp", otpRequestRateLimiter, asyncHandler(authController.requestOtpHandler));
// verify-otp used to rely only on the general API rate limiter, which is
// far too loose for a short numeric code — see rateLimiter.ts.
authRouter.post("/verify-otp", otpVerifyRateLimiter, asyncHandler(authController.verifyOtpHandler));
authRouter.post("/refresh", refreshRateLimiter, asyncHandler(authController.refreshHandler));
authRouter.post("/logout", asyncHandler(authController.logoutHandler));
