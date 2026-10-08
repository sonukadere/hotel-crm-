import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import type {
  AvailabilityResult,
  BookingStatus,
  CheckInValidationResult,
  CheckoutSummary,
  FrontDeskDashboardSummary,
  FrontDeskPaymentStatus,
  MealPlan,
  ReservationQuote,
  ReservationQuoteInput,
  RoomStatus,
  RoomSwitchRequest,
  RoomSwitchResult,
  RoomAvailabilityResponse,
  TapeChartDay,
  TapeChartResponse,
  TapeChartRoom,
  TapeChartStay,
  TapeChartSummary,
} from "@hotel/types";
import {
  buildCheckoutSummary,
  buildCheckInValidation,
  buildReservationQuote,
  checkRoomStateTransition,
  clipRangeToWindow,
  countNights,
  derivePaymentStatus,
  eachDayInRange,
  evaluateRoomAvailability,
  getSuggestedNextStates,
  isValidIndianMobile,
  maskAadhaar,
  cleanIndianMobile,
  roundCurrency,
  timestampToISODay,
  toISODay,
} from "@hotel/utils";
import { recordAuditLog } from "./auditService";
import { getDefaultHotelId } from "./roomService";
import { isMaskedIdentityValue } from "../security/sanitize";

const HOLDING_STATUSES: BookingStatus[] = ["Tentative", "Confirmed", "CheckedIn"];
const STAY_STATUSES: BookingStatus[] = [
  "Tentative",
  "Confirmed",
  "CheckedIn",
];

export class FrontDeskError extends Error {
  statusCode: number;
  errors: string[];

  constructor(message: string, errors: string[] = [], statusCode = 400) {
    super(message);
    this.name = "FrontDeskError";
    this.statusCode = statusCode;
    this.errors = errors.length > 0 ? errors : [message];
  }
}

type Tx = Prisma.TransactionClient;
type DocumentKind = "booking" | "folio" | "payment";

// =============================================================================
// DOCUMENT NUMBERING
// =============================================================================

async function nextDocumentNumber(tx: Tx, kind: DocumentKind, prefix: string): Promise<string> {
  const scope = `${prefix}-`;

  let lastNumber: string | null = null;
  if (kind === "booking") {
    const last = await tx.booking.findFirst({
      where: { bookingNumber: { startsWith: scope } },
      orderBy: { bookingNumber: "desc" },
      select: { bookingNumber: true },
    });
    lastNumber = last?.bookingNumber ?? null;
  } else if (kind === "folio") {
    const last = await tx.folio.findFirst({
      where: { folioNumber: { startsWith: scope } },
      orderBy: { folioNumber: "desc" },
      select: { folioNumber: true },
    });
    lastNumber = last?.folioNumber ?? null;
  } else {
    const last = await tx.payment.findFirst({
      where: { paymentNumber: { startsWith: scope } },
      orderBy: { paymentNumber: "desc" },
      select: { paymentNumber: true },
    });
    lastNumber = last?.paymentNumber ?? null;
  }

  const parsed = lastNumber ? parseInt(lastNumber.slice(scope.length), 10) : Number.NaN;
  const sequence = Number.isFinite(parsed) ? parsed + 1 : 1;
  return `${scope}${String(sequence).padStart(4, "0")}`;
}

// =============================================================================
// SHARED QUERY HELPERS
// =============================================================================

function normaliseRange(checkInDate: string, checkOutDate: string) {
  const from = toISODay(checkInDate);
  const to = toISODay(checkOutDate);
  if (from >= to) {
    throw new FrontDeskError("Check-out date must be after check-in date", [
      "Check-out date must be after check-in date",
    ]);
  }
  return { from, to, nights: countNights({ start: from, end: to }) };
}

/** Loads the bookings that hold inventory on a room across a date range. */
async function loadRoomBookings(
  tx: Tx,
  roomId: string,
  from: string,
  to: string,
): Promise<
  Array<{
    id: string;
    bookingNumber: string;
    status: string;
    checkInDate: Date;
    checkOutDate: Date;
    guestName: string;
  }>
> {
  const bookings = await tx.booking.findMany({
    where: {
      roomId,
      status: { in: HOLDING_STATUSES },
      checkInDate: { lt: new Date(`${to}T00:00:00.000Z`) },
      checkOutDate: { gt: new Date(`${from}T00:00:00.000Z`) },
    },
    include: { primaryGuest: { select: { fullName: true } } },
    orderBy: { checkInDate: "asc" },
  });

  return bookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    status: b.status,
    checkInDate: b.checkInDate,
    checkOutDate: b.checkOutDate,
    guestName: b.primaryGuest.fullName,
  }));
}

/**
 * The single availability gate for every room write in this module.
 *
 * Callers MUST invoke this inside the same transaction that performs the write:
 * it re-reads the room and its overlapping bookings on the transaction's own
 * snapshot and throws before anything is mutated. Because every write path shares
 * this function, two active bookings can never end up on the same room.
 */
async function assertRoomAssignable(params: {
  tx: Tx;
  roomId: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  excludeBookingId?: string;
  requireSellableState?: boolean;
}): Promise<{
  room: {
    id: string;
    roomNumber: string;
    status: RoomStatus;
    isActive: boolean;
    roomTypeId: string;
    baseRate: unknown;
    floorId: string;
  };
}> {
  const { tx } = params;

  const room = await tx.room.findUnique({
    where: { id: params.roomId },
    select: {
      id: true,
      roomNumber: true,
      status: true,
      isActive: true,
      roomTypeId: true,
      baseRate: true,
      floorId: true,
    },
  });

  if (!room) {
    throw new FrontDeskError("Room not found", ["Selected room no longer exists"], 404);
  }

  const from = toISODay(params.checkInDate);
  const to = toISODay(params.checkOutDate);
  const bookings = await loadRoomBookings(tx, room.id, from, to);

  const verdict = evaluateRoomAvailability({
    room: { id: room.id, roomNumber: room.roomNumber, status: room.status, isActive: room.isActive },
    bookings,
    checkInDate: from,
    checkOutDate: to,
    excludeBookingId: params.excludeBookingId,
  });

  if (!verdict.isSellable) {
    throw new FrontDeskError(
      verdict.reason ?? `Room ${room.roomNumber} is not available`,
      [verdict.reason ?? `Room ${room.roomNumber} is not available`],
      409,
    );
  }

  return { room };
}

// =============================================================================
// TAPE CHART
// =============================================================================

