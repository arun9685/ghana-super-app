# ADR 0002: Payment confirmation moves from customer-authenticated to webhook-authenticated

## Status
Accepted

## Context
The original implementation exposed `POST /payments/:id/confirm`, callable by
the paying customer's own JWT, which marked their own payment `PAID`. That
meant a customer (or anyone who obtained their access token) could mark any
of their own pending payments as paid without money ever actually moving —
a direct fraud vector once real payment gateways (MoMo, cards) are wired in
behind `payment.provider.ts`.

## Decision
Replace that endpoint with `POST /payments/webhook`: a callback the payment
gateway itself calls, authenticated by an HMAC-SHA256 signature computed over
the *raw* request body (`PAYMENT_WEBHOOK_SECRET`), verified in
`webhookSignature.ts` before `payments.service.ts` ever sees the payload. No
customer JWT is involved in marking a payment paid; only a request that can
produce a valid signature (i.e., the real gateway, which shares the secret)
can.

`main.ts`'s `express.json()` `verify` hook captures the exact raw bytes onto
`req.rawBody` specifically because signature verification must run over the
bytes as sent — re-serializing `req.body` back to JSON is not guaranteed to
produce an identical byte string (key order, whitespace), which would make
signature verification fail unpredictably.

## Consequences
**Gained:**
- A customer can no longer self-confirm their own payment; the only path to
  `PAID` is a correctly-signed callback, matching how MoMo/Paystack/
  Flutterwave webhooks actually work in production.
- Every state change (`PAID`, `FAILED`) is written to an audit log
  (`AuditLog` model) for after-the-fact investigation.
- `scripts/simulate-gateway-webhook.ts` lets a developer exercise the same
  path locally without a real gateway account, by computing a valid
  signature the same way a real gateway would.

**Given up / accepted risk:**
- The webhook secret is a single shared value (`PAYMENT_WEBHOOK_SECRET`) — if
  a real gateway integration supports per-endpoint or rotating secrets, this
  should move to whatever that gateway's own scheme is rather than staying a
  single static value.
- The webhook endpoint's own rate limiting (`webhookRateLimiter`) is a flat
  ceiling, not gateway-IP-aware; fine while there is exactly one gateway
  integration, worth revisiting if that ever becomes several.

## Revisit when
A real payment gateway is wired in behind `payment.provider.ts` — confirm its
actual webhook signing scheme (some sign the raw body like this, some sign a
concatenation of specific fields) and adjust `webhookSignature.ts` to match
exactly, rather than assuming this HMAC-over-raw-body scheme is universal.
