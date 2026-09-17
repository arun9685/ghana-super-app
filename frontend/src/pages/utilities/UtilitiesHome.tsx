import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/api/client";
import PageHeader from "@/components/PageHeader";
import { Icons } from "@/components/Icons";

// The POC's icon set draws one "bolt" glyph for the whole Utilities
// tile rather than a distinct icon per bill type — kept here too,
// differentiated by label and tint instead of a mismatched icon.
const TYPES = [
  { key: "AIRTIME", label: "Airtime" },
  { key: "DATA", label: "Data bundle" },
  { key: "ELECTRICITY", label: "ECG (Electricity)" },
  { key: "WATER", label: "GWCL (Water)" },
  { key: "TV", label: "TV subscription" },
] as const;

const PROVIDERS_BY_TYPE: Record<string, string[]> = {
  AIRTIME: ["MTN", "Telecel", "AirtelTigo"],
  DATA: ["MTN", "Telecel", "AirtelTigo"],
  ELECTRICITY: ["ECG"],
  WATER: ["GWCL"],
  TV: ["DSTV", "GOtv", "StarTimes"],
};

interface Payment {
  id: string;
  type: string;
  provider: string;
  accountRef: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

// "Utilities" tile: airtime/data top-ups and bill payments. See
// backend utility.provider.ts — this posts to a real endpoint backed
// by a mock provider until real telco/utility aggregator credentials
// are wired in.
export default function UtilitiesHome() {
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("AIRTIME");
  const [provider, setProvider] = useState(PROVIDERS_BY_TYPE.AIRTIME[0]);
  const [accountRef, setAccountRef] = useState("");
  const [amount, setAmount] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get("/utilities").then((res) => setPayments(res.data.data)).catch(() => {});
  }

  useEffect(load, []);

  function onTypeChange(next: (typeof TYPES)[number]["key"]) {
    setType(next);
    setProvider(PROVIDERS_BY_TYPE[next][0]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await api.post("/utilities/pay", {
        type,
        provider,
        accountRef,
        amountCents: Math.round(parseFloat(amount) * 100),
      });
      setSuccess("Payment submitted.");
      setAccountRef("");
      setAmount("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader icon="bolt" color="var(--blue)" title="Utilities" subtitle="Airtime, power and water." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            {TYPES.map((t) => (
              <div
                key={t.key}
                className={`card tile-card${type === t.key ? "" : ""}`}
                style={{ padding: 12, textAlign: "center", border: type === t.key ? "2px solid var(--gold)" : "1px solid var(--gray-200)", boxShadow: "none" }}
                onClick={() => onTypeChange(t.key)}
              >
                <Icons.bolt s={18} c="var(--blue)" />
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{t.label}</div>
              </div>
            ))}
          </div>

          <form onSubmit={submit}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Provider</label>
            <select className="input" style={{ marginTop: 6, marginBottom: 12 }} value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS_BY_TYPE[type].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>
              {type === "AIRTIME" || type === "DATA" ? "Phone number" : "Account / meter number"}
            </label>
            <input className="input" style={{ marginTop: 6, marginBottom: 12 }} value={accountRef} onChange={(e) => setAccountRef(e.target.value)} required />
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Amount (GHS)</label>
            <input
              className="input"
              style={{ marginTop: 6, marginBottom: 16 }}
              type="number"
              min="1"
              step="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            {success && <p style={{ color: "var(--green)", fontSize: 13, marginBottom: 12 }}>{success}</p>}
            <button className="btn btn-gold btn-block" disabled={submitting}>
              {submitting ? "Processing…" : "Pay now"}
            </button>
          </form>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Recent payments</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {payments.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {p.type.replace(/_/g, " ")} · {p.provider}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-600)" }}>{p.accountRef}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>GHS {(p.amountCents / 100).toFixed(2)}</div>
                  <span className={`pill ${p.status === "SUCCESS" ? "pill-green" : p.status === "FAILED" ? "pill-red" : "pill-gray"}`}>{p.status}</span>
                </div>
              </div>
            ))}
            {payments.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No payments yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
