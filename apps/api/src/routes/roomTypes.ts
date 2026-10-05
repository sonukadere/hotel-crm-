import { Router } from "express";
import { getRoomTypes, createRoomType, updateRoomType } from "../services/roomService";
import { ApiResponse } from "@hotel/types";

export const roomTypesRouter = Router();

// GET /room-types
roomTypesRouter.get("/", async (req, res, next) => {
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

// POST /room-types
roomTypesRouter.post("/", async (req, res, next) => {
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
roomTypesRouter.patch("/:id", async (req, res, next) => {
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
