import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/common/logger";

// Used from Sprint 3 onward for driver location (spec §18: "Do not write
// every GPS update directly to PostgreSQL — use Redis"), and here in
// Sprint 1 for OTP rate-limit counters, which have the same shape of
// problem: high write volume, short-lived data, no need for durability.
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on("error", (err) => logger.error({ err }, "Redis connection error"));
redis.on("connect", () => logger.info("Redis connected"));
