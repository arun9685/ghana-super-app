import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "@/api/client";

interface OrderItem {
  id: string;
  quantity: number;
  unitPriceCents: number;
  menuItem: { name: string };
}
interface Order {
  id: string;
  status: string;
  totalCents: number;
  deliveryAddress: string;
  createdAt: string;
  restaurant: { name: string };
  items: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

// Handles both the list view (/eat/orders) and a single-order detail
// view (/eat/orders/:id) so the same data-fetching pattern isn't
// duplicated across two files.
export default function EatOrders() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      api
        .get(`/eat/orders/${id}`)
        .then((res) => setOrder(res.data.data))
        .catch((err) => setError(apiErrorMessage(err)));
      const interval = setInterval(() => {
        api.get(`/eat/orders/${id}`).then((res) => setOrder(res.data.data)).catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    }
    api
      .get("/eat/orders")
      .then((res) => setOrders(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [id]);

  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;

  if (id) {
    if (!order) return <p style={{ color: "var(--gray-600)" }}>Loading order…</p>;
    return (
      <div>
        <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate("/eat/orders")}>
          ← All orders
        </button>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{order.restaurant.name}</div>
              <div style={{ fontSize: 13, color: "var(--gray-600)" }}>Delivering to {order.deliveryAddress}</div>
            </div>
            <span className="pill pill-gold">{STATUS_LABEL[order.status] ?? order.status}</span>
          </div>
          <div style={{ margin: "16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {order.items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>
                  {it.quantity}× {it.menuItem.name}
                </span>
                <span>GHS {((it.unitPriceCents * it.quantity) / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--gray-200)", paddingTop: 10 }}>
            <span>Total</span>
            <span>GHS {(order.totalCents / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>My food orders</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {orders.map((o) => (
          <div key={o.id} className="card" style={{ cursor: "pointer" }} onClick={() => navigate(`/eat/orders/${o.id}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{o.restaurant.name}</div>
                <div style={{ fontSize: 12, color: "var(--gray-600)" }}>{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <span className="pill pill-gold">{STATUS_LABEL[o.status] ?? o.status}</span>
            </div>
          </div>
        ))}
        {orders.length === 0 && <p style={{ color: "var(--gray-600)" }}>No orders yet — head to Eat to place one.</p>}
      </div>
    </div>
  );
}
