import pino from "pino";
import { env } from "@/config/env";

// Structured JSON logs so CloudWatch (spec §46) can actually parse and
// alert on them, rather than grepping free text.
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  redact: {
    // Never let a phone number, OTP, or token reach the log pipeline —
    // spec §42/§43 (personal data + location privacy) applies to logs too.
    paths: ["req.headers.authorization", "*.otp", "*.password", "*.token", "*.accessToken", "*.refreshToken"],
    censor: "[redacted]",
  },
});
