import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(120),
  description: z.string().min(3).max(2000),
  rideId: z.string().uuid().optional(),
});

export const addMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const updateStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});
