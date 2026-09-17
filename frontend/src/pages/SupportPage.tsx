import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/api/client";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  messages: { id: string; body: string; senderId: string; createdAt: string }[];
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get("/support/tickets");
    setTickets(res.data.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/support/tickets", { subject, description });
      setSubject("");
      setDescription("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    try {
      await api.post(`/support/tickets/${selected.id}/messages`, { body: reply });
      setReply("");
      const res = await api.get(`/support/tickets/${selected.id}`);
      setSelected(res.data.data);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Help & support</h1>
        <form className="card" onSubmit={createTicket} style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Subject</label>
          <input className="input" style={{ margin: "8px 0 14px" }} value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-600)" }}>Describe the issue</label>
          <textarea className="input" style={{ margin: "8px 0 14px", minHeight: 90 }} value={description} onChange={(e) => setDescription(e.target.value)} required />
          {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-gold btn-block">Submit ticket</button>
        </form>

        <div style={{ display: "grid", gap: 10 }}>
          {tickets.map((t) => (
            <div
              key={t.id}
              className="card"
              style={{ cursor: "pointer", border: selected?.id === t.id ? "2px solid var(--gold)" : "none" }}
              onClick={() => setSelected(t)}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 14 }}>{t.subject}</strong>
                <span className="pill pill-navy">{t.status.replace("_", " ")}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--gray-600)", marginTop: 6 }}>{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ position: "sticky", top: 90, minHeight: 300 }}>
        {!selected ? (
          <p style={{ color: "var(--gray-600)", fontSize: 14 }}>Select a ticket to view the conversation.</p>
        ) : (
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>{selected.subject}</h3>
            <div style={{ display: "grid", gap: 10, maxHeight: 320, overflowY: "auto", marginBottom: 14 }}>
              {selected.messages.map((m) => (
                <div key={m.id} className="pill pill-gray" style={{ display: "block", textAlign: "left", padding: 10, borderRadius: 10 }}>
                  {m.body}
                </div>
              ))}
              {selected.messages.length === 0 && <p style={{ fontSize: 13, color: "var(--gray-600)" }}>No replies yet.</p>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="btn btn-gold" onClick={sendReply}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
