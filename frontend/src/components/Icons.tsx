// Ported verbatim (same paths, same viewBox) from the approved Sankofa
// POC's inline icon set (sankofa-app.jsx / sankofa-web.jsx's `Ic` object)
// so the real app's iconography matches the approved design exactly
// instead of using emoji as a placeholder.
import type { SVGProps } from "react";

export interface IconProps {
  s?: number; // size
  c?: string; // stroke/fill color
  w?: number; // stroke width
  f?: string; // fill (for star)
}

function base(p: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: p.s ?? 20,
    height: p.s ?? 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.c ?? "currentColor",
    strokeWidth: p.w ?? 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}

export const Icons = {
  car: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M5 17h14M6.5 17V9.5L8 6h8l1.5 3.5V17M5 12h14" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </svg>
  ),
  food: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 3v7a3 3 0 0 0 6 0V3M7 10v11M17 3c-1.5 2-2 4-2 6s.5 3 2 3 2-1 2-3-.5-4-2-6zM17 12v9" />
    </svg>
  ),
  truck: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M2 7h11v9H2zM13 10h4l3 3v3h-7" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  ),
  bolt: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  ),
  tool: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M14.5 6a3.5 3.5 0 0 0 4.9 4.2l-8.6 8.6a2.1 2.1 0 0 1-3-3l8.6-8.6A3.5 3.5 0 0 0 14.5 6z" />
    </svg>
  ),
  wallet: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6H7a2 2 0 0 1 0-4" />
      <circle cx="17" cy="14" r="1" fill={p.c ?? "currentColor"} stroke="none" />
    </svg>
  ),
  home: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  plane: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M21 15.5 13.5 12V5.5a1.5 1.5 0 0 0-3 0V12L3 15.5V18l7.5-2.2V19L8 20.8V22l4-1.2 4 1.2v-1.2L13.5 19v-3.2L21 18z" />
    </svg>
  ),
  back: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M15 18 9 12l6-6" />
    </svg>
  ),
  fwd: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M5 12h14" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="m4 12.5 5.5 5.5L20 6" />
    </svg>
  ),
  star: (p: IconProps) => (
    <svg {...base(p)} fill={p.f ?? "none"}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  ),
  clock: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 1.9" />
    </svg>
  ),
  pin: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  user: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  ),
  list: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  ),
  grid: (p: IconProps) => (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  bell: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.5 20a2 2 0 0 0 3 0" />
    </svg>
  ),
  x: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  eye: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.4 5.4A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.2 6.3A17 17 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 3.1-.5" />
    </svg>
  ),
  shield: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 3 5 6v6c0 4.2 3 7.8 7 9 4-1.2 7-4.8 7-9V6z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  ),
  phone: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M5 4h4l1.5 4-2.2 1.6a12 12 0 0 0 6.1 6.1L16 13.5 20 15v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
    </svg>
  ),
  msg: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1 1 21 12z" />
    </svg>
  ),
  up: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  ),
  down: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M17 7 7 17M15 17H7V9" />
    </svg>
  ),
  card: (p: IconProps) => (
    <svg {...base(p)}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </svg>
  ),
  out: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2M19 12H9m10 0-3-3m3 3-3 3" />
    </svg>
  ),
  menu: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
};

export type IconName = keyof typeof Icons;

// The Sankofa mark — a return-arrow inside a rounded badge (Sankofa: "go
// back and get it"), ported from the POC's `Logo` component.
export function SankofaLogo({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.29,
          background: light ? "rgba(255,255,255,.16)" : "var(--green)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: light ? "1px solid rgba(255,255,255,.28)" : "none",
        }}
      >
        <svg
          width={size * 0.56}
          height={size * 0.56}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 7.5A5.5 5.5 0 1 0 8.5 16" />
          <path d="M13 3.5 17 7.5l-4 4" />
        </svg>
      </div>
      <span
        style={{
          fontSize: size * 0.44,
          fontWeight: 800,
          letterSpacing: -0.7,
          color: light ? "#fff" : "var(--ink)",
        }}
      >
        Sankofa
      </span>
    </div>
  );
}
