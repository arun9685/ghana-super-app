import { prisma } from "@/database/prisma";
import { notify } from "@/modules/notifications/notifications.service";
import { NotFoundError, ForbiddenError } from "@/common/errors";
import type { PropertyListingType } from "@prisma/client";

// spec's "Property" service tile — real-estate listings + enquiries.
// New listings start PENDING_REVIEW so a PLATFORM_ADMIN can moderate
// before they go public (spec's general pattern of admin-gated supply
// onboarding, matching driver/artisan verification flows elsewhere).
export async function createListing(
  ownerId: string,
  input: {
    title: string;
    description: string;
    type: PropertyListingType;
    priceCents: number;
    area: string;
    lat?: number;
    lng?: number;
    bedrooms?: number;
  }
) {
  return prisma.propertyListing.create({
    data: { ownerId, ...input, status: "PENDING_REVIEW" },
  });
}

export async function listMyListings(ownerId: string) {
  return prisma.propertyListing.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" } });
}

export async function searchListings(filters: { type?: PropertyListingType; area?: string; maxPriceCents?: number }) {
  return prisma.propertyListing.findMany({
    where: {
      status: "ACTIVE",
      type: filters.type,
      area: filters.area ? { contains: filters.area, mode: "insensitive" } : undefined,
      priceCents: filters.maxPriceCents ? { lte: filters.maxPriceCents } : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getListing(id: string) {
  const listing = await prisma.propertyListing.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true, phone: true } } } });
  if (!listing) throw new NotFoundError("Listing not found");
  return listing;
}

export async function updateListingStatus(actorId: string, actorIsAdmin: boolean, listingId: string, status: "ACTIVE" | "PENDING_REVIEW" | "REMOVED") {
  const listing = await prisma.propertyListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new NotFoundError("Listing not found");
  if (!actorIsAdmin && listing.ownerId !== actorId) throw new ForbiddenError("Not your listing");
  // Only an admin can (re)activate a listing — an owner can only pull
  // their own listing down, keeping the moderation gate meaningful.
  if (!actorIsAdmin && status === "ACTIVE") throw new ForbiddenError("Only an admin can activate a listing");

  return prisma.propertyListing.update({ where: { id: listingId }, data: { status } });
}

export async function enquire(userId: string, listingId: string, message: string) {
  const listing = await prisma.propertyListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new NotFoundError("Listing not found");

  const enquiry = await prisma.propertyEnquiry.create({ data: { listingId, userId, message } });

  await notify({
    userId: listing.ownerId,
    type: "PROPERTY_ENQUIRY",
    title: "New enquiry on your listing",
    body: `${listing.title}: "${message.slice(0, 120)}"`,
    data: { listingId },
  });

  return enquiry;
}

export async function listEnquiriesForOwner(ownerId: string, listingId: string) {
  const listing = await prisma.propertyListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing.ownerId !== ownerId) throw new ForbiddenError("Not your listing");

  return prisma.propertyEnquiry.findMany({
    where: { listingId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
}
