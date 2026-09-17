import { prisma } from "@/database/prisma";
import { NotFoundError } from "@/common/errors";
import type { VehicleType } from "@prisma/client";

// spec §21-22: fare engine. Distance/duration come from
// rides.service.ts's straight-line-plus-road-factor estimate (see the
// comment there for why — no mapping-API key in this environment).
export interface FareBreakdown {
  vehicleType: VehicleType;
  baseFareCents: number;
  distanceFareCents: number;
  timeFareCents: number;
  bookingFeeCents: number;
  surgeMultiplier: number;
  subtotalCents: number;
  totalCents: number;
  currency: string;
}

export async function getPricingRule(vehicleType: VehicleType) {
  const rule = await prisma.pricingRule.findUnique({ where: { vehicleType } });
  if (!rule) throw new NotFoundError(`No pricing configured for ${vehicleType} yet`);
  return rule;
}

export async function listPricingRules() {
  return prisma.pricingRule.findMany({ orderBy: { vehicleType: "asc" } });
}

export async function estimateFare(
  vehicleType: VehicleType,
  distanceKm: number,
  durationMin: number
): Promise<FareBreakdown> {
  const rule = await getPricingRule(vehicleType);

  const distanceFareCents = Math.round(distanceKm * rule.perKmCents);
  const timeFareCents = Math.round(durationMin * rule.perMinCents);
  const subtotal = rule.baseFareCents + distanceFareCents + timeFareCents;
  const surged = Math.round(subtotal * rule.surgeMultiplier);
  const total = Math.max(surged + rule.bookingFeeCents, rule.minFareCents);

  return {
    vehicleType,
    baseFareCents: rule.baseFareCents,
    distanceFareCents,
    timeFareCents,
    bookingFeeCents: rule.bookingFeeCents,
    surgeMultiplier: rule.surgeMultiplier,
    subtotalCents: subtotal,
    totalCents: total,
    currency: rule.currency,
  };
}

export async function updatePricingRule(
  vehicleType: VehicleType,
  data: Partial<Pick<
    Awaited<ReturnType<typeof getPricingRule>>,
    "baseFareCents" | "perKmCents" | "perMinCents" | "minFareCents" | "bookingFeeCents" | "surgeMultiplier"
  >>
) {
  return prisma.pricingRule.update({ where: { vehicleType }, data });
}
