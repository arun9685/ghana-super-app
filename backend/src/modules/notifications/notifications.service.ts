import { prisma } from "@/database/prisma";
import { logger } from "@/common/logger";
import { io } from "@/realtime/socket";
import type { NotificationChannel, Prisma } from "@prisma/client";

// spec §31: push/SMS/email dispatch abstraction. Every other module calls
// `notify()` instead of writing to the notifications table directly, so
// there is exactly one place that (a) persists the notification and
// (b) actually delivers it — mirroring the SmsProvider pattern in
// auth/otp.provider.ts. Only INAPP (via socket) is "really" implemented;
// PUSH/SMS/EMAIL log a would-be dispatch until a real provider is wired
// in, same honesty as the SMS provider stubs.
export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: NotificationChannel;
}

export async function notify(input: NotifyInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      channel: input.channel ?? "INAPP",
      type: input.type,
      title: input.title,
      body: input.body,
      data: (input.data as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // In-app delivery is real: push it down the user's socket room so the
  // frontend updates without polling.
  io.to(`user:${input.userId}`).emit("notification:new", notification);

  if (input.channel === "PUSH" || input.channel === "SMS" || input.channel === "EMAIL") {
    logger.info(
      { userId: input.userId, channel: input.channel },
      `[DEV ${input.channel}] Would send "${input.title}" — wire a real ${input.channel} provider to deliver this outside the app`
    );
  }

  return notification;
}

export async function listForUser(userId: string, opts: { unreadOnly?: boolean; take?: number; skip?: number }) {
  return prisma.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 30,
    skip: opts.skip ?? 0,
  });
}

export async function markRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