export interface TapeChartParams {
  hotelId?: string;
  from?: string;
  days?: number;
  floorId?: string;
  roomTypeId?: string;
  search?: string;
}

export async function getTapeChart(params: TapeChartParams = {}): Promise<TapeChartResponse> {
  const hotelId = params.hotelId || (await getDefaultHotelId());
  const windowDays = Math.min(Math.max(params.days ?? 14, 1), 60);
  const from = toISODay(params.from ?? new Date());
  const to = timestampToISODay(
    new Date(`${from}T00:00:00.000Z`).getTime() + windowDays * 86400000,
  );

  const roomWhere: Prisma.RoomWhereInput = { hotelId, isActive: true };
  if (params.floorId) roomWhere.floorId = params.floorId;
  if (params.roomTypeId) roomWhere.roomTypeId = params.roomTypeId;
  if (params.search) {
    roomWhere.OR = [
      { roomNumber: { contains: params.search, mode: "insensitive" } },
      { roomType: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const rooms = await prisma.room.findMany({
    where: roomWhere,
    include: {
      floor: { select: { id: true, floorNumber: true } },
      roomType: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          maxAdults: true,
          maxChildren: true,
        },
      },
      bedType: { select: { name: true } },
      bookings: {
        where: {
          status: { in: STAY_STATUSES },
          checkInDate: { lt: new Date(`${to}T00:00:00.000Z`) },
          checkOutDate: { gt: new Date(`${from}T00:00:00.000Z`) },
        },
        include: {
          primaryGuest: {
            select: {
              id: true,
              fullName: true,
              mobile: true,
              guestType: true,
              corporateName: true,
            },
          },
          roomType: { select: { name: true } },
          ratePlan: { select: { name: true } },
          folio: { select: { payments: { where: { status: "Captured" } } } },
        },
        orderBy: { checkInDate: "asc" },
      },
    },
    orderBy: [{ floor: { floorNumber: "asc" } }, { roomNumber: "asc" }],
  });

  const windowRange = { start: from, end: to };

  const tapeRooms: TapeChartRoom[] = rooms.map((room) => {
    const baseRate = Number(room.baseRate ?? room.roomType.basePrice);

    const stays: TapeChartStay[] = room.bookings
      .map((booking): TapeChartStay | null => {
        const checkIn = toISODay(booking.checkInDate);
        const checkOut = toISODay(booking.checkOutDate);
        const clipped = clipRangeToWindow(
          { start: checkIn, end: checkOut },
          windowRange,
        );
        if (!clipped) return null;

        const grandTotal = Number(booking.grandTotal);
        const capturedPayments = booking.folio?.payments ?? [];
        const paidFromPayments = capturedPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const paidAmount = roundCurrency(
          Math.max(Number(booking.paidAmount), paidFromPayments),
        );

        return {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          bookingStatus: booking.status,
          guest: {
            id: booking.primaryGuest.id,
            fullName: booking.primaryGuest.fullName,
            mobile: booking.primaryGuest.mobile,
            guestType: booking.primaryGuest.guestType,
            isCorporate: Boolean(booking.primaryGuest.corporateName),
            corporateName: booking.primaryGuest.corporateName ?? undefined,
          },
          roomTypeName: booking.roomType.name,
          ratePlanName: booking.ratePlan.name,
          mealPlan: booking.mealPlan,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          windowCheckInDate: clipped.start,
          windowCheckOutDate: clipped.end,
          totalNights: booking.totalNights,
          adults: booking.adults,
          children: booking.children,
          grandTotal,
          paidAmount,
          balanceAmount: Number(booking.balanceAmount),
          depositAmount: paidAmount,
          paymentStatus: derivePaymentStatus({
            grandTotal,
            paidAmount,
            bookingStatus: booking.status,
          }),
          isArrival: checkIn >= from && checkIn < to,
          isDeparture: checkOut > from && checkOut <= to,
          isInHouse: booking.status === "CheckedIn",
          specialRequests: booking.specialRequests ?? undefined,
        };
      })
      .filter((s): s is TapeChartStay => s !== null);

    const currentStay = stays.find((s) => s.bookingStatus === "CheckedIn");

    const isSellable =
      room.status === "Available" || room.status === "Clean" || room.status === "Dirty";

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      floorId: room.floor.id,
      floorNumber: room.floor.floorNumber,
      roomTypeId: room.roomType.id,
      roomTypeName: room.roomType.name,
      bedTypeName: room.bedType?.name,
      status: room.status,
      isActive: room.isActive,
      baseRate,
      maxAdults: room.roomType.maxAdults,
      maxChildren: room.roomType.maxChildren,
      isSellable,
      unavailableReason: isSellable
        ? undefined
        : room.isActive
          ? `Room is ${room.status}`
          : "Room is deactivated",
      currentStay,
      stays,
    };
  });

  const days: TapeChartDay[] = eachDayInRange(windowRange).map((date) => {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const occupied = tapeRooms.filter((room) =>
      room.stays.some(
        (stay) => stay.windowCheckInDate <= date && date < stay.windowCheckOutDate,
      ),
    ).length;
    const arrivals = tapeRooms.filter((room) =>
      room.stays.some((stay) => stay.checkInDate === date),
    ).length;
    const departures = tapeRooms.filter((room) =>
      room.stays.some((stay) => stay.checkOutDate === date),
    ).length;

    return {
      date,
      dayOfWeek: dayStart.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
      dayOfMonth: dayStart.getUTCDate(),
      isWeekend: dayStart.getUTCDay() === 0 || dayStart.getUTCDay() === 6,
      isToday: date === from,
      arrivals,
      departures,
      occupied,
      occupancyPct: tapeRooms.length > 0 ? Math.round((occupied / tapeRooms.length) * 100) : 0,
    };
  });

  const totalRooms = tapeRooms.length;
  const occupiedRooms = tapeRooms.filter((r) => r.status === "Occupied").length;
  const sellableRooms = tapeRooms.filter((r) => r.isSellable).length;
  const inHouseGuests = tapeRooms.reduce(
    (sum, r) => sum + (r.currentStay?.adults ?? 0) + (r.currentStay?.children ?? 0),
    0,
  );
  const roomRevenue = roundCurrency(
    tapeRooms.reduce((sum, r) => sum + Number(r.currentStay?.grandTotal ?? 0), 0),
  );
  const adr = occupiedRooms > 0 ? roundCurrency(roomRevenue / occupiedRooms) : 0;
  const revPar = totalRooms > 0 ? roundCurrency(roomRevenue / totalRooms) : 0;

  const summary: TapeChartSummary = {
    totalRooms,
    sellableRooms,
    occupiedRooms,
    availableRooms: tapeRooms.filter((r) => r.status === "Available").length,
    cleanRooms: tapeRooms.filter((r) => r.status === "Clean").length,
    dirtyRooms: tapeRooms.filter((r) => r.status === "Dirty").length,
    blockedRooms: tapeRooms.filter((r) => r.status === "Blocked").length,
    maintenanceRooms: tapeRooms.filter((r) => r.status === "Maintenance").length,
    occupancyPct: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
    adr,
    revPar,
    arrivals: days[0]?.arrivals ?? 0,
    departures: days[0]?.departures ?? 0,
    inHouseGuests,
    roomRevenue,
  };

  return {
    hotelId,
    fromDate: from,
    toDate: to,
    days,
    rooms: tapeRooms,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// AVAILABILITY
// =============================================================================

export async function getRoomAvailability(params: {
  hotelId?: string;
  checkInDate: string;
  checkOutDate: string;
  floorId?: string;
  roomTypeId?: string;
  excludeBookingId?: string;
}): Promise<RoomAvailabilityResponse> {
  const hotelId = params.hotelId || (await getDefaultHotelId());
  const { from, to, nights } = normaliseRange(params.checkInDate, params.checkOutDate);

  const roomWhere: Prisma.RoomWhereInput = { hotelId };
  if (params.floorId) roomWhere.floorId = params.floorId;
  if (params.roomTypeId) roomWhere.roomTypeId = params.roomTypeId;

  const rooms = await prisma.room.findMany({
    where: roomWhere,
    include: {
      floor: { select: { floorNumber: true } },
      roomType: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          maxAdults: true,
          maxChildren: true,
        },
      },
      bookings: {
        where: {
          status: { in: HOLDING_STATUSES },
          checkInDate: { lt: new Date(`${to}T00:00:00.000Z`) },
          checkOutDate: { gt: new Date(`${from}T00:00:00.000Z`) },
        },
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          primaryGuest: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ floor: { floorNumber: "asc" } }, { roomNumber: "asc" }],
  });

  const results: AvailabilityResult[] = rooms.map((room) => {
    const bookings = room.bookings.map((b) => ({
      id: b.id,
      bookingNumber: b.bookingNumber,
      status: b.status,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      guestName: b.primaryGuest.fullName,
    }));

    const verdict = evaluateRoomAvailability({
      room: {
        id: room.id,
        roomNumber: room.roomNumber,
        status: room.status,
        isActive: room.isActive,
      },
      bookings,
      checkInDate: from,
      checkOutDate: to,
      excludeBookingId: params.excludeBookingId,
    });

    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      floorNumber: room.floor.floorNumber,
      roomTypeId: room.roomType.id,
      roomTypeName: room.roomType.name,
      status: room.status,
      baseRate: Number(room.baseRate ?? room.roomType.basePrice),
      maxAdults: room.roomType.maxAdults,
      maxChildren: room.roomType.maxChildren,
      isSellable: verdict.isSellable,
      unavailableReason: verdict.reason,
      conflicts: verdict.conflicts.map((c) => ({
        bookingId: c.id,
        bookingNumber: c.bookingNumber,
        bookingStatus: c.status as BookingStatus,
        checkInDate: toISODay(c.checkInDate),
        checkOutDate: toISODay(c.checkOutDate),
        guestName: c.guestName ?? "",
      })),
    };
  });

  return {
    checkInDate: from,
    checkOutDate: to,
    totalNights: nights,
    rooms: results,
    sellableCount: results.filter((r) => r.isSellable).length,
  };
}

