import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { getSocket } from "@/api/socket";
import { Icons } from "@/components/Icons";

interface Notif {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    const res = await api.get("/notifications");
    setItems(res.data.data.notifications);
    setUnread(res.data.data.unreadCount);
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    const onNew = (n: Notif) => {
      setItems((prev) => [n, ...prev].slice(0, 30));
      setUnread((c) => c + 1);
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, []);

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        style={{
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 12,
          width: 38,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <Icons.bell s={18} c="#fff" />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--gold)",
              color: "var(--navy-dark)",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
              minWidth: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: 44,
            width: 340,
            maxHeight: 420,
            overflowY: "auto",
            padding: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px" }}>
            <strong style={{ fontSize: 14 }}>Notifications</strong>
            <button className="btn btn-sm btn-outline" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          {items.length === 0 && (
            <div style={{ padding: 16, color: "var(--gray-600)", fontSize: 13 }}>Nothing yet.</div>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "10px 8px",
                borderTop: "1px solid var(--gray-200)",
                background: n.readAt ? "transparent" : "rgba(227,167,43,0.08)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{n.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--gray-600)", marginTop: 2 }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
