import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { Ride } from "@/lib/types";
import { formatMoney } from "@/lib/types";
import StatusPill from "@/components/StatusPill";

export default function RideHistory() {
  const navigate = useNavigate();
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    api.get("/rides", { params: { status: "history" } }).then((res) => setRides(res.data.data));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Your trips</h1>
      {rides.length === 0 && <div className="card">No past trips yet — your history will show up here.</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {rides.map((r) => (
          <div
            key={r.id}
            className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => navigate(`/rides/${r.id}`)}
          >
            <div>
              <div style={{ fontWeight: 700 }}>
                {r.pickupAddress} → {r.dropoffAddress}
              </div>
              <div style={{ fontSize: 12, color: "var(--gray-600)", marginTop: 4 }}>
                {new Date(r.createdAt).toLocaleString()} · {r.requestedVehicleType}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>{formatMoney(r.finalFareCents ?? r.estimatedFareCents, r.currency)}</div>
              <StatusPill status={r.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
