import { prisma } from "@/database/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/common/errors";
import { notify } from "@/modules/notifications/notifications.service";
import type { ArtisanCategory, ServiceRequestStatus } from "@prisma/client";

// "Fix" service tile: home services & artisans. Matching here is
// deliberately simple (browse-and-request rather than automated nearest-
// artisan dispatch like rides/matching.service.ts) — a real version would
// likely reuse that same Redis-GEO matching approach once there's enough
// artisan density to make automatic assignment better than customer choice.
export async function applyAsArtisan(userId: string, category: ArtisanCategory, bio?: string) {
  const existing = await prisma.artisanProfile.findUnique({ where: { userId } });
  if (existing) {
    return prisma.artisanProfile.update({ where: { userId }, data: { category, bio } });
  }
  return prisma.$transaction(async (tx) => {
    const profile = await tx.artisanProfile.create({ data: { userId, category, bio } });
    await tx.userRole.upsert({
      where: { userId_role: { userId, role: "ARTISAN" } },
      update: {},
      create: { userId, role: "ARTISAN" },
    });
    return profile;
  });
}

export async function listArtisans(category?: ArtisanCategory) {
  return prisma.artisanProfile.findMany({
    where: { verificationStatus: "APPROVED", ...(category ? { category } : {}) },
    include: { user: { select: { name: true, phone: true } } },
    orderBy: { ratingAvg: "desc" },
  });
}

export async function createServiceRequest(
  customerId: string,
  category: ArtisanCategory,
  description: string,
  address: string,
  lat: number,
  lng: number
) {
  return prisma.serviceRequest.create({
    data: { customerId, category, description, address, lat, lng },
  });
}

export async function listMyServiceRequests(customerId: string) {
  return prisma.serviceRequest.findMany({
    where: { customerId },
    include: { artisanProfile: { include: { user: { select: { name: true, phone: true } } } } },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
}

export async function listOpenServiceRequests(category?: ArtisanCategory) {
  return prisma.serviceRequest.findMany({
    where: { status: "REQUESTED", ...(category ? { category } : {}) },
    include: { customer: { select: { name: true, phone: true } } },
    orderBy: { requestedAt: "desc" },
  });
}

export async function acceptServiceRequest(userId: string, requestId: string, quotedPriceCents: number) {
  const artisan = await prisma.artisanProfile.findUnique({ where: { userId } });
  if (!artisan) throw new NotFoundError("No artisan profile");
  if (artisan.verificationStatus !== "APPROVED") throw new ForbiddenError("Your artisan account is not yet approved");

  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Request not found");
  if (request.status !== "REQUESTED") throw new ConflictError("This request has already been accepted");

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { artisanProfileId: artisan.id, status: "ACCEPTED", quotedPriceCents },
  });
  await notify({
    userId: request.customerId,
    type: "SERVICE_REQUEST_ACCEPTED",
    title: "An artisan accepted your request",
    body: `Quoted price: GHS ${(quotedPriceCents / 100).toFixed(2)}`,
    data: { requestId },
  });
  return updated;
}

const NEXT_STATUS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  REQUESTED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateServiceRequestStatus(userId: string, requestId: string, nextStatus: ServiceRequestStatus) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { artisanProfile: true },
  });
  if (!request) throw new NotFoundError("Request not found");
  const isArtisan = request.artisanProfile?.userId === userId;
  const isCustomer = request.customerId === userId;
  if (!isArtisan && !isCustomer) throw new ForbiddenError("You cannot update this request");
  if (!NEXT_STATUS[request.status].includes(nextStatus)) {
    throw new ConflictError(`Request cannot move from ${request.status} to ${nextStatus}`);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? new Date() : undefined,
      finalPriceCents: nextStatus === "COMPLETED" ? request.quotedPriceCents : undefined,
      paymentStatus: nextStatus === "COMPLETED" ? "PAID" : undefined,
    },
  });

  if (nextStatus === "COMPLETED" && request.artisanProfileId) {
    await prisma.artisanProfile.update({
      where: { id: request.artisanProfileId },
      data: { completedJobCount: { increment: 1 } },
    });
  }

  return updated;
}
