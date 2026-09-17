// Straight-line distance plus a fixed "road factor" fudge, used for the
// fare/duration estimate at ride-request time. A real deployment would
// call a routing API (Google Directions / Mapbox / OSRM) for an actual
// road-network distance and live-traffic duration — that needs an API
// key this sandbox doesn't have. The factor and average speeds below are
// documented, tunable constants, not hidden magic numbers, precisely so
// swapping in a real routing provider later is a one-function change
// (see rides.service.ts's estimateRide, the only caller).
const EARTH_RADIUS_KM = 6371;
const ROAD_FACTOR = 1.35; // roads are never a straight line

const AVG_SPEED_KMH: Record<string, number> = {
  MOTORBIKE: 28,
  TUKTUK: 22,
  SEDAN: 20, // Accra traffic — deliberately conservative
  SUV: 20,
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function estimateRoadDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.round(haversineKm(lat1, lng1, lat2, lng2) * ROAD_FACTOR * 100) / 100;
}

export function estimateDurationMin(distanceKm: number, vehicleType: string): number {
  const speed = AVG_SPEED_KMH[vehicleType] ?? 20;
  return Math.max(3, Math.round((distanceKm / speed) * 60));
}
