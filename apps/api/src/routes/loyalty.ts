import { Router } from "express";
import {
  getOrCreateLoyaltyAccount,
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
} from "../services/loyaltyService";

export const loyaltyRouter = Router();

loyaltyRouter.get("/account/:guestId", async (req, res, next) => {
  try {
    const account = await getOrCreateLoyaltyAccount(req.params.guestId);
    res.json({ success: true, data: account, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

loyaltyRouter.post("/earn", async (req, res, next) => {
  try {
    const account = await earnLoyaltyPoints(req.body);
    res.json({ success: true, data: account, message: "Points credited successfully", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

loyaltyRouter.post("/redeem", async (req, res, next) => {
  try {
    const result = await redeemLoyaltyPoints(req.body);
    res.json({ success: true, data: result, message: "Points redeemed and posted to folio", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
