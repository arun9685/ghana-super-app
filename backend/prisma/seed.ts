// Imports the app's shared, PII-encryption-extended Prisma client (not a
// bare `new PrismaClient()`) so seeded users' phone/name go through the
// same AES-256-GCM encryption + blind-index hashing as every other write
// — a seed script that bypassed the extension would insert unencrypted
// PII the app could never correctly decrypt back out. See
// src/database/prisma.ts and src/common/crypto/piiEncryption.ts.
import { prisma } from "../src/database/prisma";
import { hashLookupValue } from "../src/common/crypto/piiEncryption";

// Seeds the flat-rate pricing card every vehicle type needs before a
// single ride can be estimated. Figures are illustrative Accra-market
// starting points (GHS), not a claim about real-world margins — tune
// these in the admin panel once real trip data exists.

async function main() {
  const rules: {
    vehicleType: "MOTORBIKE" | "TUKTUK" | "SEDAN" | "SUV";
    baseFareCents: number;
    perKmCents: number;
    perMinCents: number;
    minFareCents: number;
    bookingFeeCents: number;
  }[] = [
    { vehicleType: "MOTORBIKE", baseFareCents: 300, perKmCents: 120, perMinCents: 15, minFareCents: 700, bookingFeeCents: 100 },
    { vehicleType: "TUKTUK", baseFareCents: 400, perKmCents: 150, perMinCents: 20, minFareCents: 900, bookingFeeCents: 150 },
    { vehicleType: "SEDAN", baseFareCents: 600, perKmCents: 220, perMinCents: 30, minFareCents: 1200, bookingFeeCents: 200 },
    { vehicleType: "SUV", baseFareCents: 900, perKmCents: 300, perMinCents: 40, minFareCents: 1800, bookingFeeCents: 250 },
  ];

  for (const rule of rules) {
    await prisma.pricingRule.upsert({
      where: { vehicleType: rule.vehicleType },
      update: rule,
      create: rule,
    });
  }

  // A platform admin account so the admin panel has somewhere to log in
  // to on a fresh database. Phone-only, OTP-based like every other
  // account — no password to leak, no seeded secret to worry about.
  const adminPhone = "0200000000";
  const admin = await prisma.user.upsert({
    where: { phoneHash: hashLookupValue(adminPhone) },
    update: {},
    create: {
      phone: adminPhone,
      phoneHash: hashLookupValue(adminPhone),
      name: "Platform Admin",
      isPhoneVerified: true,
      roles: { create: [{ role: "PLATFORM_ADMIN" }, { role: "CUSTOMER" }] },
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seeded pricing rules for MOTORBIKE, TUKTUK, SEDAN, SUV.");
  // eslint-disable-next-line no-console
  console.log(`Seeded platform admin user: ${admin.phone} (log in with this number; SMS_PROVIDER=console prints the OTP to the backend logs).`);

  // ---- Sample data for the other service tiles, so the dashboard has
  // something real to show as soon as the app boots, without waiting on
  // real restaurant/artisan/listing onboarding. --------------------------

  const restaurantSeeds: { name: string; description: string; area: string; items: { name: string; priceCents: number }[] }[] = [
    {
      name: "Auntie Muni's Kitchen",
      description: "Home-style jollof, waakye, and grilled tilapia.",
      area: "Osu, Accra",
      items: [
        { name: "Jollof Rice + Chicken", priceCents: 3500 },
        { name: "Waakye Special", priceCents: 3000 },
        { name: "Grilled Tilapia + Banku", priceCents: 5500 },
      ],
    },
    {
      name: "Osu Grill House",
      description: "Grilled meats, kebabs, and sides.",
      area: "Osu, Accra",
      items: [
        { name: "Mixed Kebab Platter", priceCents: 4500 },
        { name: "Grilled Chicken + Chips", priceCents: 4000 },
      ],
    },
    {
      name: "East Legon Bowls",
      description: "Salads, smoothie bowls, and light lunches.",
      area: "East Legon, Accra",
      items: [
        { name: "Chicken Caesar Bowl", priceCents: 4200 },
        { name: "Tropical Smoothie Bowl", priceCents: 2800 },
      ],
    },
  ];

  for (const r of restaurantSeeds) {
    const existing = await prisma.restaurant.findFirst({ where: { name: r.name } });
    if (existing) continue;
    await prisma.restaurant.create({
      data: {
        name: r.name,
        description: r.description,
        area: r.area,
        menuItems: { create: r.items.map((i) => ({ name: i.name, priceCents: i.priceCents })) },
      },
    });
  }

  const listingSeeds: {
    title: string;
    description: string;
    type: "RENT" | "SALE" | "SHORT_STAY";
    priceCents: number;
    area: string;
    bedrooms: number;
  }[] = [
    {
      title: "2-Bedroom Apartment, East Legon",
      description: "Furnished, gated community, backup power.",
      type: "RENT",
      priceCents: 350000,
      area: "East Legon, Accra",
      bedrooms: 2,
    },
    {
      title: "Cozy Studio, Airbnb-style, Osu",
      description: "Short-stay studio near the beach and nightlife.",
      type: "SHORT_STAY",
      priceCents: 45000,
      area: "Osu, Accra",
      bedrooms: 1,
    },
  ];

  for (const l of listingSeeds) {
    const existing = await prisma.propertyListing.findFirst({ where: { title: l.title } });
    if (existing) continue;
    await prisma.propertyListing.create({
      data: { ownerId: admin.id, ...l, status: "ACTIVE" },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded sample restaurants/menu items and property listings for Eat and Property tiles.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
