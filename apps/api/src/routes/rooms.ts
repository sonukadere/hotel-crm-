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
import { actorId, requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { bulkRoomStatusSchema, roomSchema, roomStatusSchema } from "../validation/schemas";

export const roomsRouter = Router();

/** Client-supplied identity is never trusted as the audit actor. */
function withoutUserId<T>(body: T): Omit<T, "userId"> {
  const { userId: _dropped, ...rest } = body as T & Record<string, unknown>;
  return rest as Omit<T, "userId">;
}

// GET /rooms - List rooms with filters (hotelId, status, floorId, roomTypeId, search, isActive)
roomsRouter.get("/", requirePermission("room:read"), async (req, res, next) => {
  try {
    const rooms = await getRooms({
      hotelId: req.query.hotelId as string,
      status: req.query.status as any,
      floorId: req.query.floorId as string,
      roomTypeId: req.query.roomTypeId as string,
      search: req.query.search as string,
      isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
    });
    res.json({ success: true, data: rooms, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /rooms/types - Also accessible directly
roomsRouter.get("/types", requirePermission("room:read"), async (req, res, next) => {
  try {
    const types = await getRoomTypes(req.query.hotelId as string);
    res.json({ success: true, data: types, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rooms/types
roomsRouter.post("/types", requirePermission("room:write"), async (req, res, next) => {
  try {
    const created = await createRoomType(req.body);
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /rooms/rate-plans
roomsRouter.get("/rate-plans", requirePermission("room:read"), async (req, res, next) => {
  try {
    const plans = await getRatePlans(req.query.hotelId as string, req.query.roomTypeId as string);
    res.json({ success: true, data: plans, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rooms/rate-plans
roomsRouter.post("/rate-plans", requirePermission("room:write"), async (req, res, next) => {
  try {
    const plan = await createRatePlan(req.body);
    res.status(201).json({ success: true, data: plan, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /rooms/:id - Get room by ID
roomsRouter.get("/:id", requirePermission("room:read"), async (req, res, next) => {
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
roomsRouter.post("/", requirePermission("room:write"), validateBody(roomSchema), async (req, res, next) => {
  try {
    const room = await createRoom(req.body);
    res.status(201).json({ success: true, data: room, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// PATCH /rooms/:id - Edit room
roomsRouter.patch("/:id", requirePermission("room:write"), async (req, res, next) => {
  try {
    const updated = await updateRoom(req.params.id, withoutUserId(req.body), actorId(req));
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// DELETE /rooms/:id - Deactivate or soft-delete room
roomsRouter.delete("/:id", requirePermission("room:write"), async (req, res, next) => {
  try {
    const result = await deleteRoom(req.params.id, actorId(req));
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// PATCH /rooms/:id/status - Quick status update
roomsRouter.patch("/:id/status", requirePermission("room:status"), validateBody(roomStatusSchema), async (req, res, next) => {
  try {
    const { status } = req.body;
    const updated = await updateRoomStatus(req.params.id, status, actorId(req));
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /rooms/bulk-status - Bulk status update
roomsRouter.post("/bulk-status", requirePermission("room:status"), validateBody(bulkRoomStatusSchema), async (req, res, next) => {
  try {
    const { roomIds, status } = req.body;
    const result = await bulkUpdateRoomStatus(roomIds, status, actorId(req));
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});