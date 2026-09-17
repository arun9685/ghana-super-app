import { z } from "zod";

export const topUpSchema = z.object({
  amountCents: z.coerce.number().int().positive(),
  method: z.enum(["MOBILE_MONEY", "CARD", "CASH"]),
});

export const applyLoanSchema = z.object({
  amountCents: z.coerce.number().int().positive(),
  purpose: z.string().max(200).optional(),
});

export const loanDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(300).optional(),
});
