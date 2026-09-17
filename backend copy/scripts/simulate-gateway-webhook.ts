// Local dev tool only: fires a correctly-signed payment webhook callback
// exactly the way a real MoMo/card gateway would, so you can move a
// PENDING mock-gateway payment to PAID/FAILED without needing a real
// gateway account — this is what replaced the old "customer confirms
// their own payment" endpoint (see payments.routes.ts / payments.service.ts
// for why that was a fraud risk).
//
// Usage:
//   npm run simulate:webhook -- <paymentId> PAID
//   npm run simulate:webhook -- <paymentId> FAILED "Insufficient funds"
//
// Requires PAYMENT_WEBHOOK_SECRET and the API base URL to match a running
// instance of this backend (defaults to http://localhost:3000/api/v1).
import "dotenv/config";
import { computeWebhookSignature } from "../src/modules/payments/webhookSignature";

async function main() {
  const [paymentId, status = "PAID", failureReason] = process.argv.slice(2);
  if (!paymentId) {
    console.error("Usage: npm run simulate:webhook -- <paymentId> [PAID|FAILED] [failureReason]");
    process.exit(1);
  }
  if (status !== "PAID" && status !== "FAILED") {
    console.error(`Invalid status "${status}" — must be PAID or FAILED`);
    process.exit(1);
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PAYMENT_WEBHOOK_SECRET is not set — check your .env");
    process.exit(1);
  }

  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3000/api/v1";
  const payload = {
    paymentId,
    providerRef: `SIM-${Date.now()}`,
    status,
    ...(failureReason ? { failureReason } : {}),
  };
  const rawBody = JSON.stringify(payload);
  const signature = computeWebhookSignature(rawBody, secret);

  const res = await fetch(`${baseUrl}/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signature },
    body: rawBody,
  });

  const body = await res.json().catch(() => null);
  console.log(`HTTP ${res.status}`, body);
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
