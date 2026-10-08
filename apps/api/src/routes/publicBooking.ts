import { Router } from "express";
import { cleanIndianMobile, isValidIndianMobile } from "@hotel/utils";
import { ApiResponse } from "@hotel/types";
import {
  getPublicBookingConfirmation,
  getPublicHotel,
  getPublicRoomType,
  getPublicRoomTypes,
  getPublicServices,
  confirmPublicBooking,
  createPublicCheckout,
  quotePublicBooking,
  searchPublicRooms,
  type PublicSearchInput,
} from "../services/publicBookingService";
import { createCRMLead } from "../services/crmService";

export const publicBookingRouter = Router();

function ok<T>(data: T) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  return response;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------
// CATALOG
// ---------------------------------------------------------------------------

// GET /public/hotel
publicBookingRouter.get("/hotel", async (req, res, next) => {
  try {
    res.json(ok(await getPublicHotel(optionalString(req.query.hotelId))));
  } catch (err) {
    next(err);
  }
});

// GET /public/room-types
publicBookingRouter.get("/room-types", async (req, res, next) => {
  try {
    res.json(ok(await getPublicRoomTypes(optionalString(req.query.hotelId))));
  } catch (err) {
    next(err);
  }
});

// GET /public/room-types/:id
publicBookingRouter.get("/room-types/:id", async (req, res, next) => {
  try {
    res.json(ok(await getPublicRoomType(req.params.id, optionalString(req.query.hotelId))));
  } catch (err) {
    next(err);
  }
});

// GET /public/services
publicBookingRouter.get("/services", async (req, res, next) => {
  try {
    res.json(ok(await getPublicServices(optionalString(req.query.hotelId))));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// SEARCH + PRICING
// ---------------------------------------------------------------------------

// GET /public/search
publicBookingRouter.get("/search", async (req, res, next) => {
  try {
    const input: PublicSearchInput = {
      hotelId: optionalString(req.query.hotelId),
      checkInDate: optionalString(req.query.checkInDate) ?? "",
      checkOutDate: optionalString(req.query.checkOutDate) ?? "",
      adults: optionalNumber(req.query.adults),
      children: optionalNumber(req.query.children),
      rooms: optionalNumber(req.query.rooms),
      mealPlan: optionalString(req.query.mealPlan),
      roomTypeId: optionalString(req.query.roomTypeId),
      guestStateCode: optionalString(req.query.guestStateCode),
    };
    res.json(ok(await searchPublicRooms(input)));
  } catch (err) {
    next(err);
  }
});

// POST /public/quote - server-side price for the stay the guest is reviewing
publicBookingRouter.post("/quote", async (req, res, next) => {
  try {
    res.json(ok(await quotePublicBooking(req.body)));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// CHECKOUT
// ---------------------------------------------------------------------------

// POST /public/checkout - creates the Razorpay order and the signed amount token
publicBookingRouter.post("/checkout", async (req, res, next) => {
  try {
    res.json(ok(await createPublicCheckout(req.body)));
  } catch (err) {
    next(err);
  }
});

// POST /public/confirm - verifies payment, recalculates the price and books
publicBookingRouter.post("/confirm", async (req, res, next) => {
  try {
    const body = asBody(req.body);
    const razorpay = asBody(body.razorpay);
    if (!body.selection || !body.guest) {
      res.status(400).json({
        success: false,
        message: "Stay selection and guest details are required",
        errors: ["Stay selection and guest details are required"],
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const result = await confirmPublicBooking({
      token: typeof body.token === "string" ? body.token : "",
      razorpay: {
        orderId: typeof razorpay.orderId === "string" ? razorpay.orderId : "",
        paymentId: typeof razorpay.paymentId === "string" ? razorpay.paymentId : "",
        signature: typeof razorpay.signature === "string" ? razorpay.signature : "",
      },
      selection: body.selection as never,
      guest: body.guest as never,
    });
    res.status(201).json(ok(result));
  } catch (err) {
    next(err);
  }
});

// GET /public/bookings/:bookingNumber?mobile= - fetch a confirmed booking
publicBookingRouter.get("/bookings/:bookingNumber", async (req, res, next) => {
  try {
    const confirmation = await getPublicBookingConfirmation(
      req.params.bookingNumber,
      optionalString(req.query.mobile) ?? "",
    );
    res.json(ok(confirmation));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// ENQUIRIES
// ---------------------------------------------------------------------------

// POST /public/enquiries - contact / group enquiry that lands in the CRM
publicBookingRouter.post("/enquiries", async (req, res, next) => {
  try {
    const body = asBody(req.body);
    const hotel = await getPublicHotel(optionalString(body.hotelId));

    const errors: string[] = [];
    const guestName = typeof body.guestName === "string" ? body.guestName.trim() : "";
    const mobile = cleanIndianMobile(typeof body.mobile === "string" ? body.mobile : "");

    if (guestName.length < 2) errors.push("Name is required");
    if (!isValidIndianMobile(mobile)) {
      errors.push("Enter a valid 10-digit Indian mobile number");
    }
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Please check the enquiry details",
        errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const lead = await createCRMLead({
      hotelId: hotel.id,
      guestName,
      mobile,
      email: optionalString(body.email),
      source: "Website",
      requirement: optionalString(body.requirement),
      expectedCheckIn: optionalString(body.expectedCheckIn),
      expectedCheckOut: optionalString(body.expectedCheckOut),
      guestCount: optionalNumber(body.guestCount),
      notes: optionalString(body.notes),
    });

    res.status(201).json(ok(lead));
  } catch (err) {
    next(err);
  }
});
