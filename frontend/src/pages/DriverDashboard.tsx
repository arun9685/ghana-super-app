import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "@/api/client";
import { getSocket } from "@/api/socket";
import type { Ride } from "@/lib/types";
import { formatMoney } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import { ACCRA_LOCATIONS } from "@/lib/locations";

interface DriverProfile {
  id: string;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  isOnline: boolean;
  ratingAvg: number;
  completedRideCount: number;
  vehicle: { make: string; model: string; plateNumber: string; type: string } | null;
}

// No GPS hardware in a typical browser-in-a-VM demo environment, so
// "current position" falls back to a real Accra coordinate (Osu) when
// the browser's Geolocation API is unavailable or denied — the ping
// endpoint itself is the real thing either way.
const FALLBACK_POS = { lat: ACCRA_LOCATIONS[2].lat, lng: ACCRA_LOCATIONS[2].lng };

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [online, setOnline] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const watchId = useRef<number | null>(null);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const res = await api.get("/drivers/me");
      setProfile(res.data.data);
      setOnline(res.data.data.isOnline);
    } catch {
      /* no application yet */
    }
    try {
      const activeRes = await api.get("/rides/active-for-driver");
      setActiveRide(activeRes.data.data);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    const onAssignment = () => load();
    const onStatus = () => load();
    socket.on("ride:new_assignment", onAssignment);
    socket.on("ride:status", onStatus);
    return () => {
      socket.off("ride:new_assignment", onAssignment);
      socket.off("ride:status", onStatus);
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
      if (pingInterval.current) clearInterval(pingInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function currentPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(FALLBACK_POS);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(FALLBACK_POS),
        { timeout: 4000 }
      );
    });
  }

  async function ping() {
    const pos = await currentPosition();
    api.post("/locations/ping", pos).catch(() => {});
  }

  async function toggleOnline() {
    setBusy(true);
    setError(null);
    try {
      if (!online) {
        await api.post("/locations/online");
        await ping();
        pingInterval.current = setInterval(ping, 6000);
        setOnline(true);
      } else {
        await api.post("/locations/offline");
        if (pingInterval.current) clearInterval(pingInterval.current);
        setOnline(false);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "arrived" | "start" | "complete") {
    if (!activeRide) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/rides/${activeRide.id}/${action}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, marginBottom: 10 }}>You're not registered as a driver yet</h2>
        <p style={{ color: "var(--gray-600)", marginBottom: 18 }}>Apply once and start earning with Sankofa.</p>
        <button className="btn btn-gold" onClick={() => navigate("/drive/apply")}>
          Apply to drive
        </button>
      </div>
    );
  }

  if (profile.verificationStatus !== "APPROVED") {
    return (
      <div className="card" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, marginBottom: 10 }}>
          {profile.verificationStatus === "PENDING" ? "Application under review" : "Application needs attention"}
        </h2>
        <p style={{ color: "var(--gray-600)" }}>
          {profile.verificationStatus === "PENDING"
            ? "An admin is reviewing your documents. This usually takes a short while."
            : profile.rejectionReason ?? "Please contact support."}
        </p>
        {profile.verificationStatus === "REJECTED" && (
          <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={() => navigate("/drive/apply")}>
            Re-apply
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
      <div>
        {!activeRide && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{online ? "🟢" : "⚪️"}</div>
            <h2 style={{ fontSize: 20 }}>{online ? "You're online" : "You're offline"}</h2>
            <p style={{ color: "var(--gray-600)", margin: "8px 0 20px" }}>
              {online ? "Waiting for a ride request nearby…" : "Go online to start receiving ride requests."}
            </p>
            <button className={`btn ${online ? "btn-danger" : "btn-gold"}`} onClick={toggleOnline} disabled={busy}>
              {online ? "Go offline" : "Go online"}
            </button>
          </div>
        )}

        {activeRide && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18 }}>Active trip</h2>
              <StatusPill status={activeRide.status} />
            </div>
            <div style={{ display: "grid", gap: 6, fontSize: 14, marginBottom: 18 }}>
              <div>
                <strong>Pickup:</strong> {activeRide.pickupAddress}
              </div>
              <div>
                <strong>Drop-off:</strong> {activeRide.dropoffAddress}
              </div>
              <div style={{ color: "var(--gray-600)" }}>
                Passenger: {activeRide.customer?.name ?? "Rider"} · {activeRide.customer?.phone}
              </div>
              <div style={{ fontWeight: 700 }}>{formatMoney(activeRide.estimatedFareCents, activeRide.currency)}</div>
            </div>

            {activeRide.status === "ASSIGNED" && (
              <button className="btn btn-gold btn-block" onClick={() => act("arrived")} disabled={busy}>
                I've arrived at pickup
              </button>
            )}
            {activeRide.status === "ARRIVED" && (
              <button className="btn btn-gold btn-block" onClick={() => act("start")} disabled={busy}>
                Start trip
              </button>
            )}
            {activeRide.status === "IN_PROGRESS" && (
              <button className="btn btn-gold btn-block" onClick={() => act("complete")} disabled={busy}>
                Complete trip
              </button>
            )}
          </div>
        )}
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 14 }}>{error}</p>}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 14 }}>Your stats</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
          <span style={{ color: "var(--gray-600)" }}>Rating</span>
          <span style={{ fontWeight: 700 }}>⭐ {profile.ratingAvg.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
          <span style={{ color: "var(--gray-600)" }}>Completed trips</span>
          <span style={{ fontWeight: 700 }}>{profile.completedRideCount}</span>
        </div>
        {profile.vehicle && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--gray-200)", fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>{profile.vehicle.plateNumber}</div>
            <div style={{ color: "var(--gray-600)" }}>
              {profile.vehicle.make} {profile.vehicle.model} · {profile.vehicle.type}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
