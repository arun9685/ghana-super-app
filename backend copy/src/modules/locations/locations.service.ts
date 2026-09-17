import { redis } from "@/database/redis";
import { prisma } from "@/database/prisma";
import { logger } from "@/common/logger";
import type { VehicleType } from "@prisma/client";

// spec §18: "Do not write every GPS update directly to PostgreSQL — use
// Redis." This is the live read model: one GEO set of every online
// driver's current position, plus a small hash of metadata per driver
// (vehicle type, busy/idle) so matching can filter without a DB round
// trip. Postgres (DriverProfile.lastLat/lastLng) is only a throttled
// fallback for admin screens — see updateLastKnownLocation below.
const GEO_KEY = "drivers:geo";
const META_PREFIX = "driver:meta:"; // + driverProfileId -> hash
const LAST_PG_WRITE_PREFIX = "driver:lastpgwrite:"; // throttle key

export type DriverAvailability = "idle" | "busy" | "offline";

export interface NearbyDriver {
  driverProfileId: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

export async function setDriverOnline(driverProfileId: string, vehicleType: VehicleType): Promise<void> {
  await redis.hset(META_PREFIX + driverProfileId, {
    vehicleType,
    availability: "idle" as DriverAvailability,
  });
  await prisma.driverProfile.update({ where: { id: driverProfileId }, data: { isOnline: true } });
}

export async function setDriverOffline(driverProfileId: string): Promise<void> {
  await redis.zrem(GEO_KEY, driverProfileId);
  await redis.del(META_PREFIX + driverProfileId);
  await prisma.driverProfile.update({ where: { id: driverProfileId }, data: { isOnline: false } });
}

export async function setDriverAvailability(driverProfileId: string, availability: DriverAvailability): Promise<void> {
  const exists = await redis.exists(META_PREFIX + driverProfileId);
  if (!exists) return; // driver is offline — nothing to update
  await redis.hset(META_PREFIX + driverProfileId, { availability });
}

// Called on every location ping from the driver app (frequent — every
// few seconds while online). Redis GEOADD is O(log n) and cheap at this
// volume; Postgres is only touched at most once per 10s per driver.
export async function updateDriverLocation(driverProfileId: string, lat: number, lng: number): Promise<void> {
  await redis.geoadd(GEO_KEY, lng, lat, driverProfileId);

  const throttleKey = LAST_PG_WRITE_PREFIX + driverProfileId;
  const recentlyWritten = await redis.get(throttleKey);
  if (!recentlyWritten) {
    await redis.set(throttleKey, "1", "EX", 10);
    await prisma.driverProfile
      .update({
        where: { id: driverProfileId },
        data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
      })
      .catch((err) => logger.error({ err, driverProfileId }, "Failed to persist last-known driver location"));
  }
}

// spec §17 step 1: "nearby-driver search". Filters to idle drivers of the
// requested vehicle type, sorted nearest-first.
export async function findNearbyIdleDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
  vehicleType: VehicleType,
  limit = 10
): Promise<NearbyDriver[]> {
  // ioredis geosearch reply shape with WITHCOORD + WITHDIST:
  // [ [member, distance, [lng, lat]], ... ]
  // Cast the client to `any` for this one call: ioredis types GEOSEARCH
  // with a large set of literal-string overloads and the exact shape
  // varies by ioredis minor version, which isn't worth pinning against
  // here — the Redis-level command syntax below is what's authoritative.
  // (Runtime behavior is unaffected; this only relaxes compile-time
  // overload matching.)
  const raw = (await (redis as unknown as { geosearch: (...args: unknown[]) => Promise<unknown> }).geosearch(
    GEO_KEY,
    "FROMLONLAT",
    lng,
    lat,
    "BYRADIUS",
    radiusKm,
    "km",
    "ASC",
    "COUNT",
    limit * 4, // over-fetch, then filter by availability/type in JS
    "WITHCOORD",
    "WITHDIST"
  )) as [string, string, [string, string]][];

  if (!raw || raw.length === 0) return [];

  const results: NearbyDriver[] = [];
  for (const [driverProfileId, distanceStr, coords] of raw) {
    const meta = await redis.hgetall(META_PREFIX + driverProfileId);
    if (!meta || meta.availability !== "idle") continue;
    if (meta.vehicleType && meta.vehicleType !== vehicleType) continue;
    results.push({
      driverProfileId,
      distanceKm: Number(distanceStr),
      lng: Number(coords[0]),
      lat: Number(coords[1]),
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function getDriverAvailability(driverProfileId: string): Promise<DriverAvailability> {
  const meta = await redis.hgetall(META_PREFIX + driverProfileId);
  if (!meta || Object.keys(meta).length === 0) return "offline";
  return (meta.availability as DriverAvailability) ?? "offline";
}

export async function isDriverOnline(driverProfileId: string): Promise<boolean> {
  const score = await redis.zscore(GEO_KEY, driverProfileId);
  return score !== null;
}
