import { useState } from "react";
import { api, apiErrorMessage } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { me, refreshMe } = useAuth();
  const [name, setName] = useState(me?.name ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api.patch("/users/me", { name: name || undefined, email: email || undefined });
      await refreshMe();
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Your profile</h1>
      <form className="card" onSubmit={save}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Phone</label>
        <input className="input" style={{ margin: "8px 0 14px" }} value={me?.phone} disabled />

        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Name</label>
        <input className="input" style={{ margin: "8px 0 14px" }} value={name} onChange={(e) => setName(e.target.value)} />

        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Email</label>
        <input className="input" style={{ margin: "8px 0 14px" }} value={email} onChange={(e) => setEmail(e.target.value)} type="email" />

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {saved && <p style={{ color: "var(--green)", fontSize: 13, marginBottom: 12 }}>Saved!</p>}
        <button className="btn btn-gold btn-block">Save changes</button>
      </form>
    </div>
  );
}
