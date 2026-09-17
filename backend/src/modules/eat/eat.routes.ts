import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "@/modules/auth/auth.middleware";
import { asyncHandler } from "@/common/asyncHandler";
import { ValidationError } from "@/common/errors";
import { createOrderSchema, updateOrderStatusSchema } from "@/modules/eat/eat.validation";
import * as eatService from "@/modules/eat/eat.service";

// "Eat" service tile — real structure now, restaurant POS integration
// later (see restaurant.provider.ts).
export const eatRouter = Router();

eatRouter.get(
  "/restaurants",
  asyncHandler(async (req, res) => {
    const restaurants = await eatService.listRestaurants(req.query.area as string | undefined);
    res.status(200).json({ success: true, data: restaurants });
  })
);

eatRouter.get(
  "/restaurants/:id",
  asyncHandler(async (req, res) => {
    const restaurant = await eatService.getRestaurant(req.params.id!);
    res.status(200).json({ success: true, data: restaurant });
  })
);

eatRouter.post(
  "/orders",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid order", parsed.error.flatten());

    const order = await eatService.createOrder(
      authReq.user!.id,
      parsed.data.restaurantId,
      parsed.data.items,
      parsed.data.deliveryAddress,
      parsed.data.deliveryLat,
      parsed.data.deliveryLng,
      parsed.data.paymentMethod
    );
    res.status(201).json({ success: true, data: order });
  })
);

eatRouter.get(
  "/orders",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const asOwner = req.query.as === "owner";
    const orders = asOwner
      ? await eatService.listOrdersForOwner(authReq.user!.id)
      : await eatService.listMyOrders(authReq.user!.id);
    res.status(200).json({ success: true, data: orders });
  })
);

eatRouter.get(
  "/orders/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const order = await eatService.getOrder(authReq.user!.id, authReq.user!.roles, req.params.id!);
    res.status(200).json({ success: true, data: order });
  })
);

eatRouter.patch(
  "/orders/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid status", parsed.error.flatten());

    const order = await eatService.updateOrderStatus(authReq.user!.id, req.params.id!, parsed.data.status);
    res.status(200).json({ success: true, data: order });
  })
);
