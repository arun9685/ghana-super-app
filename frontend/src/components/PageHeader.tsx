import { Icons, type IconName } from "@/components/Icons";

// Same icon-badge-plus-title pattern the POC uses for every service
// view's header (`TopBar`/`ServiceView` in sankofa-app.jsx), replacing
// the emoji headers each service page started with.
export default function PageHeader({
  icon,
  color,
  title,
  subtitle,
  action,
}: {
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  const Icon = Icons[icon];
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: `${color}1a`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon s={22} c={color} />
        </div>
        <div>
          <h1 style={{ fontSize: 22 }}>{title}</h1>
          <p style={{ color: "var(--slate)", marginTop: 2, fontSize: 13.5 }}>{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
