import { Router } from "express";
import {
  getRatePlans,
  getRatePlanById,
  createRatePlan,
  updateRatePlan,
  deleteRatePlan,
} from "../services/roomService";
import { ApiResponse } from "@hotel/types";
import { requirePermission } from "../middleware/auth";

export const ratePlansRouter = Router();

// GET /rate-plans
ratePlansRouter.get("/", requirePermission("room:read"), async (req, res, next) => {
  try {
    const plans = await getRatePlans(
      req.query.hotelId as string,
      req.query.roomTypeId as string,
    );
    const response: ApiResponse<typeof plans> = {
      success: true,
      data: plans,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /rate-plans/:id
ratePlansRouter.get("/:id", requirePermission("room:read"), async (req, res, next) => {
  try {
    const plan = await getRatePlanById(req.params.id);
    if (!plan) {
      res.status(404).json({ success: false, message: "Rate plan not found", timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: plan, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rate-plans
ratePlansRouter.post("/", requirePermission("room:write"), async (req, res, next) => {
  try {
    const created = await createRatePlan(req.body);
    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /rate-plans/:id
ratePlansRouter.patch("/:id", requirePermission("room:write"), async (req, res, next) => {
  try {
    const updated = await updateRatePlan(req.params.id, req.body);
    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /rate-plans/:id
ratePlansRouter.delete("/:id", requirePermission("room:write"), async (req, res, next) => {
  try {
    const result = await deleteRatePlan(req.params.id);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

