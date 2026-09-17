import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "@/api/client";
import { ACCRA_LOCATIONS, type NamedPoint } from "@/lib/locations";
import type { FareEstimate, VehicleType } from "@/lib/types";
import { formatMoney } from "@/lib/types";
import TripMap from "@/components/TripMap";
import { Icons } from "@/components/Icons";

// Vehicle-type icons use the POC's single "car" glyph (its icon set has
// no separate okada/tuktuk/van drawings) — differentiated by label and
// accent color instead of a distinct icon per row.
const VEHICLES: { type: VehicleType; label: string; note: string }[] = [
  { type: "MOTORBIKE", label: "Okada", note: "Fastest through traffic" },
  { type: "TUKTUK", label: "Tuk-tuk", note: "Short local trips" },
  { type: "SEDAN", label: "Sankofa Go", note: "Everyday rides" },
  { type: "SUV", label: "Sankofa XL", note: "More room, up to 6" },
];

function PointPicker({
  label,
  value,
  onChange,
  exclude,
}: {
  label: string;
  value: NamedPoint | null;
  onChange: (p: NamedPoint) => void;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = ACCRA_LOCATIONS.filter(
    (p) =>
      p.name !== exclude &&
      (p.name.toLowerCase().includes(query.toLowerCase()) || p.area.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div style={{ position: "relative" }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-600)" }}>{label}</label>
      <input
        className="input"
        style={{ marginTop: 6 }}
        placeholder="Search a location in Accra…"
        value={value ? value.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div
          className="card"
          style={{ position: "absolute", zIndex: 10, top: "100%", left: 0, right: 0, marginTop: 4, padding: 6, maxHeight: 260, overflowY: "auto" }}
        >
          {results.map((p) => (
            <div
              key={p.name}
              style={{ padding: "10px 10px", borderRadius: 8, cursor: "pointer" }}
              onMouseDown={() => {
                onChange(p);
                setQuery("");
                setOpen(false);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-100)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--gray-600)" }}>{p.area}</div>
            </div>
          ))}
          {results.length === 0 && <div style={{ padding: 10, fontSize: 13, color: "var(--gray-600)" }}>No matches</div>}
        </div>
      )}
    </div>
  );
}

export default function BookRide() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<NamedPoint | null>(ACCRA_LOCATIONS[2]);
  const [dropoff, setDropoff] = useState<NamedPoint | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("SEDAN");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MOMO" | "CARD" | "WALLET">("CASH");
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getEstimate(nextVehicle = vehicleType) {
    if (!pickup || !dropoff) return;
    setLoadingEstimate(true);
    setError(null);
    try {
      const res = await api.post("/rides/estimate", {
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.name },
        dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.name },
        vehicleType: nextVehicle,
      });
      setEstimate(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
      setEstimate(null);
    } finally {
      setLoadingEstimate(false);
    }
  }

  async function confirmRide() {
    if (!pickup || !dropoff) return;
    setBooking(true);
    setError(null);
    try {
      const res = await api.post("/rides", {
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.name },
        dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.name },
        vehicleType,
        paymentMethod,
      });
      navigate(`/rides/${res.data.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBooking(false);
    }
  }

  const canEstimate = pickup && dropoff;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
      <div className="card">
        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Where to?</h2>
        <div style={{ display: "grid", gap: 14 }}>
          <PointPicker label="Pickup" value={pickup} onChange={(p) => { setPickup(p); setEstimate(null); }} exclude={dropoff?.name} />
          <PointPicker label="Drop-off" value={dropoff} onChange={(p) => { setDropoff(p); setEstimate(null); }} exclude={pickup?.name} />
        </div>

        {pickup && dropoff && (
          <div style={{ marginTop: 18, borderRadius: 14, overflow: "hidden", border: "1px solid var(--gray-200)" }}>
            <TripMap
              pickup={{ lat: pickup.lat, lng: pickup.lng, address: pickup.name }}
              dropoff={{ lat: dropoff.lat, lng: dropoff.lng, address: dropoff.name }}
            />
          </div>
        )}

        <h3 style={{ fontSize: 15, marginTop: 24, marginBottom: 12 }}>Choose a ride</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {VEHICLES.map((v) => (
            <div
              key={v.type}
              onClick={() => {
                setVehicleType(v.type);
                if (canEstimate) getEstimate(v.type);
              }}
              style={{
                padding: 14,
                borderRadius: 12,
                border: `2px solid ${vehicleType === v.type ? "var(--gold)" : "var(--gray-200)"}`,
                cursor: "pointer",
                background: vehicleType === v.type ? "rgba(240,180,41,0.08)" : "white",
              }}
            >
              <Icons.car s={22} c="var(--green)" />
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{v.label}</div>
              <div style={{ fontSize: 12, color: "var(--gray-600)" }}>{v.note}</div>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: 15, marginTop: 24, marginBottom: 12 }}>Payment method</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["CASH", "MOMO", "CARD", "WALLET"] as const).map((m) => (
            <button
              key={m}
              className={`btn btn-sm ${paymentMethod === m ? "btn-navy" : "btn-outline"}`}
              onClick={() => setPaymentMethod(m)}
            >
              {m === "MOMO" ? "Mobile Money" : m.charAt(0) + m.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {!estimate && canEstimate && (
          <button className="btn btn-gold btn-block" style={{ marginTop: 24 }} onClick={() => getEstimate()} disabled={loadingEstimate}>
            {loadingEstimate ? "Calculating fare…" : "Get fare estimate"}
          </button>
        )}
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 14 }}>{error}</p>}
      </div>

      <div className="card" style={{ position: "sticky", top: 90 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Trip summary</h3>
        {!estimate ? (
          <p style={{ fontSize: 13, color: "var(--gray-600)" }}>
            Pick a pickup and drop-off, then choose a ride to see your fare.
          </p>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--gray-600)" }}>Distance</span>
              <span>{estimate.distanceKm.toFixed(1)} km</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--gray-600)" }}>Estimated time</span>
              <span>{estimate.durationMin} min</span>
            </div>
            <hr style={{ border: "none", borderTop: "1px dashed var(--gray-200)", margin: "12px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--gray-600)" }}>Base fare</span>
              <span>{formatMoney(estimate.fare.baseFareCents, estimate.fare.currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--gray-600)" }}>Distance & time</span>
              <span>{formatMoney(estimate.fare.distanceFareCents + estimate.fare.timeFareCents, estimate.fare.currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--gray-600)" }}>Booking fee</span>
              <span>{formatMoney(estimate.fare.bookingFeeCents, estimate.fare.currency)}</span>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid var(--gray-200)", margin: "12px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>Total</span>
              <span>{formatMoney(estimate.fare.totalCents, estimate.fare.currency)}</span>
            </div>
            <button className="btn btn-gold btn-block" style={{ marginTop: 20 }} onClick={confirmRide} disabled={booking}>
              {booking ? "Requesting driver…" : "Confirm ride"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
