// Real integration point: actually topping up airtime/data or paying a
// bill means calling a telco/utility aggregator's API (e.g. Hubtel,
// Reloadly, or direct MTN/Vodafone/AirtelTigo/ECG/GWCL integrations).
// Same provider-independent shape as SmsProvider and PaymentProvider —
// nothing in utilities.service.ts needs to change when a real one is
// wired in here.
export interface UtilityProvider {
  pay(provider: string, accountRef: string, amountCents: number): Promise<{ success: boolean; providerRef: string }>;
}

class MockUtilityProvider implements UtilityProvider {
  async pay(provider: string, accountRef: string): Promise<{ success: boolean; providerRef: string }> {
    // Stands in for a real aggregator call. Always "succeeds" so the
    // rest of the flow (recording the payment, notifying the user) is
    // exercised end to end — replace with a real HTTP call once
    // credentials exist, and let failures flow through naturally.
    return { success: true, providerRef: `MOCK-UTIL-${provider}-${accountRef}-${Date.now()}` };
  }
}

export function getUtilityProvider(): UtilityProvider {
  return new MockUtilityProvider();
}
