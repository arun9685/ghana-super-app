import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import * as pricingService from "@/modules/pricing/pricing.service";

// spec §21-22. Publicly readable — the frontend needs the rate card to
// show a fare estimate before the rider logs in.
export const pricingRouter = Router();

pricingRouter.get(
  "/rules",
  asyncHandler(async (_req, res) => {
    const rules = await pricingService.listPricingRules();
    res.status(200).json({ success: true, data: rules });
  })
);
