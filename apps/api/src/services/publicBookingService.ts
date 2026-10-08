import crypto from "crypto";
import type { BookingStatus, Prisma } from "@prisma/client";
import type { MealPlan, QuoteLine, ReservationQuote } from "@hotel/types";
import { prisma } from "../db/prisma";
import {
  buildReservationQuote,
  calculateServiceGST,
  cleanIndianMobile,
  isSellableRoomState,
  isValidGSTIN,
  isValidIndianMobile,
  numberToIndianWords,
  roundCurrency,
  toISODay,
  verifyRazorpayPaymentSignature,
} from "@hotel/utils";
import { getRoomAvailability } from "./frontDeskService";
import { getDefaultHotelId } from "./roomService";
import { recalculateFolio } from "./folioService";
import { recordAuditLog } from "./auditService";
import {
  sendBookingConfirmation,
  type BookingConfirmationPayload,
} from "./bookingConfirmationService";

// =============================================================================
// ERRORS
// =============================================================================

export class PublicBookingError extends Error {
  statusCode: number;
  errors: string[];

  constructor(message: string, errors: string[] = [], statusCode = 400) {
    super(message);
    this.name = "PublicBookingError";
    this.statusCode = statusCode;
    this.errors = errors.length > 0 ? errors : [message];
  }
}

function badRequest(message: string, errors?: string[]): PublicBookingError {
  return new PublicBookingError(message, errors ?? [message], 400);
}

function notFound(message: string): PublicBookingError {
  return new PublicBookingError(message, [message], 404);
}

function conflict(message: string): PublicBookingError {
  return new PublicBookingError(message, [message], 409);
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MEAL_PLAN_CODES: MealPlan[] = ["EP", "CP", "MAP", "AP"];
const HOLDING_STATUSES: BookingStatus[] = ["Tentative", "Confirmed", "CheckedIn"];
const MAX_PUBLIC_NIGHTS = 90;
const MAX_PUBLIC_ROOMS = 10;

const SERVICE_CATEGORY_TYPE: Record<string, "food" | "laundry" | "banquet" | "spa" | "other"> = {
  dining: "food",
  restaurant: "food",
  food: "food",
  "in-room dining": "food",
  laundry: "laundry",
  housekeeping: "laundry",
  banquet: "banquet",
  events: "banquet",
  spa: "spa",
  wellness: "spa",
};

const SERVICE_CATEGORY_ITEM_TYPE: Record<string, string> = {
  dining: "Restaurant",
  restaurant: "Restaurant",
  food: "Food",
  "in-room dining": "InRoomDining",
  laundry: "Laundry",
  housekeeping: "Housekeeping",
  banquet: "Banquet",
  spa: "Spa",
};

// =============================================================================
// PUBLIC DTOs
// =============================================================================

export interface PublicGuestInput {
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  state?: string;
  gstin?: string;
  specialRequests?: string;
}

export interface PublicServiceSelection {
  serviceId: string;
  quantity?: number;
}

export interface PublicStaySelection {
  hotelId?: string;
  roomTypeId: string;
  ratePlanId?: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  rooms?: number;
  mealPlan?: string;
  guestStateCode?: string;
  services?: PublicServiceSelection[];
}

export interface PublicServiceLine {
  serviceId: string;
  code: string;
  name: string;
  category: string;
  itemType: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface PublicGstBreakdown {
  total: number;
  placeOfSupply: string;
  isInterState: boolean;
  sacCode: string;
  room: { cgst: number; sgst: number; igst: number; gstRate: number };
  services: { cgst: number; sgst: number; igst: number; gstRate: number };
}

export interface PublicPriceSummary {
  roomSubtotal: number;
  services: number;
  discount: number;
  gst: number;
  finalAmount: number;
  amountInWords: string;
}

export interface PublicPriceQuote {
  rooms: number;
  nights: number;
  mealPlan: MealPlan;
  roomQuote: ReservationQuote;
  services: PublicServiceLine[];
  gst: PublicGstBreakdown;
  summary: PublicPriceSummary;
  lines: QuoteLine[];
  warnings: string[];
}

export interface PublicOffer {
  ratePlanId: string;
  ratePlanCode: string;
  ratePlanName: string;
  mealPlan: MealPlan;
  matchesRequestedMealPlan: boolean;
  basePrice: number;
  seasonalMultiplier: number;
  weekendMultiplier: number;
  quote: PublicPriceQuote | null;
  errors: string[];
}

export interface PublicRoomResult {
  roomTypeId: string;
  code: string;
  name: string;
  description: string | null;
  images: string[];
  amenities: string[];
  basePrice: number;
  occupancy: { baseAdults: number; maxAdults: number; maxChildren: number };
  totalRooms: number;
  availableRooms: number;
  roomsRequested: number;
  isAvailable: boolean;
  isOccupancyOk: boolean;
  mealPlan: MealPlan;
  availableMealPlans: MealPlan[];
  offers: PublicOffer[];
}

export interface PublicSearchResponse {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  roomsRequested: number;
  mealPlan: MealPlan | null;
  guestStateCode: string;
  results: PublicRoomResult[];
  availableRoomTypes: number;
}

export interface PublicRazorpayOrder {
  orderId: string;
  amount: number;
  amountINR: number;
  currency: string;
  keyId: string;
  demo: boolean;
}

// =============================================================================
// SMALL HELPERS
// =============================================================================

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function normaliseMealPlan(value: string | undefined, fallback: MealPlan): MealPlan {
  if (!value) return fallback;
  const code = value.toUpperCase() as MealPlan;
  if (!MEAL_PLAN_CODES.includes(code)) {
    throw badRequest(`Unsupported meal plan: ${value}`, [
      `Meal plan must be one of ${MEAL_PLAN_CODES.join(", ")}`,
    ]);
  }
  return code;
}

function normaliseCount(value: unknown, fallback: number, min: number, max: number, label: string): number {
  const parsed = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw badRequest(`${label} must be a whole number`);
  }
  if (parsed < min || parsed > max) {
    throw badRequest(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

interface NormalisedStay {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  rooms: number;
  mealPlan: MealPlan | null;
}

function normaliseStay(input: Partial<PublicStaySelection>): NormalisedStay {
  if (!input.checkInDate || !input.checkOutDate) {
    throw badRequest("Check-in and check-out dates are required", [
      "Check-in and check-out dates are required",
    ]);
  }

  let checkInDate: string;
  let checkOutDate: string;
  try {
    checkInDate = toISODay(input.checkInDate);
    checkOutDate = toISODay(input.checkOutDate);
  } catch {
    throw badRequest("Invalid date format. Use YYYY-MM-DD");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
    throw badRequest("Invalid date format. Use YYYY-MM-DD");
  }

  const today = toISODay(new Date());
  if (checkInDate < today) {
    throw badRequest("Check-in date cannot be in the past");
  }
  if (checkOutDate <= checkInDate) {
    throw badRequest("Check-out date must be after check-in date");
  }

  const nights = Math.round(
    (Date.parse(`${checkOutDate}T00:00:00.000Z`) - Date.parse(`${checkInDate}T00:00:00.000Z`)) /
      86_400_000,
  );
  if (nights > MAX_PUBLIC_NIGHTS) {
    throw badRequest(`Online bookings are limited to ${MAX_PUBLIC_NIGHTS} nights`);
  }

  return {
    checkInDate,
    checkOutDate,
    nights,
    adults: normaliseCount(input.adults, 1, 1, 12, "Adults"),
    children: normaliseCount(input.children, 0, 0, 10, "Children"),
    rooms: normaliseCount(input.rooms, 1, 1, MAX_PUBLIC_ROOMS, "Room count"),
    mealPlan: input.mealPlan ? normaliseMealPlan(input.mealPlan, "EP") : null,
  };
}

async function resolveHotel(hotelId?: string) {
  const id = hotelId || (await getDefaultHotelId());
  const hotel = await prisma.hotel.findUnique({ where: { id } });
  if (!hotel) throw notFound("Hotel not found");
  return hotel;
}

// =============================================================================
// CATALOG
// =============================================================================

export async function getPublicHotel(hotelId?: string) {
  const hotel = await resolveHotel(hotelId);
  return {
    id: hotel.id,
    name: hotel.name,
    code: hotel.code,
    address: hotel.address,
    city: hotel.city,
    state: hotel.state,
    pincode: hotel.pincode,
    phone: hotel.phone,
    email: hotel.email,
    gstin: hotel.gstin,
    stateCode: hotel.stateCode,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    currency: hotel.currency,
  };
}

export async function getPublicRoomTypes(hotelId?: string) {
  const hotel = await resolveHotel(hotelId);
  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId: hotel.id, isActive: true },
    include: { ratePlans: { where: { isActive: true } } },
    orderBy: { basePrice: "asc" },
  });
  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id, isActive: true },
    select: { roomTypeId: true, status: true },
  });

  return roomTypes.map((roomType) => {
    const mine = rooms.filter((room) => room.roomTypeId === roomType.id);
    return {
      roomTypeId: roomType.id,
      code: roomType.code,
      name: roomType.name,
      description: roomType.description,
      images: parseJsonArray(roomType.images),
      amenities: parseJsonArray(roomType.amenities),
      basePrice: Number(roomType.basePrice),
      occupancy: {
        baseAdults: roomType.baseAdults,
        maxAdults: roomType.maxAdults,
        maxChildren: roomType.maxChildren,
      },
      totalRooms: mine.length,
      sellableRooms: mine.filter((room) => isSellableRoomState(room.status)).length,
      mealPlans: MEAL_PLAN_CODES,
      ratePlans: roomType.ratePlans.map((plan) => ({
        ratePlanId: plan.id,
        code: plan.code,
        name: plan.name,
        mealPlan: plan.mealPlan,
        basePrice: Number(plan.baseRate),
        seasonalMultiplier: Number(plan.seasonalMultiplier),
        weekendMultiplier: Number(plan.weekendMultiplier),
        extraAdultRate: Number(plan.extraAdultRate),
        extraChildRate: Number(plan.extraChildRate),
      })),
    };
  });
}

