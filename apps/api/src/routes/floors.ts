import { Router } from "express";
import { getFloors, createFloor } from "../services/roomService";
import { ApiResponse } from "@hotel/types";
import { requirePermission } from "../middleware/auth";

export const floorsRouter = Router();

// GET /floors
floorsRouter.get("/", requirePermission("room:read"), async (req, res, next) => {
  try {
    const floors = await getFloors(req.query.hotelId as string);
    const response: ApiResponse<typeof floors> = {
      success: true,
      data: floors,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /floors
floorsRouter.post("/", requirePermission("room:write"), async (req, res, next) => {
  try {
    const created = await createFloor(req.body);
    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
