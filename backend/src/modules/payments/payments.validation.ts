import { z } from "zod";

// Shape of the callback a real MoMo/card gateway sends when a charge
// settles (or fails). paymentId identifies our record; providerRef is the
// gateway's own reference, recorded for reconciliation.
export const gatewayWebhookSchema = z.object({
  paymentId: z.string().uuid(),
  providerRef: z.string().min(1),
  status: z.enum(["PAID", "FAILED"]),
  failureReason: z.string().optional(),
});

export type GatewayWebhookInput = z.infer<typeof gatewayWebhookSchema>;
