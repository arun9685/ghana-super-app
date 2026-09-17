import { z } from "zod";

export const payUtilitySchema = z.object({
  type: z.enum(["AIRTIME", "DATA", "ELECTRICITY", "WATER", "TV"]),
  provider: z.string().min(1).max(40),
  accountRef: z.string().min(1).max(60),
  amountCents: z.coerce.number().int().positive(),
});
