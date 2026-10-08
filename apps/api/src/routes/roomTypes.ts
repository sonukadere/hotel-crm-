import { Router } from "express";
import {
  getRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} from "../services/roomService";
import { ApiResponse } from "@hotel/types";

import { requirePermission } from "../middleware/auth";

export const roomTypesRouter = Router();

// GET /room-types
roomTypesRouter.get("/", requirePermission("room:read"), async (req, res, next) => {
  try {
    const types = await getRoomTypes(req.query.hotelId as string);
    const response: ApiResponse<typeof types> = {
      success: true,
      data: types,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /room-types/:id
roomTypesRouter.get("/:id", requirePermission("room:read"), async (req, res, next) => {
  try {
    const type = await getRoomTypeById(req.params.id);
    if (!type) {
      res.status(404).json({ success: false, message: "Room type not found", timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: type, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /room-types
roomTypesRouter.post("/", requirePermission("room:write"), async (req, res, next) => {
  try {
    const created = await createRoomType(req.body);
    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /room-types/:id
roomTypesRouter.patch("/:id", requirePermission("room:write"), async (req, res, next) => {
  try {
    const updated = await updateRoomType(req.params.id, req.body);
    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /room-types/:id
roomTypesRouter.delete("/:id", requirePermission("room:write"), async (req, res, next) => {
  try {
    const result = await deleteRoomType(req.params.id);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

