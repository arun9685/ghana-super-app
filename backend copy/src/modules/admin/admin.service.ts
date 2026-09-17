import { prisma } from "@/database/prisma";
import { hashLookupValue } from "@/common/crypto/piiEncryption";
import type { RideStatus } from "@prisma/client";

// spec §32-33: admin dashboard APIs. This module deliberately composes
// other modules' services (drivers, support, pricing) for the actions
// that already belong there, and only owns what's genuinely
// admin-specific: aggregate stats and the user directory.
export async function getDashboardStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalUsers, totalDrivers, pendingDrivers, ridesToday, completedRidesToday, activeRides, revenueToday] =
    await Promise.all([
      prisma.user.count(),
      prisma.driverProfile.count({ where: { verificationStatus: "APPROVED" } }),
      prisma.driverProfile.count({ where: { verificationStatus: "PENDING" } }),
      prisma.ride.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.ride.count({ where: { status: "COMPLETED", completedAt: { gte: startOfToday } } }),
      prisma.ride.count({ where: { status: { in: ["REQUESTED", "SEARCHING", "ASSIGNED", "ARRIVED", "IN_PROGRESS"] } } }),
      prisma.payment.aggregate({
        where: { status: "PAID", paidAt: { gte: startOfToday } },
        _sum: { amountCents: true },
      }),
    ]);

  return {
    totalUsers,
    totalDrivers,
    pendingDrivers,
    ridesToday,
    completedRidesToday,
    activeRides,
    revenueTodayCents: revenueToday._sum.amountCents ?? 0,
  };
}

// PII-encryption follow-up: phone/name are AES-GCM ciphertext at rest now
// (see database/prisma.ts), so Postgres can no longer run
// `contains`/`ILIKE` against them directly — a substring filter in the
// WHERE clause would just compare against ciphertext and match nothing.
export async function listUsers(search?: string) {
  if (!search) {
    return prisma.user.findMany({ include: { roles: true }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  // A full Ghana-format number IS still exact-matchable — via phoneHash,
  // the deterministic blind index — and that's indexed and fast, so try
  // it first for the common "pasted a phone number from a support ticket"
  // admin workflow.
  const digitsOnly = search.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digitsOnly)) {
    const exactMatch = await prisma.user.findMany({
      where: { phoneHash: hashLookupValue(digitsOnly) },
      include: { roles: true },
    });
    if (exactMatch.length > 0) return exactMatch;
  }

  // Fallback for a partial phone number or a name: there is no way to
  // index a substring search over encrypted data, so this decrypts a
  // bounded page of users (the Prisma extension does that automatically
  // as rows are fetched) and filters in application code instead of SQL.
  // Fine at MVP scale; revisit (a separate searchable-token column, or an
  // external search index like OpenSearch) well before the user table
  // reaches the hundreds of thousands, since this scans up to MAX_SCAN
  // rows on every search rather than using a database index.
  const MAX_SCAN = 2000;
  const candidates = await prisma.user.findMany({
    include: { roles: true },
    orderBy: { createdAt: "desc" },
    take: MAX_SCAN,
  });
  const needle = search.toLowerCase();
  return candidates
    .filter((u) => (digitsOnly.length > 0 && u.phone.includes(digitsOnly)) || (u.name?.toLowerCase().includes(needle) ?? false))
    .slice(0, 100);
}

export async function listRides(status?: RideStatus) {
  return prisma.ride.findMany({
    where: status ? { status } : undefined,
    include: {
      customer: { select: { name: true, phone: true } },
      driverProfile: { include: { user: { select: { name: true, phone: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