// =============================================================================
// RESERVATION QUOTE
// =============================================================================

export async function quoteReservation(
  params: ReservationQuoteInput & { ratePlanId?: string; roomId?: string },
): Promise<ReservationQuote> {
  if (params.ratePlanId) {
    const plan = await prisma.ratePlan.findUnique({
      where: { id: params.ratePlanId },
      include: { roomType: true, hotel: { select: { stateCode: true } } },
    });
    if (!plan) throw new FrontDeskError("Rate plan not found", ["Rate plan not found"], 404);

    return buildReservationQuote({
      ...params,
      ratePlan: {
        baseRate: Number(plan.baseRate),
        seasonalMultiplier: Number(plan.seasonalMultiplier),
        weekendMultiplier: Number(plan.weekendMultiplier),
        extraAdultRate: Number(plan.extraAdultRate),
        extraChildRate: Number(plan.extraChildRate),
        mealPlan: plan.mealPlan as MealPlan,
        code: plan.code,
        name: plan.name,
      },
      mealPlan: (params.mealPlan ?? plan.mealPlan) as MealPlan,
      baseAdults: plan.roomType.baseAdults,
      maxAdults: plan.roomType.maxAdults,
      maxChildren: plan.roomType.maxChildren,
      hotelStateCode: params.hotelStateCode || plan.hotel.stateCode,
    });
  }

  return buildReservationQuote(params);
}

// =============================================================================
// GUEST LOOKUP / QUICK CHECK-IN PROFILE
// =============================================================================

export async function findGuestByMobile(mobile: string) {
  const clean = cleanIndianMobile(mobile);
  if (!isValidIndianMobile(clean)) {
    throw new FrontDeskError("Enter a valid 10-digit Indian mobile number", [
      "Enter a valid 10-digit Indian mobile number",
    ]);
  }

  const guest = await prisma.guest.findFirst({
    where: { mobile: { endsWith: clean } },
    include: {
      identities: true,
      loyaltyAccount: true,
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          room: { select: { roomNumber: true } },
        },
      },
    },
  });

  if (!guest) return null;

  let internationalDetails: Record<string, unknown> | null = null;
  if (guest.internationalDetails) {
    try {
      internationalDetails = JSON.parse(guest.internationalDetails);
    } catch {
      internationalDetails = null;
    }
  }

  return {
    ...guest,
    internationalDetails,
    aadhaarMasked:
      guest.identities.find((i) => i.identityType === "Aadhaar")?.maskedIdNumber ?? null,
  };
}

export interface UpsertGuestInput {
  guestId?: string;
  mobile: string;
  fullName?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  country?: string;
  guestType?: string;
  corporateGstin?: string;
  corporateName?: string;
  identityType?: string;
  idNumber?: string;
  passportNumber?: string;
  visaNumber?: string;
  visaExpiry?: string;
  nationality?: string;
  arrivalDate?: string;
  departureDate?: string;
  arrivalPort?: string;
  userId?: string;
}