export async function getPublicRoomType(roomTypeId: string, hotelId?: string) {
  const hotel = await resolveHotel(hotelId);
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId: hotel.id, isActive: true },
    include: { ratePlans: { where: { isActive: true } } },
  });
  if (!roomType) throw notFound("Room type not found");

  const totalRooms = await prisma.room.count({
    where: { roomTypeId: roomType.id, isActive: true },
  });

  return {
    roomTypeId: roomType.id,
    code: roomType.code,
    name: roomType.name,
    description: roomType.description,
    images: parseJsonArray(roomType.images),
    amenities: parseJsonArray(roomType.amenities),
    basePrice: Number(roomType.basePrice),
    occupancy: {
      baseAdults: roomType.baseAdults,
      maxAdults: roomType.maxAdults,
      maxChildren: roomType.maxChildren,
    },
    totalRooms,
    mealPlans: MEAL_PLAN_CODES,
    ratePlans: roomType.ratePlans.map((plan) => ({
      ratePlanId: plan.id,
      code: plan.code,
      name: plan.name,
      mealPlan: plan.mealPlan,
      basePrice: Number(plan.baseRate),
      seasonalMultiplier: Number(plan.seasonalMultiplier),
      weekendMultiplier: Number(plan.weekendMultiplier),
      extraAdultRate: Number(plan.extraAdultRate),
      extraChildRate: Number(plan.extraChildRate),
    })),
  };
}

export async function getPublicServices(hotelId?: string) {
  const hotel = await resolveHotel(hotelId);
  const services = await prisma.service.findMany({
    where: { hotelId: hotel.id, isActive: true },
    orderBy: { basePrice: "asc" },
  });

  return services.map((service) => ({
    serviceId: service.id,
    code: service.code,
    name: service.name,
    category: service.category,
    sacCode: service.sacCode,
    basePrice: Number(service.basePrice),
    gstRate: Number(service.gstRate),
  }));
}

// =============================================================================
// SELECTION RESOLUTION
// =============================================================================

interface ResolvedSelection {
  hotel: Awaited<ReturnType<typeof resolveHotel>>;
  roomType: Prisma.RoomTypeGetPayload<Record<string, never>>;
  ratePlan: Prisma.RatePlanGetPayload<Record<string, never>>;
  stay: NormalisedStay;
  mealPlan: MealPlan;
  guestStateCode: string;
}

