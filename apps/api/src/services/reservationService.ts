import { prisma } from "../db/prisma";
import type { MealPlan, IdentityType } from "@hotel/types";
import {
  buildReservationQuote,
  maskAadhaar,
  roundCurrency,
  toISODay,
} from "@hotel/utils";
import { recordAuditLog } from "./auditService";
import { isMaskedIdentityValue } from "../security/sanitize";
import {
  FrontDeskError,
  checkIn as checkInStay,
  checkOut as checkOutStay,
  switchBookingRoom,
} from "./frontDeskService";

async function assertRoomAssignable({
  tx,
  roomId,
  checkInDate,
  checkOutDate,
}: {
  tx: any;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
}) {
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) throw new FrontDeskError("Selected room is not active");
  const conflicting = await tx.booking.findFirst({
    where: {
      roomId,
      status: { in: ["Confirmed", "CheckedIn"] },
      checkInDate: { lt: new Date(`${checkOutDate}T00:00:00.000Z`) },
      checkOutDate: { gt: new Date(`${checkInDate}T00:00:00.000Z`) },
    },
  });
  if (conflicting) {
    throw new FrontDeskError("Room is already booked for these dates");
  }
}

async function nextBookingNumber(tx: any, checkInDate: string): Promise<string> {
  const count = await tx.booking.count();
  const dateStr = checkInDate.replace(/-/g, "").slice(2);
  return `BK-${dateStr}-${String(count + 1).padStart(4, "0")}`;
}

async function nextFolioNumber(tx: any): Promise<string> {
  const count = await tx.folio.count();
  const year = new Date().getFullYear();
  return `FOL-${year}-${String(count + 1).padStart(5, "0")}`;
}

async function nextPaymentNumber(tx: any): Promise<string> {
  const count = await tx.payment.count();
  const year = new Date().getFullYear();
  return `PAY-${year}-${String(count + 1).padStart(5, "0")}`;
}

export interface CreateBookingParams {
  hotelId: string;
  roomId?: string;
  roomTypeId: string;
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  mealPlan: MealPlan;
  bookingSource?: string;
  specialRequests?: string;
  guest: {
    fullName: string;
    mobile: string;
    email?: string;
    address?: string;
    city?: string;
    stateCode?: string;
    state?: string;
    country?: string;
    identityType?: IdentityType;
    idNumber?: string;
    corporateGstin?: string;
    corporateName?: string;
    guestType?: string;
  };
  discountPercent?: number;
  discountFlat?: number;
  mealPlanRatePerPersonPerNight?: number;
  advancePayment?: {
    amount: number;
    method: "Cash" | "UPI" | "Card" | "Razorpay" | "Bank_Transfer";
    transactionRef?: string;
    panNumber?: string;
  };
  userId?: string;
}

/**
 * Creates a reservation.
 *
 * The whole write runs in one transaction and is guarded by the same
 * `assertRoomAssignable` gate used by check-in and room switch, so a room can
 * never be double-booked: the overlapping-booking probe happens on the
 * transaction snapshot *before* the booking, folio, GST and payment rows exist.
 */
