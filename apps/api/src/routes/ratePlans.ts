import { Router } from "express";
import { getRatePlans, createRatePlan, updateRatePlan } from "../services/roomService";
import { ApiResponse } from "@hotel/types";

export const ratePlansRouter = Router();

// GET /rate-plans
ratePlansRouter.get("/", async (req, res, next) => {
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

// POST /rate-plans
ratePlansRouter.post("/", async (req, res, next) => {
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
ratePlansRouter.patch("/:id", async (req, res, next) => {
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
