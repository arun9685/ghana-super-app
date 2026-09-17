import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { VehicleType } from "@/lib/types";

export default function DriverApply() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [licenseNumber, setLicenseNumber] = useState("");
  const [type, setType] = useState<VehicleType>("SEDAN");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/drivers/apply", {
        licenseNumber,
        vehicle: { type, make, model, color, plateNumber, year: year ? Number(year) : undefined },
      });
      await refreshMe();
      navigate("/drive");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Drive with Sankofa</h1>
      <p style={{ color: "var(--gray-600)", marginBottom: 20 }}>
        Tell us about you and your vehicle. An admin reviews every application before you can go online.
      </p>
      <form className="card" onSubmit={submit}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Driver's license number</label>
        <input className="input" style={{ margin: "8px 0 16px" }} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required />

        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Vehicle type</label>
        <select className="input" style={{ margin: "8px 0 16px" }} value={type} onChange={(e) => setType(e.target.value as VehicleType)}>
          <option value="MOTORBIKE">Motorbike</option>
          <option value="TUKTUK">Tuk-tuk</option>
          <option value="SEDAN">Sedan</option>
          <option value="SUV">SUV</option>
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Make</label>
            <input className="input" style={{ marginTop: 8 }} value={make} onChange={(e) => setMake(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Model</label>
            <input className="input" style={{ marginTop: 8 }} value={model} onChange={(e) => setModel(e.target.value)} required />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Color</label>
            <input className="input" style={{ marginTop: 8 }} value={color} onChange={(e) => setColor(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Year (optional)</label>
            <input className="input" style={{ marginTop: 8 }} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)", marginTop: 16, display: "block" }}>Plate number</label>
        <input className="input" style={{ margin: "8px 0 20px" }} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required />

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>}
        <button className="btn btn-gold btn-block" disabled={loading}>
          {loading ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  );
}
