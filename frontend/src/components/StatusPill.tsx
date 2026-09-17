import type { RideStatus } from "@/lib/types";

const CONFIG: Record<RideStatus, { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "pill-gray" },
  SEARCHING: { label: "Finding a driver", className: "pill-gold" },
  ASSIGNED: { label: "Driver on the way", className: "pill-gold" },
  ARRIVED: { label: "Driver has arrived", className: "pill-gold" },
  IN_PROGRESS: { label: "Trip in progress", className: "pill-navy" },
  COMPLETED: { label: "Completed", className: "pill-green" },
  CANCELLED: { label: "Cancelled", className: "pill-red" },
  NO_DRIVERS_FOUND: { label: "No drivers found", className: "pill-red" },
};

export default function StatusPill({ status }: { status: RideStatus }) {
  const c = CONFIG[status];
  return <span className={`pill ${c.className}`}>{c.label}</span>;
}
