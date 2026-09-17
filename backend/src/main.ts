import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger } from "@/common/logger";
import { generalRateLimiter } from "@/middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { authRouter } from "@/modules/auth/auth.routes";
import { usersRouter } from "@/modules/users/users.routes";
import { driversRouter } from "@/modules/drivers/drivers.routes";
import { vehiclesRouter } from "@/modules/vehicles/vehicles.routes";
import { locationsRouter } from "@/modules/locations/locations.routes";
import { ridesRouter } from "@/modules/rides/rides.routes";
import { pricingRouter } from "@/modules/pricing/pricing.routes";
import { paymentsRouter } from "@/modules/payments/payments.routes";
import { ratingsRouter } from "@/modules/ratings/ratings.routes";
import { notificationsRouter } from "@/modules/notifications/notifications.routes";
import { supportRouter } from "@/modules/support/support.routes";
import { adminRouter } from "@/modules/admin/admin.routes";
import { eatRouter } from "@/modules/eat/eat.routes";
import { fixRouter } from "@/modules/fix/fix.routes";
import { utilitiesRouter } from "@/modules/utilities/utilities.routes";
import { liquidityRouter } from "@/modules/liquidity/liquidity.routes";
import { fleetRouter } from "@/modules/fleet/fleet.routes";
import { propertyRouter } from "@/modules/property/property.routes";
import { travelRouter } from "@/modules/travel/travel.routes";
import { prisma } from "@/database/prisma";
import { redis } from "@/database/redis";
import { initSocket } from "@/realtime/socket";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
// `verify` stashes the exact raw bytes of the request body on `req.rawBody`
// before Express parses them into `req.body`. The payment webhook route
// needs those exact bytes (not the re-serialized JSON) to check the
// gateway's HMAC signature — see modules/payments/webhookSignature.ts.
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  })
);
app.use(pinoHttp({ logger }));
app.use(generalRateLimiter);

// spec §47: the load balancer / container platform needs a health check
// endpoint to know whether to route traffic to this instance.
//
// Readiness-vs-liveness follow-up: a single combined /health endpoint
// conflates two different questions an orchestrator needs answered
// separately —
//   "is this process alive?" (liveness — should ECS kill and restart it?)
//   "can it currently serve real traffic?" (readiness — should the ALB
//     route to it right now?)
// Checking Postgres+Redis for BOTH means a transient DB blip restarts a
// perfectly healthy Node process instead of just pulling it from rotation
// until the dependency recovers — the two failure modes need different
// responses. /health is kept as an alias of /health/ready so existing
// callers (and the ECS task definition, until it's updated) keep working.
app.get("/health/live", (_req, res) => {
  // No dependency checks on purpose — this only answers "is the event
  // loop responsive", which is exactly what should gate a container
  // restart. If this ever times out or throws, the process itself is
  // wedged, which a DB/Redis outage alone should never cause.
  res.status(200).json({ status: "ok" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "Readiness check failed");
    res.status(503).json({ status: "unavailable" });
  }
});

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "Health check failed");
    res.status(503).json({ status: "unavailable" });
  }
});

// spec §36: base path /api/v1 — the full core loop, no longer split by
// sprint. Every module below is a real implementation, not a stub.
const v1 = express.Router();
v1.use("/auth", authRouter);
v1.use("/users", usersRouter);
v1.use("/drivers", driversRouter);
v1.use("/vehicles", vehiclesRouter);
v1.use("/locations", locationsRouter);
v1.use("/rides", ridesRouter);
v1.use("/pricing", pricingRouter);
v1.use("/payments", paymentsRouter);
v1.use("/ratings", ratingsRouter);
v1.use("/notifications", notificationsRouter);
v1.use("/support", supportRouter);
v1.use("/admin", adminRouter);
// Service tiles beyond core Mobility (spec's broader super-app scope):
// real schema + endpoints, external integrations abstracted behind a
// provider interface per domain (see each module's *.provider.ts),
// ready to wire up with real credentials without touching call sites.
v1.use("/eat", eatRouter);
v1.use("/fix", fixRouter);
v1.use("/utilities", utilitiesRouter);
v1.use("/liquidity", liquidityRouter);
v1.use("/fleet", fleetRouter);
v1.use("/property", propertyRouter);
v1.use("/travel", travelRouter);
app.use("/api/v1", v1);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = createServer(app);
// Always attach socket.io to the http server object (this just wires up
// request/upgrade listeners — it does not bind a port on its own), so
// anything that imports `io` from realtime/socket (e.g.
// notifications.service.ts) still works under tests, even though the
// server below never actually starts listening in that case.
initSocket(httpServer);

// Test-run fix: this used to call httpServer.listen() unconditionally at
// import time. That's fine when main.ts is the real process entry point,
// but payments.webhook.test.ts (and any future test) imports `app` from
// here for supertest, and that import alone was enough to bind the real
// port — colliding with an already-running dev server locally, and with
// itself across parallel test files in CI (EADDRINUSE). Only actually
// listen when this file is genuinely being run as the server.
let server: ReturnType<typeof createServer> | undefined;

if (env.NODE_ENV !== "test") {
  server = httpServer.listen(env.PORT, () => {
    logger.info(`Ghana Super App backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Don't drop in-flight requests on deploy — finish them, then exit.
  // Matters more once this runs behind an ALB doing rolling deploys (spec §47).
  function shutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);
    server!.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      process.exit(0);
    });
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export { app };
