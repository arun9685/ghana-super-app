// Real integration point: syncing a restaurant's live menu/availability
// and pushing order status to their kitchen system would go through this
// interface — same "provider-independent" shape as SmsProvider and
// PaymentProvider elsewhere in this codebase. Today, menu data lives
// directly in Postgres (seeded / entered by restaurant owners through
// the API below) and this class is a documented no-op — wire a real POS
// integration (Chowdeck-style vendor API, Square, a custom system) by
// implementing this interface and calling it from eat.service.ts where
// noted.
export interface RestaurantPosProvider {
  notifyNewOrder(restaurantId: string, orderId: string): Promise<void>;
  pushMenuUpdate(restaurantId: string): Promise<void>;
}

class NoopRestaurantPosProvider implements RestaurantPosProvider {
  async notifyNewOrder(): Promise<void> {
    // No real POS connected yet — the restaurant sees new orders through
    // this app's own order list (GET /eat/orders) instead.
  }
  async pushMenuUpdate(): Promise<void> {
    // No-op until a real POS/inventory system is connected.
  }
}

export function getRestaurantPosProvider(): RestaurantPosProvider {
  return new NoopRestaurantPosProvider();
}
