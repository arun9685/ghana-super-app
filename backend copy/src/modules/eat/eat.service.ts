import { prisma } from "@/database/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/common/errors";
import { getRestaurantPosProvider } from "@/modules/eat/restaurant.provider";
import { notify } from "@/modules/notifications/notifications.service";
import type { FoodOrderStatus, PaymentMethod } from "@prisma/client";

const posProvider = getRestaurantPosProvider();
const DELIVERY_FEE_CENTS = 500;

export async function listRestaurants(area?: string) {
  return prisma.restaurant.findMany({
    where: { isActive: true, ...(area ? { area: { contains: area, mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function getRestaurant(id: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { menuItems: { where: { isAvailable: true } } },
  });
  if (!restaurant) throw new NotFoundError("Restaurant not found");
  return restaurant;
}

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
}

export async function createOrder(
  customerId: string,
  restaurantId: string,
  items: OrderItemInput[],
  deliveryAddress: string,
  deliveryLat: number,
  deliveryLng: number,
  paymentMethod: PaymentMethod
) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant || !restaurant.isActive) throw new NotFoundError("Restaurant not found");

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, restaurantId, isAvailable: true },
  });
  if (menuItems.length !== items.length) {
    throw new ValidationError("One or more menu items are unavailable or don't belong to this restaurant");
  }

  const priceByItem = new Map(menuItems.map((m) => [m.id, m.priceCents]));
  const subtotal = items.reduce((sum, i) => sum + (priceByItem.get(i.menuItemId) ?? 0) * i.quantity, 0);
  const total = subtotal + DELIVERY_FEE_CENTS;

  const order = await prisma.foodOrder.create({
    data: {
      customerId,
      restaurantId,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      itemsSubtotalCents: subtotal,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents: total,
      paymentMethod,
      paymentStatus: paymentMethod === "CASH" ? "PAID" : "PENDING",
      items: {
        create: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          unitPriceCents: priceByItem.get(i.menuItemId) ?? 0,
        })),
      },
    },
    include: { items: { include: { menuItem: true } }, restaurant: true },
  });

  await posProvider.notifyNewOrder(restaurantId, order.id);
  if (restaurant.ownerId) {
    await notify({
      userId: restaurant.ownerId,
      type: "FOOD_ORDER_NEW",
      title: "New order received",
      body: `A new order from ${restaurant.name} is waiting to be confirmed.`,
      data: { orderId: order.id },
    });
  }

  return order;
}

export async function getOrder(userId: string, roles: string[], orderId: string) {
  const order = await prisma.foodOrder.findUnique({
    where: { id: orderId },
    include: { items: { include: { menuItem: true } }, restaurant: true },
  });
  if (!order) throw new NotFoundError("Order not found");

  const isCustomer = order.customerId === userId;
  const isOwner = order.restaurant.ownerId === userId;
  const isAdmin = roles.includes("PLATFORM_ADMIN");
  if (!isCustomer && !isOwner && !isAdmin) throw new ForbiddenError("You cannot view this order");

  return order;
}

export async function listMyOrders(customerId: string) {
  return prisma.foodOrder.findMany({
    where: { customerId },
    include: { restaurant: { select: { name: true, area: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listOrdersForOwner(ownerId: string) {
  return prisma.foodOrder.findMany({
    where: { restaurant: { ownerId } },
    include: { items: { include: { menuItem: true } }, customer: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const NEXT_STATUS: Record<FoodOrderStatus, FoodOrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(userId: string, orderId: string, nextStatus: FoodOrderStatus) {
  const order = await prisma.foodOrder.findUnique({ where: { id: orderId }, include: { restaurant: true } });
  if (!order) throw new NotFoundError("Order not found");
  if (order.restaurant.ownerId !== userId) throw new ForbiddenError("You do not manage this restaurant");
  if (!NEXT_STATUS[order.status].includes(nextStatus)) {
    throw new ConflictError(`Order cannot move from ${order.status} to ${nextStatus}`);
  }

  const updated = await prisma.foodOrder.update({ where: { id: orderId }, data: { status: nextStatus } });
  await notify({
    userId: order.customerId,
    type: "FOOD_ORDER_STATUS",
    title: "Order update",
    body: `Your order from ${order.restaurant.name} is now ${nextStatus.replace(/_/g, " ").toLowerCase()}.`,
    data: { orderId },
  });
  return updated;
}
