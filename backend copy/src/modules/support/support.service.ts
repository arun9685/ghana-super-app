import { prisma } from "@/database/prisma";
import { ForbiddenError, NotFoundError } from "@/common/errors";
import { notify } from "@/modules/notifications/notifications.service";
import type { TicketStatus } from "@prisma/client";

// spec §32 admin module dependency: support tickets.
export async function createTicket(userId: string, subject: string, description: string, rideId?: string) {
  return prisma.supportTicket.create({
    data: { userId, subject, description, rideId },
  });
}

export async function listMyTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function listAllTickets(status?: TicketStatus) {
  return prisma.supportTicket.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { name: true, phone: true } } },
  });
}

async function assertCanAccessTicket(userId: string, roles: string[], ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  const isOwner = ticket.userId === userId;
  const isAdmin = roles.includes("PLATFORM_ADMIN");
  if (!isOwner && !isAdmin) throw new ForbiddenError("You cannot access this ticket");
  return ticket;
}

export async function getTicket(userId: string, roles: string[], ticketId: string) {
  await assertCanAccessTicket(userId, roles, ticketId);
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function addMessage(userId: string, roles: string[], ticketId: string, body: string) {
  const ticket = await assertCanAccessTicket(userId, roles, ticketId);
  const message = await prisma.supportMessage.create({
    data: { ticketId, senderId: userId, body },
  });
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });

  // Notify the other side of the conversation.
  const notifyUserId = roles.includes("PLATFORM_ADMIN") ? ticket.userId : null;
  if (notifyUserId) {
    await notify({
      userId: notifyUserId,
      type: "SUPPORT_REPLY",
      title: "Support replied to your ticket",
      body: body.slice(0, 140),
      data: { ticketId },
    });
  }

  return message;
}

export async function updateStatus(ticketId: string, status: TicketStatus) {
  const ticket = await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
  await notify({
    userId: ticket.userId,
    type: "SUPPORT_STATUS",
    title: "Your support ticket was updated",
    body: `Ticket "${ticket.subject}" is now ${status.replace("_", " ").toLowerCase()}.`,
    data: { ticketId },
  });
  return ticket;
}
