import { Router } from "express";
import {
  createReservation,
  checkInGuest,
  checkOutGuest,
  switchRoom,
} from "../services/reservationService";
import { prisma } from "../db/prisma";

export const reservationsRouter = Router();

reservationsRouter.get("/", async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.hotelId) where.hotelId = req.query.hotelId;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        primaryGuest: { include: { identities: true } },
        room: true,
        roomType: true,
        ratePlan: true,
        folio: { include: { payments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: bookings, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/", async (req, res, next) => {
  try {
    const booking = await createReservation(req.body);
    res.status(201).json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-in", async (req, res, next) => {
  try {
    const { roomId, userId } = req.body;
    const booking = await checkInGuest(req.params.id, roomId, userId);
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-out", async (req, res, next) => {
  try {
    const { userId } = req.body;
    const booking = await checkOutGuest(req.params.id, userId);
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/room-switch", async (req, res, next) => {
  try {
    const { newRoomId, reason, userId } = req.body;
    const booking = await switchRoom(req.params.id, newRoomId, reason, userId);
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