/**
 * Creates or refreshes the guest profile captured by the Quick Check-In modal.
 * Identities are stored with a masked copy only for display; the raw value is kept
 * for statutory verification exactly as required by the guest registration act.
 */
export async function upsertQuickCheckInGuest(input: UpsertGuestInput) {
  const mobile = cleanIndianMobile(input.mobile);
  if (!isValidIndianMobile(mobile)) {
    throw new FrontDeskError("Enter a valid 10-digit Indian mobile number", [
      "Enter a valid 10-digit Indian mobile number",
    ]);
  }

  if (input.corporateGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(input.corporateGstin)) {
    throw new FrontDeskError("Corporate GSTIN is not a valid 15-character GSTIN", [
      "Corporate GSTIN is not a valid 15-character GSTIN",
    ]);
  }

  const identityBlock =
    input.identityType && input.idNumber && !isMaskedIdentityValue(input.idNumber)
      ? {
          identityType: input.identityType as never,
          idNumber: input.idNumber.trim(),
          maskedIdNumber:
            input.identityType === "Aadhaar"
              ? maskAadhaar(input.idNumber)
              : `****${input.idNumber.trim().slice(-4)}`,
          issuedCountry:
            input.guestType === "International" ? input.country || "India" : "India",
        }
      : null;

  const internationalDetails =
    input.guestType === "International" && input.passportNumber
      ? JSON.stringify({
          passportNumber: input.passportNumber,
          visaNumber: input.visaNumber,
          visaExpiry: input.visaExpiry,
          nationality: input.nationality,
          arrivalDate: input.arrivalDate,
          departureDate: input.departureDate,
          arrivalPort: input.arrivalPort,
        })
      : undefined;

  return await prisma.$transaction(async (tx) => {
    const existing = input.guestId
      ? await tx.guest.findUnique({ where: { id: input.guestId } })
      : await tx.guest.findFirst({ where: { mobile: { endsWith: mobile } } });

    const data = {
      mobile,
      fullName: input.fullName?.trim() || existing?.fullName || "Guest",
      email: input.email ?? existing?.email,
      address: input.address ?? existing?.address,
      city: input.city ?? existing?.city,
      state: input.state ?? existing?.state,
      stateCode: input.stateCode ?? existing?.stateCode,
      country: input.country ?? existing?.country ?? "India",
      guestType: (input.guestType ?? existing?.guestType ?? "Domestic") as never,
      corporateGstin: input.corporateGstin ?? existing?.corporateGstin,
      corporateName: input.corporateName ?? existing?.corporateName,
      internationalDetails: internationalDetails ?? existing?.internationalDetails,
    };

    const guest = existing
      ? await tx.guest.update({ where: { id: existing.id }, data })
      : await tx.guest.create({ data });

    if (identityBlock) {
      const duplicate = await tx.guestIdentity.findFirst({
        where: { guestId: guest.id, idNumber: identityBlock.idNumber },
      });
      if (duplicate) {
        await tx.guestIdentity.update({
          where: { id: duplicate.id },
          data: { maskedIdNumber: identityBlock.maskedIdNumber, verified: true },
        });
      } else {
        await tx.guestIdentity.create({
          data: {
            guestId: guest.id,
            identityType: identityBlock.identityType,
            idNumber: identityBlock.idNumber,
            maskedIdNumber: identityBlock.maskedIdNumber,
            verified: true,
            issuedCountry: identityBlock.issuedCountry,
          },
        });
      }
    }

    await recordAuditLog(
      {
        hotelId: existing ? undefined : undefined,
        userId: input.userId,
        action: existing ? "GUEST_PROFILE_UPDATED" : "GUEST_PROFILE_CREATED",
        entity: "Guest",
        entityId: guest.id,
        newValue: {
          fullName: guest.fullName,
          mobile: guest.mobile,
          identityType: identityBlock?.identityType,
          maskedIdNumber: identityBlock?.maskedIdNumber,
        },
      },
      tx,
    );

    return tx.guest.findUniqueOrThrow({
      where: { id: guest.id },
      include: { identities: true },
    });
  });
}

// =============================================================================
// CHECK-IN
// =============================================================================

async function loadBookingForCheckIn(bookingId: string) {
  return await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      primaryGuest: { include: { identities: true } },
      room: true,
      roomType: true,
      ratePlan: true,
      hotel: { select: { id: true, stateCode: true } },
      folio: { include: { payments: { where: { status: "Captured" } } } },
    },
  });
}

