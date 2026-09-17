// Real integration point: searching/booking real flight or intercity-bus
// inventory means calling a GDS/airline API (Amadeus, Travelport) or a
// bus operator aggregator. Same provider-independent shape as
// SmsProvider/PaymentProvider — nothing in travel.service.ts needs to
// change when a real one is wired in here.
export interface TravelProvider {
  book(input: {
    type: "FLIGHT" | "BUS";
    origin: string;
    destination: string;
    departureDate: Date;
    passengerCount: number;
  }): Promise<{ success: boolean; providerRef: string; priceCents: number }>;
}

class MockTravelProvider implements TravelProvider {
  async book(input: { passengerCount: number }): Promise<{ success: boolean; providerRef: string; priceCents: number }> {
    // Stands in for a real GDS/operator call. Returns a flat mock fare
    // so the booking flow (create → confirm → notify) is exercised end
    // to end — replace with a real search+book call once credentials
    // exist.
    const perSeatCents = 25000; // GHS 250 placeholder fare
    return {
      success: true,
      providerRef: `MOCK-TRAVEL-${Date.now()}`,
      priceCents: perSeatCents * input.passengerCount,
    };
  }
}

export function getTravelProvider(): TravelProvider {
  return new MockTravelProvider();
}