export async function createReservation(params: CreateBookingParams) {
  const checkInDate = toISODay(params.checkInDate);
  const checkOutDate = toISODay(params.checkOutDate);

  if (checkInDate >= checkOutDate) {
    throw new FrontDeskError("Check-out date must be after check-in date", [
      "Check-out date must be after check-in date",
    ]);
  }

  return await prisma.$transaction(async (tx) => {
    // ---- CHECK (no writes yet) --------------------------------------------
    let guest = await tx.guest.findFirst({
      where: { mobile: { endsWith: params.guest.mobile.replace(/[^0-9]/g, "").slice(-10) } },
      include: { identities: true },
    });

    const ratePlan = await tx.ratePlan.findUniqueOrThrow({
      where: { id: params.ratePlanId },
      include: { hotel: true, roomType: true },
    });

    const quote = buildReservationQuote({
      checkInDate,
      checkOutDate,
      adults: params.adults,
      children: params.children,
      mealPlan: params.mealPlan,
      mealPlanRatePerPersonPerNight: params.mealPlanRatePerPersonPerNight,
      discountPercent: params.discountPercent,
      discountFlat: params.discountFlat,
      advanceDeposit: params.advancePayment?.amount,
      hotelStateCode: ratePlan.hotel.stateCode,
      guestStateCode: params.guest.stateCode,
      baseAdults: ratePlan.roomType.baseAdults,
      maxAdults: ratePlan.roomType.maxAdults,
      maxChildren: ratePlan.roomType.maxChildren,
      ratePlan: {
        baseRate: Number(ratePlan.baseRate),
        seasonalMultiplier: Number(ratePlan.seasonalMultiplier),
        weekendMultiplier: Number(ratePlan.weekendMultiplier),
        extraAdultRate: Number(ratePlan.extraAdultRate),
        extraChildRate: Number(ratePlan.extraChildRate),
        mealPlan: ratePlan.mealPlan as MealPlan,
      },
    });

    if (quote.errors.length > 0) {
      throw new FrontDeskError("Reservation cannot be created", quote.errors);
    }

    if (params.roomId) {
      await assertRoomAssignable({
        tx,
        roomId: params.roomId,
        checkInDate,
        checkOutDate,
      });
    }

    // ---- UPDATE ----------------------------------------------------------
    if (!guest) {
      guest = await tx.guest.create({
        data: {
          fullName: params.guest.fullName,
          mobile: params.guest.mobile,
          email: params.guest.email,
          address: params.guest.address,
          city: params.guest.city,
          stateCode: params.guest.stateCode,
          state: params.guest.state,
          country: params.guest.country || "India",
          guestType: (params.guest.guestType ?? "Domestic") as never,
          corporateGstin: params.guest.corporateGstin,
          corporateName: params.guest.corporateName,
        },
        include: { identities: true },
      });

      if (params.guest.identityType && params.guest.idNumber && !isMaskedIdentityValue(params.guest.idNumber)) {
        await tx.guestIdentity.create({
          data: {
            guestId: guest.id,
            identityType: params.guest.identityType as never,
            idNumber: params.guest.idNumber,
            maskedIdNumber:
              params.guest.identityType === "Aadhaar"
                ? maskAadhaar(params.guest.idNumber)
                : `****${params.guest.idNumber.slice(-4)}`,
          },
        });
      }
    }

    const bookingNumber = await nextBookingNumber(tx, params.checkInDate);

    const booking = await tx.booking.create({
      data: {
        bookingNumber,
        hotelId: params.hotelId,
        roomId: params.roomId,
        roomTypeId: params.roomTypeId,
        ratePlanId: params.ratePlanId,
        primaryGuestId: guest.id,
        checkInDate: new Date(`${checkInDate}T00:00:00.000Z`),
        checkOutDate: new Date(`${checkOutDate}T00:00:00.000Z`),
        adults: params.adults,
        children: params.children || 0,
        mealPlan: params.mealPlan as never,
        bookingSource: params.bookingSource || "Direct",
        specialRequests: params.specialRequests,
        totalNights: quote.totalNights,
        roomCharges: quote.roomCharges as never,
        extraCharges: roundCurrency(quote.extraCharges + quote.mealPlanCharges) as never,
        discountAmount: quote.discountAmount as never,
        taxAmount: quote.gst.totalTax as never,
        grandTotal: quote.grandTotal as never,
        paidAmount: (params.advancePayment?.amount || 0) as never,
        balanceAmount: quote.balanceDue as never,
        status: "Confirmed",
      },
    });

    await tx.bookingGuest.create({
      data: { bookingId: booking.id, guestId: guest.id, isPrimary: true },
    });

    await tx.reservation.create({
      data: {
        bookingId: booking.id,
        confirmedDate: new Date(),
        notes: params.specialRequests,
      },
    });

    const folio = await tx.folio.create({
      data: {
        folioNumber: await nextFolioNumber(tx),
        hotelId: params.hotelId,
        bookingId: booking.id,
        guestId: guest.id,
        status: "Open",
        totalDebit: quote.grandTotal as never,
        totalCredit: (params.advancePayment?.amount || 0) as never,
        balanceDue: quote.balanceDue as never,
      },
    });

    // One folio line per GST slab keeps the tax invoice defensible when a stay
    // straddles the 12% / 18% accommodation thresholds.
    for (const slab of quote.nightsPerSlab) {
      const item = await tx.folioItem.create({
        data: {
          folioId: folio.id,
          itemType: "Room",
          description: `Room Tariff Accommodation (${quote.totalNights} Nights, ${slab.nightCount} night(s) @ ${(slab.gstRate * 100).toFixed(0)}% GST) - SAC ${quote.gst.sacCode}`,
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

    if (params.advancePayment && params.advancePayment.amount > 0) {
      await tx.payment.create({
        data: {
          paymentNumber: await nextPaymentNumber(tx),
          folioId: folio.id,
          guestId: guest.id,
          amount: params.advancePayment.amount as never,
          method: params.advancePayment.method as never,
          status: "Captured",
          transactionRef: params.advancePayment.transactionRef || "Advance Deposit",
          panNumber: params.advancePayment.panNumber,
          notes: "Advance collected at reservation creation",
        },
      });
    }

    await recordAuditLog(
      {
        hotelId: params.hotelId,
        userId: params.userId,
        action: "RESERVATION_CREATED",
        entity: "Booking",
        entityId: booking.id,
        newValue: {
          bookingNumber,
          guestName: params.guest.fullName,
          roomId: params.roomId,
          checkInDate,
          checkOutDate,
          total: quote.grandTotal,
          deposit: params.advancePayment?.amount ?? 0,
        },
      },
      tx,
    );

    return booking;
  });
}

// -----------------------------------------------------------------------------
// BACKWARDS-COMPATIBLE WRAPPERS
// -----------------------------------------------------------------------------
// The `/api/reservations/*` routes predate this module and are kept working.
// All four now delegate to the guarded front-desk implementation so there is a
// single transactional code path for every room mutation.

export async function checkInGuest(
  bookingId: string,
  roomId?: string,
  userId?: string,
  additionalPayment?: { amount: number; method?: string; panNumber?: string },
) {
  return await checkInStay({ bookingId, roomId, userId, additionalPayment });
}

export async function checkOutGuest(bookingId: string, userId?: string) {
  return await checkOutStay({ bookingId, userId });
}

export async function switchRoom(
  bookingId: string,
  newRoomId: string,
  reason: string,
  userId?: string,
  recalculateRate = true,
) {
  return await switchBookingRoom({ bookingId, newRoomId, reason, userId, recalculateRate });
}
