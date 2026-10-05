import { Router } from "express";
import {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
  bulkUpdateRoomStatus,
  getRoomTypes,
  createRoomType,
  getRatePlans,
  createRatePlan,
} from "../services/roomService";
import { ApiResponse } from "@hotel/types";

export const roomsRouter = Router();

// GET /rooms - List rooms with filters (hotelId, status, floorId, roomTypeId, search, isActive)
roomsRouter.get("/", async (req, res, next) => {
  try {
    const rooms = await getRooms({
      hotelId: req.query.hotelId as string,
      status: req.query.status as any,
      floorId: req.query.floorId as string,
      roomTypeId: req.query.roomTypeId as string,
      search: req.query.search as string,
      isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
    });
    const response: ApiResponse<typeof rooms> = {
      success: true,
      data: rooms,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /rooms/types - Also accessible directly
roomsRouter.get("/types", async (req, res, next) => {
  try {
    const types = await getRoomTypes(req.query.hotelId as string);
    res.json({ success: true, data: types, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rooms/types
roomsRouter.post("/types", async (req, res, next) => {
  try {
    const created = await createRoomType(req.body);
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /rooms/rate-plans
roomsRouter.get("/rate-plans", async (req, res, next) => {
  try {
    const plans = await getRatePlans(req.query.hotelId as string, req.query.roomTypeId as string);
    res.json({ success: true, data: plans, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rooms/rate-plans
roomsRouter.post("/rate-plans", async (req, res, next) => {
  try {
    const plan = await createRatePlan(req.body);
    res.status(201).json({ success: true, data: plan, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /rooms/:id - Get room by ID
roomsRouter.get("/:id", async (req, res, next) => {
  try {
    const room = await getRoomById(req.params.id);
    if (!room) {
      res.status(404).json({ success: false, message: "Room not found", timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: room, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rooms - Create room
roomsRouter.post("/", async (req, res, next) => {
  try {
    const room = await createRoom(req.body);
    res.status(201).json({ success: true, data: room, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// PATCH /rooms/:id - Edit room
roomsRouter.patch("/:id", async (req, res, next) => {
  try {
    const updated = await updateRoom(req.params.id, req.body, req.body.userId);
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// DELETE /rooms/:id - Deactivate or soft-delete room
roomsRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await deleteRoom(req.params.id, req.body?.userId);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// PATCH /rooms/:id/status - Quick status update
roomsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const { status, userId } = req.body;
    const updated = await updateRoomStatus(req.params.id, status, userId);
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rooms/bulk-status - Bulk status update
roomsRouter.post("/bulk-status", async (req, res, next) => {
  try {
    const { roomIds, status, userId } = req.body;
    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      res.status(400).json({ success: false, message: "roomIds must be a non-empty array", timestamp: new Date().toISOString() });
      return;
    }
    const result = await bulkUpdateRoomStatus(roomIds, status, userId);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
