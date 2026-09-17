import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/api/client";
import PageHeader from "@/components/PageHeader";

interface WalletTxn {
  id: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  note: string | null;
  createdAt: string;
}
interface Wallet {
  id: string;
  balanceCents: number;
  currency: string;
  transactions: WalletTxn[];
}
interface Loan {
  id: string;
  amountCents: number;
  purpose: string | null;
  status: string;
  createdAt: string;
}

const LOAN_STATUS_COLOR: Record<string, string> = {
  PENDING: "pill-gray",
  APPROVED: "pill-green",
  REJECTED: "pill-red",
  DISBURSED: "pill-green",
  REPAID: "pill-navy",
  DEFAULTED: "pill-red",
};

// "Liquidity" tile: an in-app wallet (top-up + transaction ledger) and
// microloan applications. Loan underwriting is manual-review-only for
// now (see backend loan.provider.ts) — approvals happen from the admin
// panel until a real credit-scoring integration is wired in.
export default function LiquidityHome() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanPurpose, setLoanPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get("/liquidity/wallet").then((res) => setWallet(res.data.data)).catch(() => {});
    api.get("/liquidity/loans").then((res) => setLoans(res.data.data)).catch(() => {});
  }

  useEffect(load, []);

  async function topUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/liquidity/wallet/topup", { amountCents: Math.round(parseFloat(topUpAmount) * 100), method: "MOBILE_MONEY" });
      setTopUpAmount("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function applyLoan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/liquidity/loans", { amountCents: Math.round(parseFloat(loanAmount) * 100), purpose: loanPurpose || undefined });
      setLoanAmount("");
      setLoanPurpose("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader icon="wallet" color="var(--gold-dark)" title="Liquidity" subtitle="Your Sankofa wallet & microloans." />

      <div className="card hero-gradient fade-up" style={{ marginBottom: 20 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Wallet balance</div>
          <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "var(--font-display)" }}>
            GHS {((wallet?.balanceCents ?? 0) / 100).toFixed(2)}
          </div>
        </div>
      </div>

      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Top up wallet</div>
          <form onSubmit={topUp}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Amount (GHS)</label>
            <input
              className="input"
              style={{ marginTop: 6, marginBottom: 14 }}
              type="number"
              min="1"
              step="0.5"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              required
            />
            <button className="btn btn-gold btn-block" disabled={busy}>
              Top up
            </button>
          </form>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Recent activity</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wallet?.transactions.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{t.note ?? t.type}</span>
                  <span style={{ fontWeight: 600 }}>
                    {t.type === "WITHDRAWAL" || t.type === "TRANSFER_OUT" || t.type === "PAYMENT" ? "-" : "+"}GHS{" "}
                    {(t.amountCents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              {(!wallet || wallet.transactions.length === 0) && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No activity yet.</p>}
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Apply for a microloan</div>
          <form onSubmit={applyLoan}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Amount (GHS)</label>
            <input
              className="input"
              style={{ marginTop: 6, marginBottom: 12 }}
              type="number"
              min="1"
              step="1"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              required
            />
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Purpose (optional)</label>
            <input className="input" style={{ marginTop: 6, marginBottom: 16 }} value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} />
            <button className="btn btn-navy btn-block" disabled={busy}>
              Submit application
            </button>
          </form>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>My applications</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {loans.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <span>GHS {(l.amountCents / 100).toFixed(2)} {l.purpose ? `· ${l.purpose}` : ""}</span>
                  <span className={`pill ${LOAN_STATUS_COLOR[l.status] ?? "pill-gray"}`}>{l.status}</span>
                </div>
              ))}
              {loans.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No loan applications yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
