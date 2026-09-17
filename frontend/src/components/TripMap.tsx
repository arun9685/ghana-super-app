interface Props {
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  driver?: { lat: number; lng: number } | null;
}

// A schematic (not geographically accurate) two-point line, in the same
// spirit as the original Sankofa POC's map — this environment has no
// mapping-tile API key, so this renders the *relationship* between
// pickup, dropoff and (if present) the live driver position rather than
// real streets. All three points come from real coordinates computed by
// the backend, this is just how they're drawn.
export default function TripMap({ pickup, dropoff, driver }: Props) {
  const minLat = Math.min(pickup.lat, dropoff.lat, driver?.lat ?? pickup.lat) - 0.004;
  const maxLat = Math.max(pickup.lat, dropoff.lat, driver?.lat ?? pickup.lat) + 0.004;
  const minLng = Math.min(pickup.lng, dropoff.lng, driver?.lng ?? pickup.lng) - 0.004;
  const maxLng = Math.max(pickup.lng, dropoff.lng, driver?.lng ?? pickup.lng) + 0.004;

  const W = 560;
  const H = 260;
  const toXY = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * (W - 80) + 40;
    const y = H - (((lat - minLat) / (maxLat - minLat || 1)) * (H - 80) + 40);
    return [x, y];
  };

  const [px, py] = toXY(pickup.lat, pickup.lng);
  const [dx, dy] = toXY(dropoff.lat, dropoff.lng);
  const driverXY = driver ? toXY(driver.lat, driver.lng) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#e8ebe9" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#f5f7f6" />
      <rect width={W} height={H} fill="url(#grid)" />
      <line x1={px} y1={py} x2={dx} y2={dy} stroke="#0b0f0d" strokeWidth={3} strokeDasharray="2 8" strokeLinecap="round" opacity={0.5} />

      <circle cx={px} cy={py} r={9} fill="#0a7a4b" stroke="white" strokeWidth={3} />
      <text x={px + 14} y={py + 4} fontSize={12} fontWeight={700} fill="#0b0f0d">
        Pickup
      </text>

      <circle cx={dx} cy={dy} r={9} fill="#d64545" stroke="white" strokeWidth={3} />
      <text x={dx + 14} y={dy + 4} fontSize={12} fontWeight={700} fill="#0b0f0d">
        Drop-off
      </text>

      {driverXY && (
        <g>
          <circle cx={driverXY[0]} cy={driverXY[1]} r={11} fill="#f0b429" stroke="white" strokeWidth={3}>
            <animate attributeName="r" values="11;15;11" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <text x={driverXY[0] + 16} y={driverXY[1] + 4} fontSize={12} fontWeight={800} fill="#b07d08">
            Driver
          </text>
        </g>
      )}
    </svg>
  );
}
