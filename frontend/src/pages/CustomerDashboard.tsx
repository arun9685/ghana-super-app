import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { Ride } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import { Icons, type IconName } from "@/components/Icons";

// Same eight tiles, same per-service accent colors and icon names as the
// approved POC's `SERVICES` array (sankofa-app.jsx / sankofa-web.jsx).
const TILES: { key: string; icon: IconName; label: string; desc: string; to: string; color: string; live: boolean }[] = [
  { key: "move", icon: "car", label: "Move", desc: "Book a ride across Accra", to: "/book", color: "var(--green)", live: true },
  { key: "eat", icon: "food", label: "Eat", desc: "Order from kitchens near you", to: "/eat", color: "var(--red)", live: true },
  { key: "utility", icon: "bolt", label: "Utilities", desc: "Airtime, power and water", to: "/utilities", color: "var(--blue)", live: true },
  { key: "fix", icon: "tool", label: "Fix", desc: "Verified home service providers", to: "/fix", color: "var(--teal)", live: true },
  { key: "liquidity", icon: "wallet", label: "Liquidity", desc: "Wallet & micro-loans", to: "/liquidity", color: "var(--gold-dark)", live: true },
  { key: "fleet", icon: "truck", label: "Fleet", desc: "Manage company vehicles", to: "/fleet", color: "var(--purple)", live: true },
  { key: "property", icon: "home", label: "Property", desc: "Rent or buy across Ghana", to: "/property", color: "var(--brown)", live: true },
  { key: "travel", icon: "plane", label: "Travel", desc: "Fly across the continent", to: "/travel", color: "var(--service-travel)", live: true },
];

export default function CustomerDashboard() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  useEffect(() => {
    api
      .get("/rides", { params: { status: "active" } })
      .then((res) => setActiveRide(res.data.data[0] ?? null))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26 }}>Akwaaba, {me?.name ?? "there"}</h1>
        <p style={{ color: "var(--slate)", marginTop: 4 }}>What would you like to do today?</p>
      </div>

      <div
        className="hero-gradient fade-up"
        style={{ marginBottom: 24, padding: "22px 24px", cursor: "pointer" }}
        onClick={() => navigate("/book")}
      >
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <Icons.search s={18} c="rgba(255,255,255,0.8)" />
          <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Where are you going?</span>
        </div>
      </div>

      {activeRide && (
        <div
          className="card fade-up"
          style={{
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            background: "var(--ink)",
            color: "white",
          }}
          onClick={() => navigate(`/rides/${activeRide.id}`)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, background: "#4ade80", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                {activeRide.pickupAddress} → {activeRide.dropoffAddress}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Trip in progress</div>
            </div>
          </div>
          <StatusPill status={activeRide.status} />
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, marginBottom: 12 }}>Services</div>
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {TILES.map((tile) => {
          const Icon = Icons[tile.icon];
          return (
            <div
              key={tile.key}
              className={`card tile-card${tile.live ? "" : " tile-disabled"}`}
              onClick={() => tile.live && navigate(tile.to)}
            >
              <div className="tile-icon-badge" style={{ background: `${tile.color}1a` }}>
                <Icon s={20} c={tile.color} />
              </div>
              <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>{tile.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--slate)", marginTop: 3 }}>{tile.desc}</div>
              {!tile.live && (
                <span className="pill pill-gray" style={{ position: "absolute", top: 16, right: 16 }}>
                  Soon
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
