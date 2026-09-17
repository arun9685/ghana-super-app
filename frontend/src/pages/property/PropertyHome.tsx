import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/api/client";
import PageHeader from "@/components/PageHeader";

interface Listing {
  id: string;
  title: string;
  description: string;
  type: string;
  priceCents: number;
  area: string;
  bedrooms: number | null;
  status: string;
}

const TYPE_LABEL: Record<string, string> = { RENT: "For rent", SALE: "For sale", SHORT_STAY: "Short stay" };

// "Property" tile: browse active listings, enquire, and — via "My
// listings" — post your own (starts PENDING_REVIEW until an admin
// approves it, see property.service.ts).
export default function PropertyHome() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", type: "RENT", priceCents: "", area: "", bedrooms: "" });
  const [busy, setBusy] = useState(false);

  function load() {
    api.get("/property/listings").then((res) => setListings(res.data.data)).catch(() => {});
    api.get("/property/listings/mine").then((res) => setMyListings(res.data.data)).catch(() => {});
  }

  useEffect(load, []);

  async function enquire(listingId: string) {
    const message = window.prompt("Your message to the owner:");
    if (!message) return;
    try {
      await api.post(`/property/listings/${listingId}/enquiries`, { message });
      window.alert("Enquiry sent!");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitListing(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/property/listings", {
        title: form.title,
        description: form.description,
        type: form.type,
        priceCents: Math.round(parseFloat(form.priceCents) * 100),
        area: form.area,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms, 10) : undefined,
      });
      setForm({ title: "", description: "", type: "RENT", priceCents: "", area: "", bedrooms: "" });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader icon="home" color="var(--brown)" title="Property" subtitle="Rent or buy across Ghana." />

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button className={`btn btn-sm ${tab === "browse" ? "btn-navy" : "btn-outline"}`} onClick={() => setTab("browse")}>
          Browse listings
        </button>
        <button className={`btn btn-sm ${tab === "mine" ? "btn-navy" : "btn-outline"}`} onClick={() => setTab("mine")}>
          My listings
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}

      {tab === "browse" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {listings.map((l) => (
            <div key={l.id} className="card fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="pill pill-gold">{TYPE_LABEL[l.type] ?? l.type}</span>
                {l.bedrooms != null && <span style={{ fontSize: 12, color: "var(--gray-600)" }}>{l.bedrooms} bed</span>}
              </div>
              <div style={{ fontWeight: 700, marginTop: 10, fontSize: 16 }}>{l.title}</div>
              <div style={{ fontSize: 13, color: "var(--gray-600)", margin: "4px 0 10px" }}>{l.area}</div>
              <div style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 12 }}>{l.description}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>GHS {(l.priceCents / 100).toLocaleString()}</span>
                <button className="btn btn-navy btn-sm" onClick={() => enquire(l.id)}>
                  Enquire
                </button>
              </div>
            </div>
          ))}
          {listings.length === 0 && <p style={{ color: "var(--gray-600)" }}>No active listings right now.</p>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Post a listing</div>
            <form onSubmit={submitListing}>
              <input className="input" style={{ marginBottom: 10 }} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <textarea className="input" style={{ marginBottom: 10, minHeight: 70 }} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              <select className="input" style={{ marginBottom: 10 }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="RENT">For rent</option>
                <option value="SALE">For sale</option>
                <option value="SHORT_STAY">Short stay</option>
              </select>
              <input className="input" style={{ marginBottom: 10 }} placeholder="Area (e.g. East Legon, Accra)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required />
              <input className="input" style={{ marginBottom: 10 }} type="number" placeholder="Price (GHS)" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} required />
              <input className="input" style={{ marginBottom: 16 }} type="number" placeholder="Bedrooms (optional)" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
              <button className="btn btn-gold btn-block" disabled={busy}>
                Submit for review
              </button>
              <p style={{ fontSize: 12, color: "var(--gray-600)", marginTop: 10 }}>New listings are reviewed by an admin before they go live.</p>
            </form>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>My listings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {myListings.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.title}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-600)" }}>GHS {(l.priceCents / 100).toLocaleString()}</div>
                  </div>
                  <span className={`pill ${l.status === "ACTIVE" ? "pill-green" : l.status === "REMOVED" ? "pill-red" : "pill-gray"}`}>{l.status}</span>
                </div>
              ))}
              {myListings.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>You haven't posted a listing yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
