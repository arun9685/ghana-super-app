import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/api/client";
import { formatMoney } from "@/lib/types";

interface Stats {
  totalUsers: number;
  totalDrivers: number;
  pendingDrivers: number;
  ridesToday: number;
  completedRidesToday: number;
  activeRides: number;
  revenueTodayCents: number;
}

interface PendingDriver {
  id: string;
  verificationStatus: string;
  licenseNumber: string | null;
  user: { name: string | null; phone: string };
  vehicle: { make: string; model: string; plateNumber: string; type: string } | null;
}

interface PendingArtisan {
  id: string;
  category: string;
  bio: string | null;
  user: { name: string | null; phone: string };
}

interface PendingListing {
  id: string;
  title: string;
  area: string;
  priceCents: number;
  type: string;
  owner: { name: string | null; phone: string };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: "var(--gray-600)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingDriver[]>([]);
  const [pendingArtisans, setPendingArtisans] = useState<PendingArtisan[]>([]);
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "drivers" | "artisans" | "listings">("overview");

  async function load() {
    try {
      const [statsRes, driversRes, artisansRes, listingsRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/drivers", { params: { status: "PENDING" } }),
        api.get("/admin/artisans", { params: { status: "PENDING" } }),
        api.get("/admin/property/listings", { params: { status: "PENDING_REVIEW" } }),
      ]);
      setStats(statsRes.data.data);
      setPending(driversRes.data.data);
      setPendingArtisans(artisansRes.data.data);
      setPendingListings(listingsRes.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function verify(driverProfileId: string, status: "APPROVED" | "REJECTED") {
    const reason = status === "REJECTED" ? window.prompt("Reason for rejection (shown to the driver):") ?? undefined : undefined;
    try {
      await api.patch(`/admin/drivers/${driverProfileId}/verify`, { status, reason });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function verifyArtisan(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await api.patch(`/admin/artisans/${id}/verify`, { status });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function moderateListing(id: string, status: "ACTIVE" | "REMOVED") {
    try {
      await api.patch(`/admin/property/listings/${id}/status`, { status });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Admin dashboard</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`btn btn-sm ${tab === "overview" ? "btn-navy" : "btn-outline"}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button className={`btn btn-sm ${tab === "drivers" ? "btn-navy" : "btn-outline"}`} onClick={() => setTab("drivers")}>
          Driver verification {pending.length > 0 && `(${pending.length})`}
        </button>
        <button className={`btn btn-sm ${tab === "artisans" ? "btn-navy" : "btn-outline"}`} onClick={() => setTab("artisans")}>
          Artisan verification {pendingArtisans.length > 0 && `(${pendingArtisans.length})`}
        </button>
        <button className={`btn btn-sm ${tab === "listings" ? "btn-navy" : "btn-outline"}`} onClick={() => setTab("listings")}>
          Property review {pendingListings.length > 0 && `(${pendingListings.length})`}
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", marginBottom: 14 }}>{error}</p>}

      {tab === "overview" && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          <StatCard label="Total users" value={stats.totalUsers} />
          <StatCard label="Approved drivers" value={stats.totalDrivers} />
          <StatCard label="Pending drivers" value={stats.pendingDrivers} />
          <StatCard label="Rides today" value={stats.ridesToday} />
          <StatCard label="Completed today" value={stats.completedRidesToday} />
          <StatCard label="Active now" value={stats.activeRides} />
          <StatCard label="Revenue today" value={formatMoney(stats.revenueTodayCents)} />
        </div>
      )}

      {tab === "drivers" && (
        <div style={{ display: "grid", gap: 12 }}>
          {pending.length === 0 && <div className="card">No pending driver applications.</div>}
          {pending.map((d) => (
            <div key={d.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{d.user.name ?? "Unnamed"} · {d.user.phone}</div>
                <div style={{ fontSize: 13, color: "var(--gray-600)", marginTop: 4 }}>
                  License: {d.licenseNumber ?? "—"}
                  {d.vehicle && ` · ${d.vehicle.make} ${d.vehicle.model} (${d.vehicle.plateNumber})`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-outline" onClick={() => verify(d.id, "REJECTED")}>
                  Reject
                </button>
                <button className="btn btn-sm btn-gold" onClick={() => verify(d.id, "APPROVED")}>
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "artisans" && (
        <div style={{ display: "grid", gap: 12 }}>
          {pendingArtisans.length === 0 && <div className="card">No pending artisan applications.</div>}
          {pendingArtisans.map((a) => (
            <div key={a.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{a.user.name ?? "Unnamed"} · {a.user.phone}</div>
                <div style={{ fontSize: 13, color: "var(--gray-600)", marginTop: 4 }}>
                  {a.category.replace(/_/g, " ")} {a.bio && `· ${a.bio}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-outline" onClick={() => verifyArtisan(a.id, "REJECTED")}>
                  Reject
                </button>
                <button className="btn btn-sm btn-gold" onClick={() => verifyArtisan(a.id, "APPROVED")}>
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "listings" && (
        <div style={{ display: "grid", gap: 12 }}>
          {pendingListings.length === 0 && <div className="card">No listings awaiting review.</div>}
          {pendingListings.map((l) => (
            <div key={l.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{l.title}</div>
                <div style={{ fontSize: 13, color: "var(--gray-600)", marginTop: 4 }}>
                  {l.area} · GHS {(l.priceCents / 100).toLocaleString()} · by {l.owner.name ?? l.owner.phone}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-outline" onClick={() => moderateListing(l.id, "REMOVED")}>
                  Reject
                </button>
                <button className="btn btn-sm btn-gold" onClick={() => moderateListing(l.id, "ACTIVE")}>
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