export async function validateCheckIn(
  bookingId: string,
  options: { roomId?: string; additionalPayment?: { amount: number; method?: string; panNumber?: string } } = {},
): Promise<CheckInValidationResult> {
  const booking = await loadBookingForCheckIn(bookingId);

  if (!booking) {
    return buildCheckInValidation({ bookingId });
  }

  const targetRoomId = options.roomId || booking.roomId;
  const room = targetRoomId
    ? await prisma.room.findUnique({ where: { id: targetRoomId } })
    : null;

  let availability: { isSellable: boolean; reason?: string } | undefined;
  if (room) {
    const bookings = await loadRoomBookings(
      prisma as unknown as Tx,
      room.id,
      toISODay(booking.checkInDate),
      toISODay(booking.checkOutDate),
    );
    const verdict = evaluateRoomAvailability({
      room: {
        id: room.id,
        roomNumber: room.roomNumber,
        status: room.status,
        isActive: room.isActive,
      },
      bookings,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      excludeBookingId: booking.id,
    });
    availability = { isSellable: verdict.isSellable, reason: verdict.reason };
  }

  let internationalDetails: Record<string, unknown> | null = null;
  if (booking.primaryGuest.internationalDetails) {
    try {
      internationalDetails = JSON.parse(booking.primaryGuest.internationalDetails);
    } catch {
      internationalDetails = null;
    }
  }

  const depositCollected = (booking.folio?.payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  return buildCheckInValidation({
    bookingId,
    booking: {
      status: booking.status,
      checkInDate: toISODay(booking.checkInDate),
      checkOutDate: toISODay(booking.checkOutDate),
      grandTotal: Number(booking.grandTotal),
      paidAmount: Number(booking.paidAmount),
    },
    room: room
      ? { id: room.id, roomNumber: room.roomNumber, status: room.status, isActive: room.isActive }
      : null,
    guest: {
      fullName: booking.primaryGuest.fullName,
      mobile: booking.primaryGuest.mobile,
      email: booking.primaryGuest.email,
      address: booking.primaryGuest.address,
      city: booking.primaryGuest.city,
      state: booking.primaryGuest.state,
      stateCode: booking.primaryGuest.stateCode,
      country: booking.primaryGuest.country,
      guestType: booking.primaryGuest.guestType,
      corporateGstin: booking.primaryGuest.corporateGstin,
      corporateName: booking.primaryGuest.corporateName,
      identities: booking.primaryGuest.identities.map((i) => ({
        identityType: i.identityType,
        idNumber: i.idNumber,
        maskedIdNumber: i.maskedIdNumber,
        issuedCountry: i.issuedCountry,
        expiryDate: i.expiryDate?.toISOString(),
      })),
      internationalDetails: internationalDetails as never,
    },
    availability,
    additionalPayment: options.additionalPayment,
    depositAmount: depositCollected,
    roomCharges: Number(booking.roomCharges),
    taxAmount: Number(booking.taxAmount),
  });
}

export interface CheckInParams {
  bookingId: string;
  roomId?: string;
  /** Override/refresh the guest profile before the key is issued. */
  guest?: UpsertGuestInput;
  additionalPayment?: {
    amount: number;
    method?: string;
    transactionRef?: string;
    panNumber?: string;
  };
  userId?: string;
  /** Skip the validation gate. Only for system integrations, never the UI. */
  force?: boolean;
}

export async function checkIn(params: CheckInParams) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { hotel: { select: { id: true } } },
  });

  if (!booking) {
    throw new FrontDeskError("Booking not found", ["Booking not found"], 404);
  }

  if (params.guest) {
    const saved = await upsertQuickCheckInGuest({
      ...params.guest,
      userId: params.userId,
    });
    await prisma.booking.update({
      where: { id: params.bookingId },
      data: { primaryGuestId: saved.id },
    });
  }

  if (!params.force) {
    const validation = await validateCheckIn(params.bookingId, {
      roomId: params.roomId,
      additionalPayment: params.additionalPayment,
    });

    if (!validation.isValid) {
      throw new FrontDeskError(
        "Check-in blocked: pre-arrival requirements are not met",
        validation.errors,
        422,
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUniqueOrThrow({
      where: { id: params.bookingId },
      include: { room: true },
    });

    if (current.status === "CheckedIn") {
      throw new FrontDeskError("Guest is already checked in", ["Guest is already checked in"], 409);
    }
    if (["Cancelled", "CheckedOut", "NoShow"].includes(current.status)) {
      throw new FrontDeskError(
        `Cannot check in a booking with status ${current.status}`,
        [`Cannot check in a booking with status ${current.status}`],
        409,
      );
    }

    const targetRoomId = params.roomId || current.roomId;
    if (!targetRoomId) {
      throw new FrontDeskError("Assign a room before checking the guest in", [
        "Assign a room before checking the guest in",
      ]);
    }

    // ---- CHECK (no writes yet) --------------------------------------------
    const { room } = await assertRoomAssignable({
      tx,
      roomId: targetRoomId,
      checkInDate: current.checkInDate,
      checkOutDate: current.checkOutDate,
      excludeBookingId: current.id,
    });

    // ---- UPDATE ----------------------------------------------------------
    const updated = await tx.booking.update({
      where: { id: current.id },
      data: {
        status: "CheckedIn",
        roomId: targetRoomId,
        actualCheckIn: new Date(),
      },
    });

    await tx.room.update({
      where: { id: targetRoomId },
      data: { status: "Occupied" },
    });

    let settledAmount = Number(updated.paidAmount);
    if (params.additionalPayment && params.additionalPayment.amount > 0) {
      const payment = await tx.payment.create({
        data: {
          paymentNumber: await nextDocumentNumber(tx, "payment", `PAY-${new Date().getFullYear()}`),
          folioId: (await tx.folio.findUniqueOrThrow({ where: { bookingId: current.id } })).id,
          guestId: current.primaryGuestId,
          amount: params.additionalPayment.amount as never,
          method: (params.additionalPayment.method ?? "Cash") as never,
          status: "Captured",
          transactionRef: params.additionalPayment.transactionRef ?? "Collected at check-in",
          panNumber: params.additionalPayment.panNumber,
          notes: "Payment collected at check-in desk",
        },
      });

      settledAmount = roundCurrency(settledAmount + params.additionalPayment.amount);
      await syncBookingFinancials(tx, current.id, settledAmount);
      await recordAuditLog(
        {
          hotelId: current.hotelId,
          userId: params.userId,
          action: "CHECK_IN_PAYMENT_CAPTURED",
          entity: "Payment",
          entityId: payment.id,
          newValue: {
            amount: Number(params.additionalPayment.amount),
            method: params.additionalPayment.method,
          },
        },
        tx,
      );
    }

    await recordAuditLog(
      {
        hotelId: current.hotelId,
        userId: params.userId,
        action: "GUEST_CHECKED_IN",
        entity: "Booking",
        entityId: current.id,
        previousValue: { status: current.status, roomId: current.roomId },
        newValue: {
          status: "CheckedIn",
          roomId: targetRoomId,
          roomNumber: room.roomNumber,
          actualCheckIn: updated.actualCheckIn,
        },
      },
      tx,
    );

    await recordAuditLog(
      {
        hotelId: current.hotelId,
        userId: params.userId,
        action: "ROOM_STATUS_UPDATED",
        entity: "Room",
        entityId: targetRoomId,
        previousValue: { status: room.status },
        newValue: { status: "Occupied", reason: "Guest check-in" },
      },
      tx,
    );

    return updated;
  });

  return result;
}

/** Recomputes booking paid/balance figures after any payment movement. */
async function syncBookingFinancials(tx: Tx, bookingId: string, paidAmount: number) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { grandTotal: true },
  });
  const grandTotal = Number(booking.grandTotal);
  await tx.booking.update({
    where: { id: bookingId },
    data: {
      paidAmount: paidAmount as never,
      balanceAmount: roundCurrency(grandTotal - paidAmount) as never,
    },
  });
}

// =============================================================================
// CHECK-OUT
// =============================================================================

