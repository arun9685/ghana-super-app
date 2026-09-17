import type { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "@/modules/auth/jwt.service";
import { prisma } from "@/database/prisma";
import { logger } from "@/common/logger";
import { env } from "@/config/env";

// Real-time layer: ride status changes, driver location during an active
// trip, and in-app notifications, all pushed instead of polled. This is
// what makes the frontend feel like Uber/Bolt instead of a form that
// refreshes on a timer.
//
// Rooms:
//   user:<userId>            — every connected client joins this; used for
//                               notification.service.ts's push-on-write.
//   driver:<driverProfileId> — drivers join this; matching.service.ts
//                               emits new-assignment offers here.
//   ride:<rideId>             — joined explicitly via "ride:subscribe" by
//                               whoever the ride belongs to (customer or
//                               assigned driver), left on completion.

// eslint-disable-next-line import/no-mutable-exports
export let io: Server;

interface AuthedSocket extends Socket {
  data: { userId: string; roles: string[] };
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data = { userId: payload.sub, roles: payload.roles };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId, roles } = (socket as AuthedSocket).data;
    socket.join(`user:${userId}`);
    logger.info({ userId }, "Socket connected");

    if (roles.includes("DRIVER")) {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { userId } });
      if (driverProfile) socket.join(`driver:${driverProfile.id}`);
    }

    socket.on("ride:subscribe", async (rideId: string) => {
      if (typeof rideId !== "string") return;
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: { driverProfile: true },
      });
      if (!ride) return;
      const isCustomer = ride.customerId === userId;
      const isDriver = ride.driverProfile?.userId === userId;
      if (isCustomer || isDriver) {
        socket.join(`ride:${rideId}`);
      }
    });

    socket.on("ride:unsubscribe", (rideId: string) => {
      if (typeof rideId === "string") socket.leave(`ride:${rideId}`);
    });

    socket.on("disconnect", () => {
      logger.info({ userId }, "Socket disconnected");
    });
  });

  return io;
}
