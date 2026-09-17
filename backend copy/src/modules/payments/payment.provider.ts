// spec §23-25: payment abstraction, MoMo/card/wallet providers. Same
// provider-independent shape as auth/otp.provider.ts's SmsProvider — the
// rest of the codebase depends on this interface, never on a specific
// gateway, so swapping in real MoMo/Paystack/Flutterwave credentials later
// is a one-file change.
export interface PaymentProvider {
  // Returns true if the charge is confirmed synchronously (cash always
  // is — the money is in the driver's hand). Card/MoMo gateways are
  // normally async (the customer approves on their phone), so those
  // return false and a webhook — payments.routes.ts's /confirm endpoint
  // here, standing in for that webhook — completes the payment later.
  charge(paymentId: string, amountCents: number): Promise<{ confirmedImmediately: boolean; providerRef: string }>;
}

class CashPaymentProvider implements PaymentProvider {
  async charge(paymentId: string): Promise<{ confirmedImmediately: boolean; providerRef: string }> {
    return { confirmedImmediately: true, providerRef: `CASH-${paymentId}` };
  }
}

// Stands in for a real MoMo/card gateway in this environment (no
// merchant credentials are available here). It creates the payment in
// PENDING status with a mock provider reference; completion happens via
// POST /payments/webhook — a signed callback (see webhookSignature.ts),
// same as a real gateway would send, never a request the paying customer
// can trigger themselves. Use scripts/simulate-gateway-webhook.ts to fire
// that callback locally. Swap this class's body for an actual MTN MoMo /
// Paystack / Flutterwave API call when credentials exist — the interface,
// the webhook route, and the signature check all stay the same.
class MockGatewayPaymentProvider implements PaymentProvider {
  async charge(paymentId: string): Promise<{ confirmedImmediately: boolean; providerRef: string }> {
    return { confirmedImmediately: false, providerRef: `MOCK-GW-${paymentId}` };
  }
}

export function getPaymentProvider(method: "CASH" | "MOMO" | "CARD" | "WALLET"): PaymentProvider {
  if (method === "CASH") return new CashPaymentProvider();
  return new MockGatewayPaymentProvider();
}
