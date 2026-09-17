import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "@/api/client";
import { getSocket } from "@/api/socket";
import type { Ride } from "@/lib/types";
import { formatMoney } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import TripMap from "@/components/TripMap";
import Stars from "@/components/Stars";

export default function RideTracking() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  async function load() {
    if (!id) return;
    try {
      const res = await api.get(`/rides/${id}`);
      setRide(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit("ride:subscribe", id);

    const onStatus = (payload: { rideId: string; status: string }) => {
      if (payload.rideId === id) load();
    };
    const onLocation = (payload: { rideId: string; lat: number; lng: number }) => {
      if (payload.rideId === id) setDriverPos({ lat: payload.lat, lng: payload.lng });
    };
    socket.on("ride:status", onStatus);
    socket.on("driver:location", onLocation);
    return () => {
      socket.emit("ride:unsubscribe", id);
      socket.off("ride:status", onStatus);
      socket.off("driver:location", onLocation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function cancelRide() {
    if (!id) return;
    try {
      await api.post(`/rides/${id}/cancel`, { reason: "Changed my mind" });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitRating() {
    if (!id) return;
    try {
      await api.post("/ratings", { rideId: id, stars, comment: comment || undefined });
      setRated(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (!ride) {
    return <div className="card">{error ?? "Loading ride…"}</div>;
  }

  const isSearching = ride.status === "SEARCHING" || ride.status === "REQUESTED";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20 }}>Your trip</h2>
          <StatusPill status={ride.status} />
        </div>

        {isSearching && (
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <div className="pulse-dot" style={{ fontSize: 40 }}>🔎</div>
            <p style={{ marginTop: 12, color: "var(--gray-600)" }}>Looking for a nearby driver…</p>
          </div>
        )}

        {ride.status === "NO_DRIVERS_FOUND" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: "var(--red)", fontWeight: 600 }}>No drivers were available nearby.</p>
            <button className="btn btn-gold" style={{ marginTop: 12 }} onClick={() => navigate("/book")}>
              Try again
            </button>
          </div>
        )}

        {!isSearching && (
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--gray-200)", marginBottom: 18 }}>
            <TripMap
              pickup={{ lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress }}
              dropoff={{ lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress }}
              driver={driverPos}
            />
          </div>
        )}

        <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <div>
            <strong>Pickup:</strong> {ride.pickupAddress}
          </div>
          <div>
            <strong>Drop-off:</strong> {ride.dropoffAddress}
          </div>
          {ride.distanceKm && (
            <div style={{ color: "var(--gray-600)" }}>
              {ride.distanceKm.toFixed(1)} km · ~{ride.durationMin} min
            </div>
          )}
        </div>

        {ride.driverProfile && (
          <div className="card" style={{ marginTop: 18, background: "var(--gray-100)", boxShadow: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{ride.driverProfile.user.name ?? "Your driver"}</div>
                <div style={{ fontSize: 13, color: "var(--gray-600)" }}>
                  ⭐ {ride.driverProfile.ratingAvg.toFixed(1)} · {ride.driverProfile.user.phone}
                </div>
              </div>
              {ride.driverProfile.vehicle && (
                <div style={{ textAlign: "right", fontSize: 13 }}>
                  <div style={{ fontWeight: 700 }}>{ride.driverProfile.vehicle.plateNumber}</div>
                  <div style={{ color: "var(--gray-600)" }}>
                    {ride.driverProfile.vehicle.color} {ride.driverProfile.vehicle.make} {ride.driverProfile.vehicle.model}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {ride.status === "COMPLETED" && !rated && (
          <div className="card" style={{ marginTop: 18, background: "var(--gray-100)", boxShadow: "none", textAlign: "center" }}>
            <p style={{ fontWeight: 700, marginBottom: 10 }}>Rate your trip</p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Stars value={stars} onChange={setStars} />
            </div>
            <textarea
              className="input"
              style={{ marginTop: 12, minHeight: 60 }}
              placeholder="Leave a comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button className="btn btn-gold btn-block" style={{ marginTop: 10 }} onClick={submitRating}>
              Submit rating
            </button>
          </div>
        )}
        {ride.status === "COMPLETED" && rated && (
          <p style={{ marginTop: 16, color: "var(--green)", fontWeight: 600, textAlign: "center" }}>Thanks for rating your trip! 🙏</p>
        )}

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 14 }}>{error}</p>}
      </div>

      <div className="card" style={{ position: "sticky", top: 90 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Fare</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
          <span>Total</span>
          <span>{formatMoney(ride.finalFareCents ?? ride.estimatedFareCents, ride.currency)}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--gray-600)", marginBottom: 16 }}>
          Paying by {ride.paymentMethod === "MOMO" ? "Mobile Money" : ride.paymentMethod.toLowerCase()}
        </div>

        {["REQUESTED", "SEARCHING", "ASSIGNED", "ARRIVED"].includes(ride.status) && (
          <button className="btn btn-outline btn-block" onClick={cancelRide}>
            Cancel ride
          </button>
        )}
        {(ride.status === "COMPLETED" || ride.status === "CANCELLED" || ride.status === "NO_DRIVERS_FOUND") && (
          <button className="btn btn-navy btn-block" onClick={() => navigate("/")}>
            Back to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