async function resolveSelection(input: PublicStaySelection): Promise<ResolvedSelection> {
  if (!input.roomTypeId) throw badRequest("Room type is required");

  const hotel = await resolveHotel(input.hotelId);
  const stay = normaliseStay(input);

  const roomType = await prisma.roomType.findFirst({
    where: { id: input.roomTypeId, hotelId: hotel.id, isActive: true },
  });
  if (!roomType) throw notFound("Room type not found");

  const ratePlans = await prisma.ratePlan.findMany({
    where: { roomTypeId: roomType.id, hotelId: hotel.id, isActive: true },
    orderBy: { baseRate: "asc" },
  });
  if (ratePlans.length === 0) {
    throw badRequest("No active rate plan is available for this room type");
  }

  const ratePlan =
    (input.ratePlanId ? ratePlans.find((plan) => plan.id === input.ratePlanId) : undefined) ??
    ratePlans[0];
  if (!ratePlan) {
    throw badRequest("No active rate plan is available for this room type");
  }

  const mealPlan = normaliseMealPlan(input.mealPlan, ratePlan.mealPlan);

  if (stay.adults > roomType.maxAdults) {
    throw badRequest(
      `${stay.adults} adults exceeds the maximum occupancy of ${roomType.maxAdults} for ${roomType.name}`,
    );
  }
  if (stay.children > roomType.maxChildren) {
    throw badRequest(
      `${stay.children} children exceeds the maximum of ${roomType.maxChildren} for ${roomType.name}`,
    );
  }

  return {
    hotel,
    roomType,
    ratePlan,
    stay,
    mealPlan,
    guestStateCode: (input.guestStateCode || hotel.stateCode).trim().padStart(2, "0"),
  };
}

// =============================================================================
// AVAILABILITY
// =============================================================================

export interface AvailabilitySnapshot {
  totalRooms: number;
  availableRooms: number;
  roomsRequested: number;
  enoughRooms: boolean;
}

async function readAvailability(
  hotelId: string,
  roomTypeId: string,
  stay: NormalisedStay,
): Promise<AvailabilitySnapshot> {
  const availability = await getRoomAvailability({
    hotelId,
    roomTypeId,
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
  });
  const availableRooms = availability.rooms.filter((room) => room.isSellable).length;

  return {
    totalRooms: availability.rooms.length,
    availableRooms,
    roomsRequested: stay.rooms,
    enoughRooms: availableRooms >= stay.rooms,
  };
}

/**
 * Picks concrete, conflict-free rooms inside the booking transaction so an
 * online sale can never race its way into a double booking. Every room state
 * change on the public site goes through this gate.
 */
async function pickAvailableRooms(
  tx: Prisma.TransactionClient,
  params: { hotelId: string; roomTypeId: string; checkInDate: string; checkOutDate: string; count: number },
) {
  const rooms = await tx.room.findMany({
    where: {
      hotelId: params.hotelId,
      roomTypeId: params.roomTypeId,
      isActive: true,
      status: { notIn: ["Blocked", "Maintenance"] },
    },
    include: {
      bookings: {
        where: {
          status: { in: HOLDING_STATUSES },
          checkInDate: { lt: new Date(`${params.checkOutDate}T00:00:00.000Z`) },
          checkOutDate: { gt: new Date(`${params.checkInDate}T00:00:00.000Z`) },
        },
        select: { id: true },
      },
    },
    orderBy: { roomNumber: "asc" },
  });

  const free = rooms.filter((room) => room.bookings.length === 0);
  if (free.length < params.count) {
    throw conflict(
      `Only ${free.length} room(s) of this type are available for the selected dates. Please reduce the room count or change your dates.`,
    );
  }
  return free.slice(0, params.count);
}

// =============================================================================
// PRICING
// =============================================================================

async function resolveServices(
  hotelId: string,
  requested: PublicServiceSelection[] | undefined,
): Promise<
  {
    row: { id: string; code: string; name: string; category: string; sacCode: string; gstRate: number; basePrice: number };
    quantity: number;
  }[]
