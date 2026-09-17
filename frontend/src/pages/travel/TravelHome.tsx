import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/api/client";
import PageHeader from "@/components/PageHeader";
import { Icons } from "@/components/Icons";

interface Booking {
  id: string;
  type: string;
  origin: string;
  destination: string;
  departureDate: string;
  passengerCount: number;
  status: string;
  priceCents: number | null;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "pill-gray",
  CONFIRMED: "pill-green",
  CANCELLED: "pill-red",
  COMPLETED: "pill-navy",
};

// "Travel" tile: flight & inter-city bus bookings. Fares here come
// from a mock provider (backend travel.provider.ts) until a real
// GDS/bus-operator integration is wired in — the booking flow itself
// (create → confirm → cancel) is real end to end.
export default function TravelHome() {
  const [type, setType] = useState<"FLIGHT" | "BUS">("BUS");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get("/travel/bookings").then((res) => setBookings(res.data.data)).catch(() => {});
  }

  useEffect(load, []);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/travel/bookings", { type, origin, destination, departureDate, passengerCount });
      setOrigin("");
      setDestination("");
      setDepartureDate("");
      setPassengerCount(1);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    try {
      await api.post(`/travel/bookings/${id}/cancel`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader icon="plane" color="var(--service-travel)" title="Travel" subtitle="Fly across the continent." />

      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className={`btn btn-sm ${type === "BUS" ? "btn-navy" : "btn-outline"}`} onClick={() => setType("BUS")} type="button" style={{ gap: 6 }}>
              <Icons.truck s={14} c={type === "BUS" ? "#fff" : "var(--slate)"} /> Bus
            </button>
            <button className={`btn btn-sm ${type === "FLIGHT" ? "btn-navy" : "btn-outline"}`} onClick={() => setType("FLIGHT")} type="button" style={{ gap: 6 }}>
              <Icons.plane s={14} c={type === "FLIGHT" ? "#fff" : "var(--slate)"} /> Flight
            </button>
          </div>
          <form onSubmit={book}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>From</label>
            <input className="input" style={{ marginTop: 6, marginBottom: 10 }} value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Accra" required />
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>To</label>
            <input className="input" style={{ marginTop: 6, marginBottom: 10 }} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Kumasi" required />
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Departure date</label>
            <input className="input" style={{ marginTop: 6, marginBottom: 10 }} type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} required />
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Passengers</label>
            <input
              className="input"
              style={{ marginTop: 6, marginBottom: 16 }}
              type="number"
              min={1}
              max={10}
              value={passengerCount}
              onChange={(e) => setPassengerCount(parseInt(e.target.value, 10) || 1)}
            />
            <button className="btn btn-gold btn-block" disabled={busy}>
              {busy ? "Booking…" : "Search & book"}
            </button>
          </form>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>My bookings</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bookings.map((b) => (
              <div key={b.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--gray-200)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                    {b.type === "FLIGHT" ? <Icons.plane s={14} c="var(--service-travel)" /> : <Icons.truck s={14} c="var(--service-travel)" />}
                    {b.origin} → {b.destination}
                  </div>
                  <span className={`pill ${STATUS_COLOR[b.status] ?? "pill-gray"}`}>{b.status}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--gray-600)", marginTop: 4 }}>
                  {new Date(b.departureDate).toLocaleDateString()} · {b.passengerCount} passenger{b.passengerCount > 1 ? "s" : ""}
                  {b.priceCents != null ? ` · GHS ${(b.priceCents / 100).toFixed(2)}` : ""}
                </div>
                {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => cancel(b.id)}>
                    Cancel
                  </button>
                )}
              </div>
            ))}
            {bookings.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No bookings yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
