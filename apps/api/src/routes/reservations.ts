import { Router } from "express";
import { actorId, requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  checkInSchema,
  checkOutSchema,
  reservationCreateSchema,
  reservationQuoteSchema,
  roomSwitchSchema,
} from "../validation/schemas";
import {
  createReservation,
  checkInGuest,
  checkOutGuest,
  switchRoom,
} from "../services/reservationService";
import {
  getTapeChart,
  findGuestByMobile,
  getCheckoutSummary,
  validateCheckIn,
  quoteReservation,
} from "../services/frontDeskService";
import { prisma } from "../db/prisma";

export const reservationsRouter = Router();

// GET /reservations/tape-chart
reservationsRouter.get("/tape-chart", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const data = await getTapeChart({
      hotelId: req.query.hotelId as string,
      from: req.query.from as string,
      days: req.query.days ? parseInt(req.query.days as string, 10) : undefined,
      floorId: req.query.floorId as string,
      roomTypeId: req.query.roomTypeId as string,
      search: req.query.search as string,
    });
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /reservations/guest-search?mobile=9820012345
reservationsRouter.get("/guest-search", requirePermission("guest:read"), async (req, res, next) => {
  try {
    const mobile = req.query.mobile as string;
    if (!mobile) {
      res.status(400).json({ success: false, message: "Mobile is required", timestamp: new Date().toISOString() });
      return;
    }
    const guest = await findGuestByMobile(mobile);
    res.json({ success: true, data: guest, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /reservations/quote
reservationsRouter.post("/quote", requirePermission("reservation:read"), validateBody(reservationQuoteSchema), async (req, res, next) => {
  try {
    const quote = await quoteReservation(req.body);
    res.json({ success: true, data: quote, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /reservations - List bookings
reservationsRouter.get("/", requirePermission("reservation:read"), async (req, res, next) => {
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

// GET /reservations/:id - Single booking
reservationsRouter.get("/:id", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        primaryGuest: { include: { identities: true } },
        room: true,
        roomType: true,
        ratePlan: true,
        folio: { include: { payments: true, items: true, gstTransactions: true } },
      },
    });
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found", timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /reservations/:id/checkout-summary
reservationsRouter.get("/:id/checkout-summary", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const summary = await getCheckoutSummary(req.params.id);
    res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /reservations/:id/validate-check-in
reservationsRouter.get("/:id/validate-check-in", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const validation = await validateCheckIn(req.params.id, {
      roomId: req.query.roomId as string,
    });
    res.json({ success: true, data: validation, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/", requirePermission("reservation:write"), validateBody(reservationCreateSchema), async (req, res, next) => {
  try {
    const booking = await createReservation(req.body);
    res.status(201).json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-in", requirePermission("reservation:checkin"), validateBody(checkInSchema), async (req, res, next) => {
  try {
    const { roomId } = req.body;
    const booking = await checkInGuest(req.params.id, roomId, actorId(req));
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-out", requirePermission("reservation:checkout"), validateBody(checkOutSchema), async (req, res, next) => {
  try {
    const booking = await checkOutGuest(req.params.id, actorId(req));
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/room-switch", requirePermission("reservation:room-switch"), validateBody(roomSwitchSchema), async (req, res, next) => {
  try {
    const { newRoomId, reason } = req.body;
    const booking = await switchRoom(req.params.id, newRoomId, reason, actorId(req));
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});