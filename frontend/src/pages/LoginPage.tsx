import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/api/client";
import { Icons, SankofaLogo } from "@/components/Icons";

export default function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(150deg, var(--green) 0%, var(--green-dark) 100%)",
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.09,
          background: "repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 26px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ width: 400, maxWidth: "100%", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <SankofaLogo size={56} light />
          </div>
          <p style={{ color: "rgba(255,255,255,0.72)", marginTop: 6, fontSize: 14.5 }}>
            Rides, food, bills and more — one account.
          </p>
        </div>

        <div className="card">
          {step === "phone" ? (
            <form onSubmit={handleRequestOtp}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Phone number</label>
              <input
                className="input"
                style={{ marginTop: 8, marginBottom: 16 }}
                placeholder="0244 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoFocus
                required
              />
              {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn btn-gold btn-block" disabled={loading}>
                {loading ? "Sending code…" : "Send verification code"}
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  justifyContent: "center",
                  marginTop: 18,
                  fontSize: 11.5,
                  color: "var(--mute)",
                }}
              >
                <Icons.shield s={14} c="var(--mute)" /> No account yet? Entering your number creates one automatically.
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>
                Enter the 6-digit code sent to {phone}
              </label>
              <input
                className="input"
                style={{ marginTop: 8, marginBottom: 16, letterSpacing: 6, fontSize: 20, textAlign: "center" }}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                required
              />
              {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn btn-gold btn-block" disabled={loading}>
                {loading ? "Verifying…" : "Verify & continue"}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-block"
                style={{ marginTop: 10 }}
                onClick={() => setStep("phone")}
              >
                Use a different number
              </button>
              <p style={{ fontSize: 12, color: "var(--gray-600)", marginTop: 14, textAlign: "center" }}>
                Running locally with SMS_PROVIDER=console? Check the backend terminal log for the code.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
