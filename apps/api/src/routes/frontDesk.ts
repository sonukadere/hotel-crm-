import { Router } from "express";
import {
  getTapeChart,
  getFrontDeskDashboard,
  findGuestByMobile,
  upsertQuickCheckInGuest,
  validateCheckIn,
  checkIn,
  getCheckoutSummary,
  checkOut,
  switchBookingRoom,
  quoteReservation,
  getRoomAvailability,
} from "../services/frontDeskService";
import { createReservation } from "../services/reservationService";
import { actorId, requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  checkInSchema,
  checkOutSchema,
  guestUpsertSchema,
  reservationCreateSchema,
  reservationQuoteSchema,
  roomSwitchSchema,
} from "../validation/schemas";

export const frontDeskRouter = Router();

/** HTTP callers can never bypass the check-in validation gate. */
function toParams<T extends object>(body: unknown, userId?: string): T {
  return { ...(body as Record<string, unknown>), userId, force: undefined } as T;
}

// GET /api/front-desk/tape-chart
frontDeskRouter.get("/tape-chart", requirePermission("reservation:read"), async (req, res, next) => {
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

// GET /api/front-desk/dashboard
frontDeskRouter.get("/dashboard", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const data = await getFrontDeskDashboard(req.query.businessDate as string);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/front-desk/guest-search?mobile=9820012345
frontDeskRouter.get("/guest-search", requirePermission("guest:read"), async (req, res, next) => {
  try {
    const mobile = req.query.mobile as string;
    if (!mobile) {
      res.status(400).json({ success: false, message: "Mobile number is required", timestamp: new Date().toISOString() });
      return;
    }
    const guest = await findGuestByMobile(mobile);
    res.json({ success: true, data: guest, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/front-desk/quick-check-in-guest
frontDeskRouter.post("/quick-check-in-guest", requirePermission("guest:write"), validateBody(guestUpsertSchema), async (req, res, next) => {
  try {
    const guest = await upsertQuickCheckInGuest(req.body);
    res.status(201).json({ success: true, data: guest, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/front-desk/quote
frontDeskRouter.post("/quote", requirePermission("reservation:read"), validateBody(reservationQuoteSchema), async (req, res, next) => {
  try {
    const quote = await quoteReservation(req.body);
    res.json({ success: true, data: quote, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/front-desk/availability
frontDeskRouter.get("/availability", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const checkInDate = req.query.checkInDate as string;
    const checkOutDate = req.query.checkOutDate as string;
    if (!checkInDate || !checkOutDate) {
      res.status(400).json({ success: false, message: "checkInDate and checkOutDate are required", timestamp: new Date().toISOString() });
      return;
    }
    const data = await getRoomAvailability({
      checkInDate,
      checkOutDate,
      hotelId: req.query.hotelId as string,
      roomTypeId: req.query.roomTypeId as string,
      floorId: req.query.floorId as string,
    });
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/front-desk/validate-check-in/:bookingId
frontDeskRouter.get("/validate-check-in/:bookingId", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const validation = await validateCheckIn(req.params.bookingId, {
      roomId: req.query.roomId as string,
    });
    res.json({ success: true, data: validation, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/front-desk/check-in
frontDeskRouter.post("/check-in", requirePermission("reservation:checkin"), validateBody(checkInSchema), async (req, res, next) => {
  try {
    const booking = await checkIn(toParams<Parameters<typeof checkIn>[0]>(req.body, actorId(req)));
    res.json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/front-desk/checkout-summary/:bookingId
frontDeskRouter.get("/checkout-summary/:bookingId", requirePermission("reservation:read"), async (req, res, next) => {
  try {
    const summary = await getCheckoutSummary(req.params.bookingId);
    res.json({ success: true, data: summary, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/front-desk/check-out
frontDeskRouter.post("/check-out", requirePermission("reservation:checkout"), validateBody(checkOutSchema), async (req, res, next) => {
  try {
    const result = await checkOut(toParams<Parameters<typeof checkOut>[0]>(req.body, actorId(req)));
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/front-desk/room-switch
frontDeskRouter.post("/room-switch", requirePermission("reservation:room-switch"), validateBody(roomSwitchSchema), async (req, res, next) => {
  try {
    const result = await switchBookingRoom(toParams<Parameters<typeof switchBookingRoom>[0]>(req.body, actorId(req)));
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/front-desk/reservations
frontDeskRouter.post("/reservations", requirePermission("reservation:write"), validateBody(reservationCreateSchema), async (req, res, next) => {
  try {
    const booking = await createReservation(req.body);
    res.status(201).json({ success: true, data: booking, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});