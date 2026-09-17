import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "@/api/client";
import PageHeader from "@/components/PageHeader";

interface MenuItem {
  id: string;
  name: string;
  priceCents: number;
  isAvailable: boolean;
}
interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  area: string;
  menuItems: MenuItem[];
}

// "Eat" tile home: browse restaurants and their menus. Ordering posts a
// real order to POST /eat/orders — see EatOrders.tsx for order tracking.
export default function EatHome() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, { restaurantId: string; item: MenuItem; qty: number }>>({});

  useEffect(() => {
    api
      .get("/eat/restaurants")
      .then((res) => setRestaurants(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const cartItems = Object.values(cart);
  const cartRestaurantId = cartItems[0]?.restaurantId ?? null;
  const cartTotalCents = cartItems.reduce((sum, c) => sum + c.item.priceCents * c.qty, 0);

  function addToCart(restaurantId: string, item: MenuItem) {
    setCart((prev) => {
      // A cart can only hold items from one restaurant at a time —
      // switching restaurants clears it, same UX every food app uses.
      if (cartRestaurantId && cartRestaurantId !== restaurantId) {
        return { [item.id]: { restaurantId, item, qty: 1 } };
      }
      const existing = prev[item.id];
      return { ...prev, [item.id]: { restaurantId, item, qty: (existing?.qty ?? 0) + 1 } };
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = { ...prev };
      const existing = next[itemId];
      if (!existing) return prev;
      if (existing.qty <= 1) delete next[itemId];
      else next[itemId] = { ...existing, qty: existing.qty - 1 };
      return next;
    });
  }

  async function placeOrder() {
    if (!cartRestaurantId || cartItems.length === 0) return;
    setError(null);
    try {
      const res = await api.post("/eat/orders", {
        restaurantId: cartRestaurantId,
        items: cartItems.map((c) => ({ menuItemId: c.item.id, quantity: c.qty })),
        deliveryAddress: "My saved address",
        deliveryLat: 5.6037,
        deliveryLng: -0.187,
        paymentMethod: "CASH",
      });
      setCart({});
      navigate(`/eat/orders/${res.data.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (loading) return <p style={{ color: "var(--gray-600)" }}>Loading restaurants…</p>;

  return (
    <div>
      <PageHeader
        icon="food"
        color="var(--red)"
        title="Eat"
        subtitle="Order from kitchens near you."
        action={
          <button className="btn btn-outline btn-sm" onClick={() => navigate("/eat/orders")}>
            My orders
          </button>
        }
      />

      {error && <p style={{ color: "var(--red)", marginBottom: 14 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {restaurants.map((r) => (
            <div key={r.id} className="card fade-up">
              <div className="gradient-accent-bar" />
              <div style={{ fontWeight: 700, fontSize: 18 }}>{r.name}</div>
              <div style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 12 }}>
                {r.area} {r.description ? `· ${r.description}` : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {r.menuItems.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: "var(--gray-600)" }}>GHS {(item.priceCents / 100).toFixed(2)}</div>
                    </div>
                    <button className="btn btn-navy btn-sm" onClick={() => addToCart(r.id, item)}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {restaurants.length === 0 && <p style={{ color: "var(--gray-600)" }}>No restaurants available yet.</p>}
        </div>

        <div className="card" style={{ position: "sticky", top: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Your order</div>
          {cartItems.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--gray-600)" }}>Add items from a restaurant to get started.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {cartItems.map((c) => (
                  <div key={c.item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13 }}>
                      {c.qty}× {c.item.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13 }}>GHS {((c.item.priceCents * c.qty) / 100).toFixed(2)}</span>
                      <button className="btn btn-outline btn-sm" onClick={() => removeFromCart(c.item.id)}>
                        −
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 14, borderTop: "1px solid var(--gray-200)", paddingTop: 10 }}>
                <span>Subtotal</span>
                <span>GHS {(cartTotalCents / 100).toFixed(2)}</span>
              </div>
              <button className="btn btn-gold btn-block" onClick={placeOrder}>
                Place order
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
