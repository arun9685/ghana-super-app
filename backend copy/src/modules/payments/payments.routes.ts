import { Router, type Request } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { UnauthorizedError, ValidationError } from "@/common/errors";
import { env } from "@/config/env";
import { verifyWebhookSignature } from "@/modules/payments/webhookSignature";
import { gatewayWebhookSchema } from "@/modules/payments/payments.validation";
import * as paymentsService from "@/modules/payments/payments.service";
import { webhookRateLimiter } from "@/middleware/rateLimiter";

// spec §23-25.
export const paymentsRouter = Router();

paymentsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payments = await paymentsService.listMyPayments(authReq.user!.id);
    res.status(200).json({ success: true, data: payments });
  })
);

paymentsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payment = await paymentsService.getPayment(authReq.user!.id, req.params.id!);
    res.status(200).json({ success: true, data: payment });
  })
);

// Real gateway callback (spec §24) — NOT behind requireAuth. A payment
// gateway calling this has no user session; it authenticates with an
// HMAC signature over the raw request body instead (verified below), the
// same scheme MoMo/Paystack/Flutterwave webhooks use. This deliberately
// replaces the earlier `POST /:id/confirm` endpoint, which let the paying
// customer's own JWT mark their own payment PAID with no proof money ever
// moved — see payments.service.ts's processGatewayWebhook for the full
// rationale, and scripts/simulate-gateway-webhook.ts to call this locally.
paymentsRouter.post(
  "/webhook",
  webhookRateLimiter,
  asyncHandler(async (req, res) => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.header("X-Signature");
    if (!rawBody || !verifyWebhookSignature(rawBody, signature, env.PAYMENT_WEBHOOK_SECRET)) {
      throw new UnauthorizedError("Invalid or missing webhook signature");
    }

    const parsed = gatewayWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid webhook payload", parsed.error.flatten().fieldErrors);
    }

    const payment = await paymentsService.processGatewayWebhook(parsed.data, { ipAddress: req.ip });
    res.status(200).json({ success: true, data: payment });
  })
);
