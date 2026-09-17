import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Icons } from "@/components/Icons";

const VEHICLE_TYPES = ["MOTORBIKE", "TUKTUK", "SEDAN", "SUV"] as const;

interface FleetVehicle {
  id: string;
  type: string;
  make: string;
  model: string;
  color: string;
  plateNumber: string;
  assignedDriver: { user: { name: string | null; phone: string } } | null;
}

// "Fleet" tile: for FLEET_OWNER accounts managing several vehicles &
// drivers at once, distinct from the single owner-operator flow in
// Drive. A CUSTOMER account can self-upgrade by registering a fleet —
// backend grants FLEET_OWNER-gated endpoints via role check, and the
// first successful call to GET/POST /fleet auto-creates the fleet
// record for whoever calls it.
export default function FleetHome() {
  const { me } = useAuth();
  const isFleetOwner = me?.roles.includes("FLEET_OWNER") ?? false;
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "SEDAN" as (typeof VEHICLE_TYPES)[number], make: "", model: "", color: "", plateNumber: "" });
  const [busy, setBusy] = useState(false);

  function load() {
    api.get("/fleet/vehicles").then((res) => setVehicles(res.data.data)).catch(() => {});
  }

  useEffect(() => {
    if (isFleetOwner) load();
  }, [isFleetOwner]);

  async function registerFleet() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/fleet", { name: `${me?.name ?? "My"} Fleet` });
      window.location.reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/fleet/vehicles", form);
      setForm({ type: "SEDAN", make: "", model: "", color: "", plateNumber: "" });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!isFleetOwner) {
    return (
      <div>
        <PageHeader icon="truck" color="var(--purple)" title="Fleet" subtitle="Manage multiple vehicles and drivers for your business." />
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(107,70,193,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <Icons.truck s={28} c="var(--purple)" />
          </div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Register your fleet</div>
          <p style={{ color: "var(--slate)", fontSize: 14, marginBottom: 16 }}>
            Own several vehicles? Register a fleet to add vehicles and assign approved drivers to them.
          </p>
          {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-gold" onClick={registerFleet} disabled={busy}>
            {busy ? "Registering…" : "Register my fleet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon="truck" color="var(--purple)" title="Fleet" subtitle="Your fleet's vehicles and driver assignments." />

      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Add a vehicle</div>
          <form onSubmit={addVehicle}>
            <select className="input" style={{ marginBottom: 10 }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input className="input" style={{ marginBottom: 10 }} placeholder="Make (e.g. Toyota)" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required />
            <input className="input" style={{ marginBottom: 10 }} placeholder="Model (e.g. Corolla)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            <input className="input" style={{ marginBottom: 10 }} placeholder="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} required />
            <input className="input" style={{ marginBottom: 16 }} placeholder="Plate number" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} required />
            <button className="btn btn-gold btn-block" disabled={busy}>
              Add vehicle
            </button>
          </form>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Fleet vehicles ({vehicles.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vehicles.map((v) => (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--gray-200)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {v.color} {v.make} {v.model}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-600)" }}>{v.plateNumber} · {v.type}</div>
                </div>
                {v.assignedDriver ? (
                  <span className="pill pill-green">{v.assignedDriver.user.name ?? v.assignedDriver.user.phone}</span>
                ) : (
                  <span className="pill pill-gray">Unassigned</span>
                )}
              </div>
            ))}
            {vehicles.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No vehicles yet — add one to get started.</p>}
          </div>
          <p style={{ fontSize: 12, color: "var(--gray-600)", marginTop: 14 }}>
            To assign a driver, use an approved driver's profile ID via the API (POST /fleet/vehicles/:id/assign) — a driver picker UI can be added
            once fleet accounts are onboarded.
          </p>
        </div>
      </div>
    </div>
  );
}