> {
  if (!requested || requested.length === 0) return [];

  const ids = Array.from(new Set(requested.map((item) => item.serviceId).filter(Boolean)));
  if (ids.length === 0) return [];

  const rows = await prisma.service.findMany({
    where: { id: { in: ids }, hotelId, isActive: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return requested.map((item) => {
    const row = byId.get(item.serviceId);
    if (!row) throw badRequest(`Service not available: ${item.serviceId}`);
    const quantity = normaliseCount(item.quantity, 1, 1, 20, `Quantity for ${row.name}`);
    return {
      row: {
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        sacCode: row.sacCode,
        gstRate: Number(row.gstRate),
        basePrice: Number(row.basePrice),
      },
      quantity,
    };
  });
}

/**
 * Builds the authoritative price quote. Every number the guest sees is
 * produced here on the server - the browser never calculates a payable amount.
 */
export async function buildPublicQuote(
  selection: ResolvedSelection,
  services: PublicServiceSelection[] | undefined,
): Promise<PublicPriceQuote> {
  const { hotel, roomType, ratePlan, stay, mealPlan, guestStateCode } = selection;

  const roomQuote = buildReservationQuote({
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    adults: stay.adults,
    children: stay.children,
    mealPlan,
    hotelStateCode: hotel.stateCode,
    guestStateCode,
    baseAdults: roomType.baseAdults,
    maxAdults: roomType.maxAdults,
    maxChildren: roomType.maxChildren,
    ratePlan: {
      baseRate: Number(ratePlan.baseRate),
      seasonalMultiplier: Number(ratePlan.seasonalMultiplier),
      weekendMultiplier: Number(ratePlan.weekendMultiplier),
      extraAdultRate: Number(ratePlan.extraAdultRate),
      extraChildRate: Number(ratePlan.extraChildRate),
      mealPlan: ratePlan.mealPlan as MealPlan,
      code: ratePlan.code,
      name: ratePlan.name,
    },
  });

  if (roomQuote.errors.length > 0) {
    throw badRequest("Unable to price this stay", roomQuote.errors);
  }

  const resolvedServices = await resolveServices(hotel.id, services);
  const serviceLines: PublicServiceLine[] = resolvedServices.map(({ row, quantity }) => {
    const subtotal = roundCurrency(quantity * row.basePrice);
    const category = (row.category || "").toLowerCase();
    const gst = calculateServiceGST({
      amount: subtotal,
      serviceType: SERVICE_CATEGORY_TYPE[category] ?? "other",
      hotelStateCode: hotel.stateCode,
      guestStateCode,
      customRate: row.gstRate || undefined,
      customSacCode: row.sacCode || undefined,
    });

    return {
      serviceId: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      itemType: SERVICE_CATEGORY_ITEM_TYPE[category] ?? "OtherService",
      sacCode: gst.sacCode,
      quantity,
      unitPrice: row.basePrice,
      subtotal,
      gstRate: gst.gstRate,
      gstAmount: gst.totalTax,
      total: gst.grandTotal,
    };
  });

  const rooms = stay.rooms;
  const roomCharges = roundCurrency(roomQuote.roomCharges * rooms);
  const extraCharges = roundCurrency(
    (roomQuote.extraCharges + roomQuote.mealPlanCharges) * rooms,
  );
  const roomSubtotal = roundCurrency(roomCharges + extraCharges);
  const discount = roundCurrency(roomQuote.discountAmount * rooms);
  const roomTaxable = roundCurrency(roomSubtotal - discount);
  const roomGst = roundCurrency(roomQuote.gst.totalTax * rooms);

  const servicesSubtotal = roundCurrency(
    serviceLines.reduce((sum, line) => sum + line.subtotal, 0),
  );
  const servicesGst = roundCurrency(serviceLines.reduce((sum, line) => sum + line.gstAmount, 0));
  const servicesGstCgst = roundCurrency(
    serviceLines.reduce(
      (sum, line) =>
        sum +
        (line.gstRate > 0 && !isInterState(hotel.stateCode, guestStateCode)
          ? line.gstAmount / 2
          : 0),
      0,
    ),
  );
  const gstTotal = roundCurrency(roomGst + servicesGst);
  const finalAmount = roundCurrency(roomTaxable + servicesSubtotal + gstTotal);

  const lines: QuoteLine[] = [
    {
      key: "roomCharges",
      label: `Room subtotal (${rooms} room${rooms === 1 ? "" : "s"} × ${stay.nights} night${stay.nights === 1 ? "" : "s"})`,
      amount: roomSubtotal,
      kind: "charge",
    },
    ...serviceLines.map<QuoteLine>((line) => ({
      key: `service:${line.serviceId}`,
      label: `${line.name} × ${line.quantity}`,
      amount: line.subtotal,
      kind: "charge",
    })),
  ];

  if (discount > 0) {
    lines.push({ key: "discount", label: "Discount", amount: -discount, kind: "discount" });
  }

  if (roomQuote.gst.isInterState) {
    if (roomQuote.gst.igstAmount > 0) {
      lines.push({
        key: "igst",
        label: `IGST @ ${(roomQuote.gst.igstRate * 100).toFixed(0)}% (accommodation)`,
        amount: roundCurrency(roomQuote.gst.igstAmount * rooms),
        kind: "tax",
      });
    }
  } else {
    if (roomQuote.gst.cgstAmount > 0) {
      lines.push({
        key: "cgst",
        label: `CGST @ ${(roomQuote.gst.cgstRate * 100).toFixed(0)}% (accommodation)`,
        amount: roundCurrency(roomQuote.gst.cgstAmount * rooms),
        kind: "tax",
      });
    }
    if (roomQuote.gst.sgstAmount > 0) {
      lines.push({
        key: "sgst",
        label: `SGST @ ${(roomQuote.gst.sgstRate * 100).toFixed(0)}% (accommodation)`,
        amount: roundCurrency(roomQuote.gst.sgstAmount * rooms),
        kind: "tax",
      });
    }
  }

  if (servicesGst > 0) {
    lines.push({
      key: "servicesGst",
      label: isInterState(hotel.stateCode, guestStateCode)
        ? "GST on services (IGST)"
        : "GST on services (CGST + SGST)",
      amount: servicesGst,
      kind: "tax",
    });
  }

  lines.push({
    key: "grandTotal",
    label: "Final amount payable",
    amount: finalAmount,
    kind: "total",
  });

  return {
    rooms,
    nights: stay.nights,
    mealPlan,
    roomQuote,
    services: serviceLines,
    gst: {
      total: gstTotal,
      placeOfSupply: guestStateCode,
      isInterState: isInterState(hotel.stateCode, guestStateCode),
      sacCode: roomQuote.gst.sacCode,
      room: {
        cgst: roundCurrency(roomQuote.gst.cgstAmount * rooms),
        sgst: roundCurrency(roomQuote.gst.sgstAmount * rooms),
        igst: roundCurrency(roomQuote.gst.igstAmount * rooms),
        gstRate: roomQuote.gst.gstRate,
      },
      services: {
        cgst: servicesGstCgst,
        sgst: roundCurrency(servicesGst - servicesGstCgst),
        igst: isInterState(hotel.stateCode, guestStateCode) ? servicesGst : 0,
        gstRate: serviceLines[0]?.gstRate ?? 0,
      },
    },
    summary: {
      roomSubtotal,
      services: servicesSubtotal,
      discount,
      gst: gstTotal,
      finalAmount,
      amountInWords: numberToIndianWords(finalAmount),
    },
    lines,
    warnings: roomQuote.warnings,
  };
}

function isInterState(hotelStateCode: string, guestStateCode: string): boolean {
  return hotelStateCode.trim().padStart(2, "0") !== guestStateCode.trim().padStart(2, "0");
}

// =============================================================================
// ROOM SEARCH
// =============================================================================

export interface PublicSearchInput {
  hotelId?: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  rooms?: number;
  mealPlan?: string;
  roomTypeId?: string;
  guestStateCode?: string;
}

export async function searchPublicRooms(
  input: PublicSearchInput,
): Promise<PublicSearchResponse> {
  const hotel = await resolveHotel(input.hotelId);
  const stay = normaliseStay(input as Partial<PublicStaySelection>);
  const guestStateCode = (input.guestStateCode || hotel.stateCode).trim().padStart(2, "0");

  const roomTypes = await prisma.roomType.findMany({
    where: {
      hotelId: hotel.id,
      isActive: true,
      ...(input.roomTypeId ? { id: input.roomTypeId } : {}),
    },
    include: { ratePlans: { where: { isActive: true }, orderBy: { baseRate: "asc" } } },
    orderBy: { basePrice: "asc" },
  });

  const availability = await getRoomAvailability({
    hotelId: hotel.id,
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    roomTypeId: input.roomTypeId,
  });

  const sellableByType = new Map<string, { total: number; sellable: number }>();
  for (const room of availability.rooms) {
    const entry = sellableByType.get(room.roomTypeId) ?? { total: 0, sellable: 0 };
    entry.total += 1;
    if (room.isSellable) entry.sellable += 1;
    sellableByType.set(room.roomTypeId, entry);
  }

  const results: PublicRoomResult[] = [];

  for (const roomType of roomTypes) {
    const stock = sellableByType.get(roomType.id) ?? { total: 0, sellable: 0 };
    const isOccupancyOk =
      stay.adults <= roomType.maxAdults && stay.children <= roomType.maxChildren;
    const availableRooms = stock.sellable;
    const isAvailable = availableRooms >= stay.rooms && isOccupancyOk && roomType.ratePlans.length > 0;

    const offers: PublicOffer[] = [];

    for (const ratePlan of roomType.ratePlans) {
      const offerMealPlan = stay.mealPlan ?? ratePlan.mealPlan;
      try {
        const quote = await buildPublicQuote(
          {
            hotel,
            roomType,
            ratePlan,
            stay,
            mealPlan: offerMealPlan,
            guestStateCode,
          },
          undefined,
        );
        offers.push({
          ratePlanId: ratePlan.id,
          ratePlanCode: ratePlan.code,
          ratePlanName: ratePlan.name,
          mealPlan: offerMealPlan,
          matchesRequestedMealPlan: stay.mealPlan ? offerMealPlan === stay.mealPlan : true,
          basePrice: Number(ratePlan.baseRate),
          seasonalMultiplier: Number(ratePlan.seasonalMultiplier),
          weekendMultiplier: Number(ratePlan.weekendMultiplier),
          quote,
          errors: [],
        });
      } catch (error) {
        offers.push({
          ratePlanId: ratePlan.id,
          ratePlanCode: ratePlan.code,
          ratePlanName: ratePlan.name,
          mealPlan: offerMealPlan,
          matchesRequestedMealPlan: stay.mealPlan ? offerMealPlan === stay.mealPlan : true,
          basePrice: Number(ratePlan.baseRate),
          seasonalMultiplier: Number(ratePlan.seasonalMultiplier),
          weekendMultiplier: Number(ratePlan.weekendMultiplier),
          quote: null,
          errors: [(error as Error).message],
        });
      }
    }

    offers.sort((a, b) => {
      if (a.matchesRequestedMealPlan !== b.matchesRequestedMealPlan) {
        return a.matchesRequestedMealPlan ? -1 : 1;
      }
      return a.basePrice - b.basePrice;
    });

    results.push({
      roomTypeId: roomType.id,
      code: roomType.code,
      name: roomType.name,
      description: roomType.description,
      images: parseJsonArray(roomType.images),
      amenities: parseJsonArray(roomType.amenities),
      basePrice: Number(roomType.basePrice),
      occupancy: {
        baseAdults: roomType.baseAdults,
        maxAdults: roomType.maxAdults,
        maxChildren: roomType.maxChildren,
      },
      totalRooms: stock.total,
      availableRooms,
      roomsRequested: stay.rooms,
      isAvailable,
      isOccupancyOk,
      mealPlan: stay.mealPlan ?? (roomType.ratePlans[0]?.mealPlan ?? "EP"),
      availableMealPlans: MEAL_PLAN_CODES,
      offers,
    });
  }

  return {
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    nights: stay.nights,
    adults: stay.adults,
    children: stay.children,
    roomsRequested: stay.rooms,
    mealPlan: stay.mealPlan,
    guestStateCode,
    results,
    availableRoomTypes: results.filter((result) => result.isAvailable).length,
  };
}

// =============================================================================
// QUOTE ENDPOINT LOGIC
// =============================================================================

export async function quotePublicBooking(input: PublicStaySelection) {
  const selection = await resolveSelection(input);
  const quote = await buildPublicQuote(selection, input.services);

  return {
    roomTypeId: selection.roomType.id,
    roomType: { code: selection.roomType.code, name: selection.roomType.name },
    ratePlan: {
      id: selection.ratePlan.id,
      code: selection.ratePlan.code,
      name: selection.ratePlan.name,
    },
    hotelId: selection.hotel.id,
    guestStateCode: selection.guestStateCode,
    checkInDate: selection.stay.checkInDate,
    checkOutDate: selection.stay.checkOutDate,
    occupancy: {
      baseAdults: selection.roomType.baseAdults,
      maxAdults: selection.roomType.maxAdults,
      maxChildren: selection.roomType.maxChildren,
    },
    quote,
  };
}

// =============================================================================
 // RAZORPAY CHECKOUT
// =============================================================================

function checkoutSecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (secret && !secret.includes("placeholder")) return secret;
  return process.env.CHECKOUT_SECRET || "public_checkout_dev_secret";
}

function canonicalSelection(selection: PublicStaySelection, guestStateCode: string): string {
  const services = (selection.services ?? [])
    .map((item) => [item.serviceId, item.quantity ?? 1] as [string, number])
    .sort((a, b) => a[0].localeCompare(b[0]));

  return JSON.stringify({
    roomTypeId: selection.roomTypeId,
    ratePlanId: selection.ratePlanId ?? "",
    checkInDate: toISODay(selection.checkInDate),
    checkOutDate: toISODay(selection.checkOutDate),
    adults: Number(selection.adults) || 0,
    children: Number(selection.children) || 0,
    rooms: Number(selection.rooms) || 1,
    mealPlan: selection.mealPlan ?? "",
    guestStateCode,
    services,
  });
}

function signCheckoutToken(canonical: string, amountINR: number): string {
  return crypto
    .createHmac("sha256", checkoutSecret())
    .update(`${canonical}|${amountINR.toFixed(2)}`)
    .digest("hex");
}

function tokensMatch(token: string, canonical: string, amountINR: number): boolean {
  const expected = Buffer.from(signCheckoutToken(canonical, amountINR), "utf8");
  const received = Buffer.from(token || "", "utf8");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

async function createRazorpayOrder(amountINR: number): Promise<PublicRazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const amount = Math.round(amountINR * 100);

  const hasLiveKeys =
    /^rzp_/.test(keyId) && !keyId.includes("placeholder") && keySecret.length > 0 && !keySecret.includes("placeholder");

  if (hasLiveKeys) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt: `bk_${Date.now()}`,
          notes: { source: "public-booking-website" },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (response.ok) {
        const order = (await response.json()) as { id: string; amount: number; currency: string };
        return {
          orderId: order.id,
          amount: order.amount,
          amountINR,
          currency: order.currency || "INR",
          keyId,
          demo: false,
        };
      }
      console.warn(`Razorpay order API returned ${response.status}; falling back to test order`);
    } catch (error) {
      console.warn(`Razorpay order API unavailable (${(error as Error).message}); falling back to test order`);
    }
  }

  return {
    orderId: `order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    amount,
    amountINR,
    currency: "INR",
    keyId: keyId || "rzp_test_placeholder_key",
    demo: true,
  };
}

export async function createPublicCheckout(input: PublicStaySelection) {
  const selection = await resolveSelection(input);
  const quote = await buildPublicQuote(selection, input.services);

  const availability = await readAvailability(selection.hotel.id, selection.roomType.id, selection.stay);
  if (!availability.enoughRooms) {
    throw conflict(
      `Only ${availability.availableRooms} room(s) of this type are available for the selected dates.`,
    );
  }

  const canonical = canonicalSelection(input, selection.guestStateCode);
  const amountINR = quote.summary.finalAmount;
  const order = await createRazorpayOrder(amountINR);

  return {
    order,
    quote,
    token: signCheckoutToken(canonical, amountINR),
    selection: {
      roomTypeId: selection.roomType.id,
      roomType: { code: selection.roomType.code, name: selection.roomType.name },
      ratePlan: { id: selection.ratePlan.id, code: selection.ratePlan.code, name: selection.ratePlan.name },
      checkInDate: selection.stay.checkInDate,
      checkOutDate: selection.stay.checkOutDate,
      nights: selection.stay.nights,
      adults: selection.stay.adults,
      children: selection.stay.children,
      rooms: selection.stay.rooms,
      mealPlan: selection.mealPlan,
      guestStateCode: selection.guestStateCode,
    },
  };
}

// =============================================================================
// CONFIRMATION (post payment)
// =============================================================================

export interface ConfirmPublicBookingInput {
  token: string;
  razorpay: { orderId: string; paymentId: string; signature: string };
  selection: PublicStaySelection;
  guest: PublicGuestInput;
}

function validateGuest(guest: PublicGuestInput): NormalisedGuest {
  const errors: string[] = [];
  const fullName = (guest.fullName || "").trim();
  const mobile = cleanIndianMobile(guest.mobile || "");

  if (fullName.length < 2) errors.push("Guest name is required");
  if (!isValidIndianMobile(mobile)) errors.push("Enter a valid 10-digit Indian mobile number");

  const email = guest.email?.trim() || undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Enter a valid email address");
  }

  const gstin = guest.gstin?.trim().toUpperCase() || undefined;
  if (gstin && !isValidGSTIN(gstin)) errors.push("Enter a valid 15-character GSTIN");

  if (!guest.stateCode) errors.push("Place of supply (state) is required");

  if (errors.length > 0) {
    throw badRequest("Please check the guest details", errors);
  }

  return {
    fullName,
    mobile,
    email,
    address: guest.address?.trim() || undefined,
    city: guest.city?.trim() || undefined,
    stateCode: guest.stateCode!.trim().padStart(2, "0"),
    state: guest.state?.trim() || undefined,
    gstin,
    specialRequests: guest.specialRequests?.trim() || undefined,
  };
}

interface NormalisedGuest {
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  stateCode: string;
  state?: string;
  gstin?: string;
  specialRequests?: string;
}

async function nextNumber(
  tx: Prisma.TransactionClient,
  model: "booking" | "folio" | "payment",
): Promise<number> {
  if (model === "booking") return (await tx.booking.count()) + 1;
  if (model === "folio") return (await tx.folio.count()) + 1;
  return (await tx.payment.count()) + 1;
}

/**
 * Creates the booking, folio and payment after a successful Razorpay payment.
 *
 * The price is recalculated from the database on the server - the amount the
 * guest paid is never taken from the browser. One booking/folio is created per
 * requested room and the captured amount is split across those folios so every
 * folio settles to zero.
 */
export async function confirmPublicBooking(input: ConfirmPublicBookingInput) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "placeholder_secret";
  const isSignatureValid = verifyRazorpayPaymentSignature(
    input.razorpay.orderId,
    input.razorpay.paymentId,
    input.razorpay.signature,
    keySecret,
  );
  if (!isSignatureValid) {
    throw badRequest("Payment signature verification failed. Please try again.");
  }

  if (!input.guest) throw badRequest("Guest details are required");
  const guest = validateGuest(input.guest);

  const selection = await resolveSelection({
    ...input.selection,
    guestStateCode: input.selection.guestStateCode || guest.stateCode,
  });
  const quote = await buildPublicQuote(selection, input.selection.services);

  const canonical = canonicalSelection(input.selection, selection.guestStateCode);
  if (!tokensMatch(input.token, canonical, quote.summary.finalAmount)) {
    throw badRequest(
      "Your checkout session has expired because the stay details changed. Please review the price and pay again.",
    );
  }

  // Idempotency: the same Razorpay payment can never create a second stay.
  const existingPayment = await prisma.payment.findFirst({
    where: { razorpayPaymentId: input.razorpay.paymentId },
    select: { folioId: true, razorpayOrderId: true },
  });
  if (existingPayment) {
    const bookingNumbers = await findStayBookingNumbersByOrder(input.razorpay.orderId);
    const confirmation = await buildConfirmation(bookingNumbers);
    if (confirmation) {
      return { confirmation, duplicate: true };
    }
  }

  const perRoomTotal = quote.roomQuote.grandTotal;
  const finalAmount = quote.summary.finalAmount;

  const created = await prisma.$transaction(async (tx) => {
    const rooms = await pickAvailableRooms(tx, {
      hotelId: selection.hotel.id,
      roomTypeId: selection.roomType.id,
      checkInDate: selection.stay.checkInDate,
      checkOutDate: selection.stay.checkOutDate,
      count: selection.stay.rooms,
    });

    let guestRow = await tx.guest.findFirst({ where: { mobile: guest.mobile } });
    if (guestRow) {
      guestRow = await tx.guest.update({
        where: { id: guestRow.id },
        data: {
          fullName: guest.fullName,
          email: guest.email,
          address: guest.address,
          city: guest.city,
          stateCode: guest.stateCode,
          state: guest.state,
          corporateGstin: guest.gstin,
        },
      });
    } else {
      guestRow = await tx.guest.create({
        data: {
          fullName: guest.fullName,
          mobile: guest.mobile,
          email: guest.email,
          address: guest.address,
          city: guest.city,
          stateCode: guest.stateCode,
          state: guest.state,
          country: "India",
          guestType: guest.gstin ? "Corporate" : "Domestic",
          corporateGstin: guest.gstin,
        },
      });
    }

    const bookingBase = await nextNumber(tx, "booking");
    const folioBase = await nextNumber(tx, "folio");
    const paymentBase = await nextNumber(tx, "payment");
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, "");
    const year = now.getFullYear();
    const servicesGstTotal = roundCurrency(
      isInterState(selection.hotel.stateCode, selection.guestStateCode)
        ? quote.gst.services.igst
        : quote.gst.services.cgst + quote.gst.services.sgst,
    );

    const bookingNumbers: string[] = [];

    for (const [index, room] of rooms.entries()) {
      const isLast = index === rooms.length - 1;

      const share = isLast
        ? roundCurrency(finalAmount - perRoomTotal * (rooms.length - 1))
        : perRoomTotal;

      const bookingNumber = `BK-${dateStr}-${String(bookingBase + index).padStart(4, "0")}`;
      const folioNumber = `FOL-${year}-${String(folioBase + index).padStart(5, "0")}`;
      const paymentNumber = `PAY-${year}-${String(paymentBase + index).padStart(5, "0")}`;

      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          hotelId: selection.hotel.id,
          roomId: room.id,
          roomTypeId: selection.roomType.id,
          ratePlanId: selection.ratePlan.id,
          primaryGuestId: guestRow.id,
          checkInDate: new Date(`${selection.stay.checkInDate}T00:00:00.000Z`),
          checkOutDate: new Date(`${selection.stay.checkOutDate}T00:00:00.000Z`),
          adults: selection.stay.adults,
          children: selection.stay.children,
          mealPlan: selection.mealPlan as never,
          status: "Confirmed",
          bookingSource: "Website",
          specialRequests: guest.specialRequests,
          totalNights: quote.nights,
          roomCharges: quote.roomQuote.roomCharges as never,
          extraCharges:
            (
              roundCurrency(
                quote.roomQuote.extraCharges +
                  quote.roomQuote.mealPlanCharges +
                  (isLast ? quote.summary.services : 0),
              )
            ) as never,
          discountAmount: quote.roomQuote.discountAmount as never,
          taxAmount:
            (
              roundCurrency(
                quote.roomQuote.gst.totalTax + (isLast ? servicesGstTotal : 0),
              )
            ) as never,
          grandTotal: (
            isLast ? roundCurrency(perRoomTotal + quote.summary.services + servicesGstTotal) : perRoomTotal
          ) as never,
        },
      });

      await tx.bookingGuest.create({
        data: { bookingId: booking.id, guestId: guestRow.id, isPrimary: true },
      });

      await tx.reservation.create({
        data: {
          bookingId: booking.id,
          confirmedDate: new Date(),
          notes: guest.specialRequests,
        },
      });

      const folio = await tx.folio.create({
        data: {
          folioNumber,
          hotelId: selection.hotel.id,
          bookingId: booking.id,
          guestId: guestRow.id,
          status: "Open",
        },
      });

      // One folio line per GST slab keeps the tax invoice defensible when a
      // stay straddles the 12% / 18% accommodation thresholds.
      for (const slab of quote.roomQuote.nightsPerSlab) {
        const item = await tx.folioItem.create({
          data: {
            folioId: folio.id,
            itemType: "Room",
            description: `Room Tariff - ${selection.roomType.name} (${quote.nights} Night(s), ${slab.nightCount} night(s) @ ${(slab.gstRate * 100).toFixed(0)}% GST) - SAC ${quote.gst.sacCode}`,
            quantity: slab.nightCount,
            unitPrice: roundCurrency(slab.taxableAmount / Math.max(1, slab.nightCount)) as never,
            totalPrice: slab.taxableAmount as never,
            sacCode: quote.gst.sacCode,
            gstRate: slab.gstRate as never,
            gstAmount: slab.totalTax as never,
          },
        });

        await tx.gSTTransaction.create({
          data: {
            folioId: folio.id,
            folioItemId: item.id,
            taxableAmount: slab.taxableAmount as never,
            cgstRate: slab.cgstRate as never,
            cgstAmount: slab.cgstAmount as never,
            sgstRate: slab.sgstRate as never,
            sgstAmount: slab.sgstAmount as never,
            igstRate: slab.igstRate as never,
            igstAmount: slab.igstAmount as never,
            totalTax: slab.totalTax as never,
            sacCode: quote.gst.sacCode,
            placeOfSupply: quote.gst.placeOfSupply,
          },
        });
      }

      // Ancillary services are billed once, on the folio that carries them.
      if (isLast) {
        for (const service of quote.services) {
          const gstBreakup = calculateServiceGST({
            amount: service.subtotal,
            serviceType: SERVICE_CATEGORY_TYPE[(service.category || "").toLowerCase()] ?? "other",
            hotelStateCode: selection.hotel.stateCode,
            guestStateCode: selection.guestStateCode,
            customRate: service.gstRate || undefined,
            customSacCode: service.sacCode || undefined,
          });

          const item = await tx.folioItem.create({
            data: {
              folioId: folio.id,
              itemType: service.itemType as never,
              description: `${service.name} x ${service.quantity}`,
              quantity: service.quantity,
              unitPrice: service.unitPrice as never,
              totalPrice: service.subtotal as never,
              sacCode: service.sacCode,
              gstRate: service.gstRate as never,
              gstAmount: service.gstAmount as never,
            },
          });

          await tx.gSTTransaction.create({
            data: {
              folioId: folio.id,
              folioItemId: item.id,
              taxableAmount: gstBreakup.taxableAmount as never,
              cgstRate: gstBreakup.cgstRate as never,
              cgstAmount: gstBreakup.cgstAmount as never,
              sgstRate: gstBreakup.sgstRate as never,
              sgstAmount: gstBreakup.sgstAmount as never,
              igstRate: gstBreakup.igstRate as never,
              igstAmount: gstBreakup.igstAmount as never,
              totalTax: gstBreakup.totalTax as never,
              sacCode: gstBreakup.sacCode,
              placeOfSupply: gstBreakup.placeOfSupply,
            },
          });
        }
      }

      await tx.payment.create({
        data: {
          paymentNumber,
          folioId: folio.id,
          guestId: guestRow.id,
          amount: share as never,
          method: "Razorpay",
          status: "Captured",
          razorpayOrderId: input.razorpay.orderId,
          razorpayPaymentId: input.razorpay.paymentId,
          razorpaySignature: input.razorpay.signature,
          notes: `Online booking ${bookingNumber} settled via Razorpay order ${input.razorpay.orderId}`,
          receivedAt: new Date(),
        },
      });

      await recalculateFolio(tx, folio.id);

      bookingNumbers.push(bookingNumber);
    }

    await recordAuditLog(
      {
        hotelId: selection.hotel.id,
        action: "ONLINE_BOOKING_CONFIRMED",
        entity: "Booking",
        entityId: bookingNumbers[0] ?? "website-booking",
        newValue: {
          bookingNumbers,
          source: "Website",
          guestName: guest.fullName,
          mobile: guest.mobile,
          roomType: selection.roomType.name,
          ratePlan: selection.ratePlan.code,
          checkInDate: selection.stay.checkInDate,
          checkOutDate: selection.stay.checkOutDate,
          rooms: selection.stay.rooms,
          mealPlan: selection.mealPlan,
          total: finalAmount,
          razorpayOrderId: input.razorpay.orderId,
          razorpayPaymentId: input.razorpay.paymentId,
        },
      },
      tx,
    );

    return { bookingNumbers };
  });

  const confirmation = await buildConfirmation(created.bookingNumbers);
  if (!confirmation) throw new PublicBookingError("Booking could not be loaded", [], 500);

  await sendBookingConfirmation(confirmation, selection.hotel.id);

  return { confirmation, duplicate: false };
}

// =============================================================================
 // PUBLIC BOOKING LOOKUP
// =============================================================================

async function findStayBookingNumbersByOrder(razorpayOrderId: string): Promise<string[]> {
  const payments = await prisma.payment.findMany({
    where: { razorpayOrderId },
    select: { folio: { select: { booking: { select: { bookingNumber: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const numbers = payments
    .map((payment) => payment.folio?.booking?.bookingNumber)
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(numbers));
}

async function findStayBookingNumbers(bookingId: string): Promise<string[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { bookingNumber: true, folio: { select: { payments: { select: { razorpayOrderId: true } } } } },
  });
  if (!booking) return [];

  const orderId = booking.folio?.payments.find((payment) => payment.razorpayOrderId)?.razorpayOrderId;
  if (!orderId) return [booking.bookingNumber];

  const siblings = await findStayBookingNumbersByOrder(orderId);
  return siblings.length > 0 ? siblings : [booking.bookingNumber];
}

async function buildConfirmation(
  bookingNumbers: string[],
): Promise<BookingConfirmationPayload | null> {
  if (bookingNumbers.length === 0) return null;

  const bookings = await prisma.booking.findMany({
    where: { bookingNumber: { in: bookingNumbers } },
    include: {
      primaryGuest: true,
      roomType: true,
      ratePlan: true,
      room: true,
      hotel: true,
      folio: { include: { items: true, payments: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (bookings.length === 0) return null;

  const first = bookings[0];
  if (!first) return null;
  const hotel = first.hotel;
  const guest = first.primaryGuest;

  let roomTaxable = 0;
  let servicesTaxable = 0;
  let gst = 0;
  let discount = 0;
  let paid = 0;
  let paidAt: Date | null = null;
  let transactionRef: string | null = null;

  for (const booking of bookings) {
    discount += Number(booking.discountAmount);

    for (const item of booking.folio?.items ?? []) {
      if (item.isVoided) continue;
      if (item.itemType === "Room") {
        roomTaxable += Number(item.totalPrice);
      } else {
        servicesTaxable += Number(item.totalPrice);
      }
      gst += Number(item.gstAmount);
    }

    for (const payment of booking.folio?.payments ?? []) {
      if (payment.status === "Failed" || payment.status === "Refunded") continue;
      paid += Number(payment.amount);
      if (!paidAt || payment.receivedAt > paidAt) paidAt = payment.receivedAt;
      if (payment.razorpayPaymentId) transactionRef = payment.razorpayPaymentId;
    }
  }

  const roomSubtotal = roundCurrency(roomTaxable + roundCurrency(discount));
  const summary = {
    roomSubtotal,
    services: roundCurrency(servicesTaxable),
    discount: roundCurrency(discount),
    gst: roundCurrency(gst),
    finalAmount: roundCurrency(roomSubtotal - discount + servicesTaxable + gst),
    amountInWords: "",
  };
  summary.amountInWords = numberToIndianWords(summary.finalAmount);

  return {
    bookingNumbers: bookings.map((booking) => booking.bookingNumber),
    primaryBookingNumber: first.bookingNumber,
    status: first.status,
    hotel: {
      name: hotel.name,
      address: hotel.address,
      city: hotel.city,
      state: hotel.state,
      pincode: hotel.pincode,
      phone: hotel.phone,
      email: hotel.email,
      gstin: hotel.gstin,
      stateCode: hotel.stateCode,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
    },
    guest: {
      fullName: guest.fullName,
      mobile: guest.mobile,
      email: guest.email,
      state: guest.state,
      stateCode: guest.stateCode,
      address: guest.address,
      gstin: guest.corporateGstin,
    },
    stay: {
      checkInDate: toISODay(first.checkInDate),
      checkOutDate: toISODay(first.checkOutDate),
      nights: first.totalNights,
      adults: first.adults,
      children: first.children,
      rooms: bookings.length,
      mealPlan: first.mealPlan,
      roomType: { code: first.roomType.code, name: first.roomType.name },
      ratePlan: { code: first.ratePlan.code, name: first.ratePlan.name },
      roomNumbers: bookings
        .map((booking) => booking.room?.roomNumber ?? "")
        .filter((value) => value.length > 0),
    },
    pricing: summary,
    payment: {
      amount: roundCurrency(paid),
      method: "Razorpay",
      transactionRef,
      paidAt: (paidAt ?? first.createdAt).toISOString(),
    },
    confirmation: {
      sent: false,
      channel: "none",
      sentAt: "",
    },
    createdAt: first.createdAt.toISOString(),
  };
}

export async function getPublicBookingConfirmation(bookingNumber: string, mobile: string) {
  const clean = cleanIndianMobile(mobile || "");
  if (!bookingNumber) throw badRequest("Booking number is required");
  if (!isValidIndianMobile(clean)) {
    throw badRequest("Enter the 10-digit mobile number used for the booking");
  }

  const booking = await prisma.booking.findFirst({
    where: { bookingNumber: { equals: bookingNumber.trim(), mode: "insensitive" } },
    select: { id: true, primaryGuest: { select: { mobile: true } } },
  });

  if (!booking || !booking.primaryGuest.mobile.endsWith(clean)) {
    throw notFound("No booking found for that booking number and mobile number");
  }

  const bookingNumbers = await findStayBookingNumbers(booking.id);
  const confirmation = await buildConfirmation(bookingNumbers);
  if (!confirmation) throw notFound("No booking found for that booking number and mobile number");

  confirmation.confirmation = { sent: true, channel: "lookup", sentAt: new Date().toISOString() };
  return confirmation;
}