export async function getCheckoutSummary(bookingId: string): Promise<CheckoutSummary> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      primaryGuest: true,
      room: true,
      folio: {
        include: {
          items: { where: { isVoided: false } },
          payments: { orderBy: { receivedAt: "desc" } },
          gstTransactions: true,
        },
      },
    },
  });

  if (!booking) {
    throw new FrontDeskError("Booking not found", ["Booking not found"], 404);
  }
  if (!booking.folio) {
    throw new FrontDeskError("No folio found for this booking", [
      "No folio found for this booking",
    ]);
  }

  return buildCheckoutSummary({
    booking: {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      checkInDate: toISODay(booking.checkInDate),
      checkOutDate: toISODay(booking.checkOutDate),
      actualCheckIn: booking.actualCheckIn?.toISOString(),
      actualCheckOut: booking.actualCheckOut?.toISOString(),
      totalNights: booking.totalNights,
      grandTotal: Number(booking.grandTotal),
      paidAmount: Number(booking.paidAmount),
    },
    guest: { fullName: booking.primaryGuest.fullName, mobile: booking.primaryGuest.mobile },
    folio: {
      id: booking.folio.id,
      folioNumber: booking.folio.folioNumber,
      status: booking.folio.status,
      items: booking.folio.items as never,
      payments: booking.folio.payments as never,
      gstTransactions: booking.folio.gstTransactions.map((g) => ({
        taxableAmount: Number(g.taxableAmount),
        cgstRate: Number(g.cgstRate),
        cgstAmount: Number(g.cgstAmount),
        sgstRate: Number(g.sgstRate),
        sgstAmount: Number(g.sgstAmount),
        igstRate: Number(g.igstRate),
        igstAmount: Number(g.igstAmount),
        totalTax: Number(g.totalTax),
        sacCode: g.sacCode,
        placeOfSupply: g.placeOfSupply,
      })),
    },
    room: booking.room ? { id: booking.room.id, roomNumber: booking.room.roomNumber } : null,
  });
}

export interface CheckOutParams {
  bookingId: string;
  settlement?: {
    amount: number;
    method?: string;
    transactionRef?: string;
    panNumber?: string;
  };
  /** Release the room as Clean instead of the default Dirty (housekeeping skip). */
  roomStatus?: RoomStatus;
  userId?: string;
  force?: boolean;
}

export async function checkOut(params: CheckOutParams) {
  const summary = await getCheckoutSummary(params.bookingId);

  if (!params.force && !summary.isSettled && !(params.settlement && params.settlement.amount > 0)) {
    throw new FrontDeskError(
      `Balance of ₹${summary.balanceDue.toLocaleString("en-IN")} is outstanding`,
      [`Balance of ₹${summary.balanceDue.toLocaleString("en-IN")} is outstanding`],
      422,
    );
  }

  const nextRoomStatus: RoomStatus =
    params.roomStatus === "Clean" ? "Clean" : params.roomStatus === "Available" ? "Available" : "Dirty";

  const booking = await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUniqueOrThrow({
      where: { id: params.bookingId },
      include: { room: true, folio: true },
    });

    if (current.status !== "CheckedIn") {
      throw new FrontDeskError(
        "Guest can only be checked out from a CheckedIn booking",
        ["Guest can only be checked out from a CheckedIn booking"],
        409,
      );
    }

    // ---- UPDATE ----------------------------------------------------------
    let credited = summary.totalCredit;
    if (params.settlement && params.settlement.amount > 0 && current.folio) {
      const payment = await tx.payment.create({
        data: {
          paymentNumber: await nextDocumentNumber(tx, "payment", `PAY-${new Date().getFullYear()}`),
          folioId: current.folio.id,
          guestId: current.primaryGuestId,
          amount: params.settlement.amount as never,
          method: (params.settlement.method ?? "Cash") as never,
          status: "Captured",
          transactionRef: params.settlement.transactionRef ?? "Settled at check-out",
          panNumber: params.settlement.panNumber,
          notes: "Balance settled at check-out",
        },
      });
      credited = roundCurrency(credited + params.settlement.amount);

      await tx.folio.update({
        where: { id: current.folio.id },
        data: { totalCredit: credited as never },
      });

      await recordAuditLog(
        {
          hotelId: current.hotelId,
          userId: params.userId,
          action: "CHECK_OUT_PAYMENT_CAPTURED",
          entity: "Payment",
          entityId: payment.id,
          newValue: { amount: Number(params.settlement.amount), method: params.settlement.method },
        },
        tx,
      );
    }

    const finalSummary = await recomputeFolio(tx, current.folio?.id);
    const outstanding = roundCurrency(Math.max(0, finalSummary.balanceDue));

    const updated = await tx.booking.update({
      where: { id: current.id },
      data: {
        status: "CheckedOut",
        actualCheckOut: new Date(),
        paidAmount: credited as never,
        balanceAmount: outstanding as never,
      },
    });

    if (current.room) {
      await tx.room.update({
        where: { id: current.room.id },
        data: { status: nextRoomStatus },
      });
      await recordAuditLog(
        {
          hotelId: current.hotelId,
          userId: params.userId,
          action: "ROOM_RELEASED_ON_CHECKOUT",
          entity: "Room",
          entityId: current.room.id,
          previousValue: { status: current.room.status },
          newValue: { status: nextRoomStatus, reason: "Guest check-out" },
        },
        tx,
      );
    }

    if (current.folio) {
      await tx.folio.update({
        where: { id: current.folio.id },
        data: {
          status: outstanding <= 0.01 ? "Settled" : "Closed",
          ...finalSummary.totals,
        },
      });
    }

    await recordAuditLog(
      {
        hotelId: current.hotelId,
        userId: params.userId,
        action: "GUEST_CHECKED_OUT",
        entity: "Booking",
        entityId: current.id,
        previousValue: { status: current.status, roomId: current.roomId },
        newValue: {
          status: "CheckedOut",
          roomStatus: nextRoomStatus,
          totalDebit: finalSummary.totalDebit,
          totalCredit: finalSummary.totalCredit,
          balanceDue: outstanding,
          depositHeld: summary.advanceDeposit,
        },
      },
      tx,
    );

    return { updated, roomStatus: nextRoomStatus, outstanding, finalSummary };
  });

  return {
    bookingId: booking.updated.id,
    bookingNumber: booking.updated.bookingNumber,
    status: booking.updated.status,
    roomStatus: booking.roomStatus,
    actualCheckOut: booking.updated.actualCheckOut,
    summary: await getCheckoutSummary(params.bookingId),
    outstanding: booking.outstanding,
  };
}

