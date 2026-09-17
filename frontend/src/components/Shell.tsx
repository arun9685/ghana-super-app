import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/NotificationsBell";
import { SankofaLogo } from "@/components/Icons";

interface NavItem {
  to: string;
  label: string;
}

// Ported from the approved POC's TopNav (sankofa-web.jsx): sticky white
// header, logo mark, pill-style active nav item in green-on-green-tint,
// same as the POC's `background: on ? T.greenL : "transparent"` treatment.
export default function Shell({ children, nav }: { children: ReactNode; nav: NavItem[] }) {
  const { me, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--green)",
          color: "white",
          padding: "14px 0",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div className="container" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <SankofaLogo size={34} light />
          </Link>

          <nav style={{ display: "flex", gap: 4, flex: 1 }}>
            {nav.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    color: active ? "var(--green)" : "rgba(255,255,255,0.85)",
                    background: active ? "var(--white)" : "transparent",
                    textDecoration: "none",
                    fontSize: 13.5,
                    fontWeight: 700,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <NotificationsBell />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{me?.name ?? me?.phone}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{me?.roles.join(" · ")}</div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ borderColor: "rgba(255,255,255,0.3)", color: "white" }}
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main style={{ flex: 1, background: "var(--bg)", padding: "32px 0 60px" }}>
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
