import { Router } from "express";
import {
  getRooms,
  getRoomById,
  createRoom,
  updateRoomStatus,
  bulkUpdateRoomStatus,
  getRoomTypes,
  getRatePlans,
} from "../services/roomService";
import { ApiResponse } from "@hotel/types";

export const roomsRouter = Router();

roomsRouter.get("/", async (req, res, next) => {
  try {
    const rooms = await getRooms({
      hotelId: req.query.hotelId as string,
      status: req.query.status as any,
      floorId: req.query.floorId as string,
      roomTypeId: req.query.roomTypeId as string,
      search: req.query.search as string,
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

roomsRouter.get("/types", async (req, res, next) => {
  try {
    const types = await getRoomTypes(req.query.hotelId as string);
    res.json({ success: true, data: types, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

roomsRouter.get("/rate-plans", async (req, res, next) => {
  try {
    const plans = await getRatePlans(req.query.hotelId as string);
    res.json({ success: true, data: plans, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

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

roomsRouter.post("/", async (req, res, next) => {
  try {
    const room = await createRoom(req.body);
    res.status(201).json({ success: true, data: room, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

roomsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const { status, userId } = req.body;
    const updated = await updateRoomStatus(req.params.id, status, userId);
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/bulk-status", async (req, res, next) => {
  try {
    const { roomIds, status, userId } = req.body;
    const result = await bulkUpdateRoomStatus(roomIds, status, userId);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