/** Recomputes folio aggregates from live items and captured payments. */
async function recomputeFolio(tx: Tx, folioId?: string) {
  if (!folioId) {
    return {
      totalDebit: 0,
      totalCredit: 0,
      balanceDue: 0,
      totals: {
        totalDebit: 0 as never,
        totalCredit: 0 as never,
        balanceDue: 0 as never,
      },
    };
  }

  const [items, payments] = await Promise.all([
    tx.folioItem.findMany({ where: { folioId, isVoided: false } }),
    tx.payment.findMany({ where: { folioId, status: "Captured" } }),
  ]);

  const totalDebit = roundCurrency(
    items.reduce((sum, i) => sum + Number(i.totalPrice) + Number(i.gstAmount), 0),
  );
  const totalCredit = roundCurrency(
    payments.reduce((sum, p) => sum + Number(p.amount), 0),
  );
  const balanceDue = roundCurrency(totalDebit - totalCredit);

  return {
    totalDebit,
    totalCredit,
    balanceDue,
    totals: {
      totalDebit: totalDebit as never,
      totalCredit: totalCredit as never,
      balanceDue: balanceDue as never,
    },
  };
}

// =============================================================================
// ROOM SWITCH
// =============================================================================

export async function switchBookingRoom(
  request: RoomSwitchRequest,
): Promise<RoomSwitchResult> {
  const reason = request.reason?.trim();
  if (!reason) {
    throw new FrontDeskError("A reason is mandatory for every room switch", [
      "A reason is mandatory for every room switch",
    ]);
  }

  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: request.bookingId },
      include: {
        primaryGuest: true,
        room: true,
        roomType: true,
        ratePlan: true,
        hotel: { select: { stateCode: true } },
        folio: { include: { items: true, payments: true } },
      },
    });

    if (!["CheckedIn", "Confirmed"].includes(booking.status)) {
      throw new FrontDeskError(
        `Room switch is only allowed on an in-house stay (current status ${booking.status})`,
        [`Room switch is only allowed on an in-house stay (current status ${booking.status})`],
        409,
      );
    }

    if (booking.roomId === request.newRoomId) {
      throw new FrontDeskError(
        "Booking is already allocated to this room",
        ["Booking is already allocated to this room"],
      );
    }

    // ---- CHECK (no writes yet) --------------------------------------------
    const { room: targetRoom } = await assertRoomAssignable({
      tx,
      roomId: request.newRoomId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      excludeBookingId: booking.id,
    });

    const newRoomType = await tx.roomType.findUniqueOrThrow({
      where: { id: targetRoom.roomTypeId },
    });

    const previousRoom = booking.room;
    const previousRoomType = booking.roomType;
    const shouldRecalculate =
      request.recalculateRate !== false && newRoomType.id !== previousRoomType.id;

    let newRatePlan = booking.ratePlan;
    if (shouldRecalculate) {
      newRatePlan =
        (await tx.ratePlan.findFirst({
          where: {
            hotelId: booking.hotelId,
            roomTypeId: newRoomType.id,
            isActive: true,
            mealPlan: booking.mealPlan,
          },
          orderBy: { baseRate: "asc" },
        })) ??
        (await tx.ratePlan.findFirst({
          where: { hotelId: booking.hotelId, roomTypeId: newRoomType.id, isActive: true },
          orderBy: { baseRate: "asc" },
        })) ??
        booking.ratePlan;
    }

    const today = toISODay(new Date());
    const switchDate = booking.actualCheckIn
      ? toISODay(booking.actualCheckIn)
      : toISODay(booking.checkInDate);
    const remainingNights = Math.max(
      0,
      countNights({ start: switchDate < today ? today : switchDate, end: booking.checkOutDate }) -
        (switchDate < today ? 1 : 0),
    );

    const previousNightlyRate =
      Number(previousRoomType.basePrice) > 0
        ? Number(previousRoomType.basePrice)
        : Number(booking.roomCharges) / Math.max(1, booking.totalNights);
    const newNightlyRate = shouldRecalculate
      ? Number(newRatePlan.baseRate)
      : previousNightlyRate;

    const rateDifference = roundCurrency(newNightlyRate - previousNightlyRate);
    const adjustmentAmount =
      shouldRecalculate && remainingNights > 0
        ? roundCurrency(rateDifference * remainingNights)
        : 0;

    // ---- UPDATE ----------------------------------------------------------
    await tx.room.update({
      where: { id: targetRoom.id },
      data: { status: "Occupied" },
    });

    if (previousRoom) {
      await tx.room.update({
        where: { id: previousRoom.id },
        data: { status: "Dirty" },
      });
    }

    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        roomId: targetRoom.id,
        roomTypeId: newRoomType.id,
        ratePlanId: newRatePlan.id,
      },
    });

    if (booking.folio && adjustmentAmount !== 0) {
      const isUpgrade = adjustmentAmount > 0;
      const lineTotal = Math.abs(adjustmentAmount);
      const gstCalc = buildReservationQuote({
        checkInDate: switchDate,
        checkOutDate: toISODay(booking.checkOutDate),
        adults: booking.adults,
        children: booking.children,
        mealPlan: booking.mealPlan,
        hotelStateCode: booking.hotel.stateCode,
        guestStateCode: booking.primaryGuest.stateCode ?? undefined,
        ratePlan: { baseRate: Math.abs(rateDifference) },
      });

      const item = await tx.folioItem.create({
        data: {
          folioId: booking.folio.id,
          itemType: isUpgrade ? "Room" : "Discount",
          description: `Room switch ${previousRoom?.roomNumber ?? "—"} → ${targetRoom.roomNumber} (${newRoomType.name}), ${remainingNights} night(s) @ ₹${Math.abs(rateDifference).toLocaleString("en-IN")}`,
          quantity: remainingNights,
          unitPrice: Math.abs(rateDifference) as never,
          totalPrice: lineTotal as never,
          sacCode: gstCalc.gst.sacCode,
          gstRate: gstCalc.gst.gstRate as never,
          gstAmount: (isUpgrade ? gstCalc.gst.totalTax : 0) as never,
        },
      });

      if (isUpgrade) {
        await tx.gSTTransaction.create({
          data: {
            folioId: booking.folio.id,
            folioItemId: item.id,
            taxableAmount: lineTotal as never,
            cgstRate: gstCalc.gst.cgstRate as never,
            cgstAmount: gstCalc.gst.cgstAmount as never,
            sgstRate: gstCalc.gst.sgstRate as never,
            sgstAmount: gstCalc.gst.sgstAmount as never,
            igstRate: gstCalc.gst.igstRate as never,
            igstAmount: gstCalc.gst.igstAmount as never,
            totalTax: gstCalc.gst.totalTax as never,
            sacCode: gstCalc.gst.sacCode,
            placeOfSupply: gstCalc.gst.placeOfSupply,
          },
        });
      }
    }

    const recomputed = await recomputeFolio(tx, booking.folio?.id);
    if (booking.folio) {
      await tx.folio.update({
        where: { id: booking.folio.id },
        data: recomputed.totals,
      });
    }

    if (adjustmentAmount !== 0) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          roomCharges: (Number(booking.roomCharges) + Math.max(0, adjustmentAmount)) as never,
          extraCharges: (Number(booking.extraCharges) - Math.min(0, adjustmentAmount)) as never,
          grandTotal: (Number(booking.grandTotal) + adjustmentAmount) as never,
          balanceAmount: (recomputed.balanceDue) as never,
        },
      });
    } else {
      await tx.booking.update({
        where: { id: booking.id },
        data: { balanceAmount: recomputed.balanceDue as never },
      });
    }

    await recordAuditLog(
      {
        hotelId: booking.hotelId,
        userId: request.userId,
        action: "ROOM_SWITCHED",
        entity: "Booking",
        entityId: booking.id,
        previousValue: {
          roomId: previousRoom?.id,
          roomNumber: previousRoom?.roomNumber,
          roomType: previousRoomType.name,
          ratePlan: booking.ratePlan.code,
          nightlyRate: previousNightlyRate,
          roomStatus: previousRoom?.status,
        },
        newValue: {
          roomId: targetRoom.id,
          roomNumber: targetRoom.roomNumber,
          roomType: newRoomType.name,
          ratePlan: newRatePlan.code,
          nightlyRate: newNightlyRate,
          remainingNights,
          adjustmentAmount,
          reason,
          roomStatus: "Occupied",
        },
      },
      tx,
    );

    return {
      bookingId: updatedBooking.id,
      bookingNumber: updatedBooking.bookingNumber,
      previousRoomId: previousRoom?.id,
      previousRoomNumber: previousRoom?.roomNumber,
      newRoomId: targetRoom.id,
      newRoomNumber: targetRoom.roomNumber,
      newRoomTypeName: newRoomType.name,
      previousRoomStatus: (previousRoom?.status ?? "Available") as RoomStatus,
      newRoomStatus: "Occupied",
      rateRecalculated: shouldRecalculate,
      previousNightlyRate,
      newNightlyRate,
      remainingNights,
      rateDifference,
      adjustmentAmount,
      grandTotal: Number(updatedBooking.grandTotal) + adjustmentAmount,
      balanceDue: recomputed.balanceDue,
      auditAction: "ROOM_SWITCHED",
    };
  });
}

