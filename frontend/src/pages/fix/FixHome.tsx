import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage } from "@/api/client";
import PageHeader from "@/components/PageHeader";

const CATEGORIES = ["PLUMBING", "ELECTRICAL", "CLEANING", "CARPENTRY", "PAINTING", "APPLIANCE_REPAIR", "OTHER"] as const;

interface ArtisanProfile {
  id: string;
  category: string;
  ratingAvg: number;
  completedJobCount: number;
  user: { name: string | null; phone: string };
}
interface ServiceRequest {
  id: string;
  category: string;
  description: string;
  address: string;
  status: string;
  quotedPriceCents: number | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// "Fix" tile: request an artisan for a home-service job, browse
// available artisans, and track requests already placed. An artisan
// (someone who has applied via applyAsArtisan) sees the "Jobs near you"
// panel to accept open requests.
export default function FixHome() {
  const { me } = useAuth();
  const isArtisan = me?.roles.includes("ARTISAN") ?? false;
  const [applying, setApplying] = useState(false);

  async function becomeArtisan() {
    setApplying(true);
    try {
      await api.post("/fix/artisans/apply", { category, bio: "" });
      window.location.reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("PLUMBING");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [artisans, setArtisans] = useState<ArtisanProfile[]>([]);
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [openRequests, setOpenRequests] = useState<ServiceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function loadAll() {
    api.get("/fix/artisans", { params: { category } }).then((res) => setArtisans(res.data.data)).catch(() => {});
    api.get("/fix/requests").then((res) => setMyRequests(res.data.data)).catch(() => {});
    if (isArtisan) {
      api.get("/fix/requests", { params: { open: "true" } }).then((res) => setOpenRequests(res.data.data)).catch(() => {});
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.post("/fix/requests", { category, description, address, lat: 5.6037, lng: -0.187 });
      setDescription("");
      setAddress("");
      setSuccess("Request sent — nearby artisans will be notified.");
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function acceptJob(id: string) {
    const quoted = window.prompt("Quoted price in GHS (e.g. 150)");
    if (!quoted) return;
    try {
      await api.post(`/fix/requests/${id}/accept`, { quotedPriceCents: Math.round(parseFloat(quoted) * 100) });
      loadAll();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        icon="tool"
        color="var(--teal)"
        title="Fix"
        subtitle="Verified home service providers, on demand."
        action={
          !isArtisan && (
            <button className="btn btn-outline btn-sm" onClick={becomeArtisan} disabled={applying}>
              {applying ? "Applying…" : "Become an artisan"}
            </button>
          )
        }
      />

      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      {success && <p style={{ color: "var(--green)", marginBottom: 12 }}>{success}</p>}

      <div style={{ display: "grid", gridTemplateColumns: isArtisan ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Request a service</div>
          <form onSubmit={submitRequest}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Category</label>
            <select className="input" style={{ marginTop: 6, marginBottom: 12 }} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>What do you need done?</label>
            <textarea
              className="input"
              style={{ marginTop: 6, marginBottom: 12, minHeight: 80 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Address</label>
            <input className="input" style={{ marginTop: 6, marginBottom: 16 }} value={address} onChange={(e) => setAddress(e.target.value)} required />
            <button className="btn btn-gold btn-block">Find an artisan</button>
          </form>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Artisans in {category.replace(/_/g, " ").toLowerCase()}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {artisans.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{a.user.name ?? a.user.phone}</span>
                  <span style={{ color: "var(--gray-600)" }}>★ {a.ratingAvg.toFixed(1)} · {a.completedJobCount} jobs</span>
                </div>
              ))}
              {artisans.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No artisans registered in this category yet.</p>}
            </div>
          </div>
        </div>

        {isArtisan && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Jobs near you</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {openRequests.map((r) => (
                <div key={r.id} className="card" style={{ boxShadow: "none", border: "1px solid var(--gray-200)" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.category.replace(/_/g, " ")}</div>
                  <div style={{ fontSize: 13, color: "var(--gray-600)", margin: "4px 0" }}>{r.description}</div>
                  <div style={{ fontSize: 12, color: "var(--gray-600)", marginBottom: 8 }}>{r.address}</div>
                  <button className="btn btn-navy btn-sm" onClick={() => acceptJob(r.id)}>
                    Accept & quote
                  </button>
                </div>
              ))}
              {openRequests.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No open requests right now.</p>}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>My requests</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myRequests.map((r) => (
            <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.category.replace(/_/g, " ")}</div>
                <div style={{ fontSize: 13, color: "var(--gray-600)" }}>{r.description}</div>
                {r.quotedPriceCents != null && (
                  <div style={{ fontSize: 13, color: "var(--gray-600)" }}>Quoted: GHS {(r.quotedPriceCents / 100).toFixed(2)}</div>
                )}
              </div>
              <span className="pill pill-gold">{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
          ))}
          {myRequests.length === 0 && <p style={{ color: "var(--gray-600)" }}>No requests yet.</p>}
        </div>
      </div>
    </div>
  );
}
