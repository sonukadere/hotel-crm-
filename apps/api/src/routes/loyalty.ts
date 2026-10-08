import { Router } from "express";
import {
  getOrCreateLoyaltyAccount,
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
  reverseLoyaltyTransaction,
  adjustLoyaltyPoints,
} from "../services/loyaltyService";
import {
  getLoyaltySettings,
  updateLoyaltySettings,
} from "../services/loyaltySettingsService";
import { requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  loyaltyAdjustSchema,
  loyaltyEarnSchema,
  loyaltyRedeemSchema,
  loyaltyReverseSchema,
  loyaltySettingsUpdateSchema,
} from "../validation/schemas";

export const loyaltyRouter = Router();

/**
 * GET /loyalty/settings
 * Manager+: Get tier thresholds, points per rupee, redemption value, expiry rules, eligible services
 */
loyaltyRouter.get("/settings", requirePermission("loyalty:read"), async (req, res, next) => {
  try {
    const hotelId = req.query.hotelId as string | undefined;
    const { settings } = await getLoyaltySettings(hotelId);
    res.json({ success: true, data: settings, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /loyalty/settings
 * Manager+: Update tier thresholds, points per rupee, redemption value, expiry rules, eligible services
 */
loyaltyRouter.put("/settings", requirePermission("settings:write"), validateBody(loyaltySettingsUpdateSchema), async (req, res, next) => {
  try {
    const updated = await updateLoyaltySettings(req.body);
    res.json({
      success: true,
      data: updated,
      message: "Loyalty program settings updated successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /loyalty/account/:guestId
 * Returns guest account: current tier, available, lifetime, redeemed points, expiry info, tier progress
 */
loyaltyRouter.get("/account/:guestId", requirePermission("loyalty:read"), async (req, res, next) => {
  try {
    const hotelId = req.query.hotelId as string | undefined;
    const account = await getOrCreateLoyaltyAccount(req.params.guestId, hotelId);
    res.json({ success: true, data: account, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /loyalty/earn
 * Manager+: Calculate and credit points from eligible INR spend
 */
loyaltyRouter.post("/earn", requirePermission("loyalty:adjust"), validateBody(loyaltyEarnSchema), async (req, res, next) => {
  try {
    const result = await earnLoyaltyPoints(req.body);
    res.json({
      success: true,
      data: result,
      message: "Points credited successfully from eligible spend",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /loyalty/redeem
 * Redeem points against eligible folio charges: Folio Credit + Loyalty Transaction
 */
loyaltyRouter.post("/redeem", requirePermission("loyalty:read"), validateBody(loyaltyRedeemSchema), async (req, res, next) => {
  try {
    const result = await redeemLoyaltyPoints(req.body);
    res.json({
      success: true,
      data: result,
      message: "Points redeemed and posted as folio payment credit",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /loyalty/reverse
 * Manager+: Reverse applicable loyalty transaction on payment/refund reversal
 */
loyaltyRouter.post("/reverse", requirePermission("loyalty:adjust"), validateBody(loyaltyReverseSchema), async (req, res, next) => {
  try {
    const result = await reverseLoyaltyTransaction(req.body);
    res.json({
      success: true,
      data: result,
      message: "Loyalty transaction successfully reversed",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /loyalty/adjust
 * Manager+: Admin manual points adjustment with immutable audit trail
 */
loyaltyRouter.post("/adjust", requirePermission("loyalty:adjust"), validateBody(loyaltyAdjustSchema), async (req, res, next) => {
  try {
    const result = await adjustLoyaltyPoints(req.body);
    res.json({
      success: true,
      data: result,
      message: "Points adjusted successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});