// =============================================================================
// ROOM STATE
// =============================================================================

export async function updateRoomState(params: {
  roomId: string;
  status: RoomStatus;
  userId?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUniqueOrThrow({
      where: { id: params.roomId },
      include: { bookings: { where: { status: "CheckedIn" }, select: { id: true, bookingNumber: true } } },
    });

    const hasInHouseBooking = room.bookings.length > 0;

    const verdict = checkRoomStateTransition({
      from: room.status,
      to: params.status,
      isActive: room.isActive,
      hasInHouseBooking,
    });

    if (!verdict.allowed) {
      throw new FrontDeskError(verdict.reason ?? "Room state change not allowed", [
        verdict.reason ?? "Room state change not allowed",
      ], 409);
    }

    const updated = await tx.room.update({
      where: { id: room.id },
      data: { status: params.status as never },
    });

    await recordAuditLog(
      {
        hotelId: room.hotelId,
        userId: params.userId,
        action: "ROOM_STATUS_UPDATED",
        entity: "Room",
        entityId: room.id,
        previousValue: { status: room.status },
        newValue: { status: params.status },
      },
      tx,
    );

    return {
      roomId: updated.id,
      roomNumber: updated.roomNumber,
      previousStatus: room.status,
      status: updated.status as RoomStatus,
      allowedNextStates: getSuggestedNextStates(updated.status as RoomStatus),
    };
  });
}

// =============================================================================
// DASHBOARD
// =============================================================================

export async function getFrontDeskDashboard(
  businessDate?: string,
): Promise<FrontDeskDashboardSummary> {
  const hotelId = await getDefaultHotelId();
  const date = toISODay(businessDate ?? new Date());

  const [rooms, arrivals, departures, inHouse] = await Promise.all([
    prisma.room.findMany({ where: { hotelId }, select: { status: true, isActive: true } }),
    prisma.booking.count({
      where: {
        hotelId,
        status: { in: ["Confirmed", "Tentative"] },
        checkInDate: new Date(`${date}T00:00:00.000Z`),
      },
    }),
    prisma.booking.count({
      where: { hotelId, status: "CheckedIn", checkOutDate: new Date(`${date}T00:00:00.000Z`) },
    }),
    prisma.booking.aggregate({
      where: { hotelId, status: "CheckedIn" },
      _count: { _all: true },
      _sum: { adults: true, children: true, grandTotal: true, paidAmount: true },
    }),
  ]);

  const occupiedRooms = rooms.filter((r) => r.status === "Occupied").length;
  const sellableRooms = rooms.filter(
    (r) =>
      r.isActive &&
      (r.status === "Available" || r.status === "Clean" || r.status === "Dirty"),
  ).length;
  const inHouseGuests = (inHouse._sum.adults ?? 0) + (inHouse._sum.children ?? 0);

  const outstanding = await prisma.folio.aggregate({
    where: { hotelId, status: { in: ["Open", "Closed"] } },
    _sum: { balanceDue: true },
  });

  return {
    hotelId,
    businessDate: date,
    occupancyPct: rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0,
    occupiedRooms,
    sellableRooms,
    arrivals,
    departures,
    inHouse: inHouse._count._all,
    inHouseGuests,
    dirtyRooms: rooms.filter((r) => r.status === "Dirty").length,
    maintenanceRooms: rooms.filter(
      (r) => r.status === "Maintenance" || r.status === "Blocked",
    ).length,
    roomRevenue: Number(inHouse._sum.grandTotal ?? 0),
    advanceDepositsHeld: Number(inHouse._sum.paidAmount ?? 0),
    outstandingBalance: Number(outstanding._sum.balanceDue ?? 0),
  };
}

export type { FrontDeskPaymentStatus };
