import { z } from "zod";

export const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z
    .array(z.object({ menuItemId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(20) }))
    .min(1),
  deliveryAddress: z.string().min(1).max(200),
  deliveryLat: z.number().min(-90).max(90),
  deliveryLng: z.number().min(-180).max(180),
  paymentMethod: z.enum(["CASH", "MOMO", "CARD", "WALLET"]).default("CASH"),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
});
