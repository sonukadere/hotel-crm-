import { prisma } from "../db/prisma";
import { MealPlan, IdentityType } from "@hotel/types";
import { calculateBookingSubtotal, calculateRoomGST, maskAadhaar } from "@hotel/utils";
import { recordAuditLog } from "./auditService";

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
  };
  advancePayment?: {
    amount: number;
    method: "Cash" | "UPI" | "Card" | "Razorpay" | "Bank_Transfer";
    transactionRef?: string;
  };
  userId?: string;
}

export async function createReservation(params: CreateBookingParams) {
  let guest = await prisma.guest.findFirst({
    where: { mobile: params.guest.mobile },
    include: { identities: true },
  });

  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        fullName: params.guest.fullName,
        mobile: params.guest.mobile,
        email: params.guest.email,
        address: params.guest.address,
        city: params.guest.city,
        stateCode: params.guest.stateCode,
        state: params.guest.state,
        country: params.guest.country || "India",
        corporateGstin: params.guest.corporateGstin,
        corporateName: params.guest.corporateName,
      },
      include: { identities: true },
    });

    if (params.guest.identityType && params.guest.idNumber) {
      await prisma.guestIdentity.create({
        data: {
          guestId: guest.id,
          identityType: params.guest.identityType as any,
          idNumber: params.guest.idNumber,
          maskedIdNumber:
            params.guest.identityType === "Aadhaar"
              ? maskAadhaar(params.guest.idNumber)
              : params.guest.idNumber.slice(-4).padStart(params.guest.idNumber.length, "*"),
        },
      });
    }
  }

  const ratePlan = await prisma.ratePlan.findUniqueOrThrow({
    where: { id: params.ratePlanId },
    include: { hotel: true },
  });

  const rateCalc = calculateBookingSubtotal({
    basePlanRate: Number(ratePlan.baseRate),
    seasonalMultiplier: Number(ratePlan.seasonalMultiplier),
    weekendMultiplier: Number(ratePlan.weekendMultiplier),
    extraAdults: Math.max(0, params.adults - 2),
    extraChildren: params.children || 0,
    extraAdultRatePerNight: Number(ratePlan.extraAdultRate),
    extraChildRatePerNight: Number(ratePlan.extraChildRate),
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    adultCount: params.adults,
    childCount: params.children,
    mealPlan: params.mealPlan,
  });

  const gstCalc = calculateRoomGST({
    tariffPerNightOrTotal: rateCalc.taxableAmount,
    hotelStateCode: ratePlan.hotel.stateCode,
    guestStateCode: params.guest.stateCode,
  });

  const bookingNumber = `BKG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const folioNumber = `FOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const booking = await prisma.$transaction(async (tx) => {
    if (params.roomId) {
      const room = await tx.room.findUnique({ where: { id: params.roomId } });
      if (!room || room.status === "Occupied" || room.status === "Blocked") {
        throw new Error(`Selected Room ${room?.roomNumber || ""} is not available for booking`);
      }
    }

    const newBooking = await tx.booking.create({
      data: {
        bookingNumber,
        hotelId: params.hotelId,
        roomId: params.roomId,
        roomTypeId: params.roomTypeId,
        ratePlanId: params.ratePlanId,
        primaryGuestId: guest!.id,
        checkInDate: new Date(params.checkInDate),
        checkOutDate: new Date(params.checkOutDate),
        adults: params.adults,
        children: params.children || 0,
        mealPlan: params.mealPlan as any,
        bookingSource: params.bookingSource || "Direct",
        specialRequests: params.specialRequests,
        totalNights: rateCalc.totalNights,
        roomCharges: rateCalc.roomSubtotal as any,
        extraCharges: (rateCalc.extraGuestCharges + rateCalc.mealPlanCharges) as any,
        discountAmount: rateCalc.totalDiscount as any,
        taxAmount: gstCalc.totalTax as any,
        grandTotal: gstCalc.grandTotal as any,
        paidAmount: (params.advancePayment?.amount || 0) as any,
        balanceAmount: (gstCalc.grandTotal - (params.advancePayment?.amount || 0)) as any,
        status: "Confirmed",
      },
    });

    await tx.bookingGuest.create({
      data: {
        bookingId: newBooking.id,
        guestId: guest!.id,
        isPrimary: true,
      },
    });

    const folio = await tx.folio.create({
      data: {
        folioNumber,
        hotelId: params.hotelId,
        bookingId: newBooking.id,
        guestId: guest!.id,
        status: "Open",
        totalDebit: gstCalc.grandTotal as any,
        totalCredit: (params.advancePayment?.amount || 0) as any,
        balanceDue: (gstCalc.grandTotal - (params.advancePayment?.amount || 0)) as any,
      },
    });

    const folioItem = await tx.folioItem.create({
      data: {
        folioId: folio.id,
        itemType: "Room",
        description: `Room Tariff Accommodation (${rateCalc.totalNights} Nights) - SAC ${gstCalc.sacCode}`,
        quantity: rateCalc.totalNights,
        unitPrice: (rateCalc.taxableAmount / rateCalc.totalNights) as any,
        totalPrice: rateCalc.taxableAmount as any,
        sacCode: gstCalc.sacCode,
        gstRate: gstCalc.gstRate as any,
        gstAmount: gstCalc.totalTax as any,
      },
    });

    await tx.gSTTransaction.create({
      data: {
        folioId: folio.id,
        folioItemId: folioItem.id,
        taxableAmount: rateCalc.taxableAmount as any,
        cgstRate: gstCalc.cgstRate as any,
        cgstAmount: gstCalc.cgstAmount as any,
        sgstRate: gstCalc.sgstRate as any,
        sgstAmount: gstCalc.sgstAmount as any,
        igstRate: gstCalc.igstRate as any,
        igstAmount: gstCalc.igstAmount as any,
        totalTax: gstCalc.totalTax as any,
        sacCode: gstCalc.sacCode,
        placeOfSupply: gstCalc.placeOfSupply,
      },
    });

    if (params.advancePayment && params.advancePayment.amount > 0) {
      await tx.payment.create({
        data: {
          paymentNumber: `PAY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          folioId: folio.id,
          amount: params.advancePayment.amount as any,
          method: params.advancePayment.method as any,
          status: "Captured",
          transactionRef: params.advancePayment.transactionRef || "Advance Deposit",
          notes: "Advance collected at reservation creation",
        },
      });
    }

    return newBooking;
  });

  await recordAuditLog({
    hotelId: params.hotelId,
    userId: params.userId,
    action: "RESERVATION_CREATED",
    entity: "Booking",
    entityId: booking.id,
    newValue: { bookingNumber, guestName: params.guest.fullName, total: gstCalc.grandTotal },
  });

  return booking;
}

export async function checkInGuest(bookingId: string, roomId?: string, userId?: string) {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { primaryGuest: { include: { identities: true } } },
    });

    const targetRoomId = roomId || booking.roomId;
    if (!targetRoomId) {
      throw new Error("Cannot check in without assigning a room");
    }

    const room = await tx.room.findUniqueOrThrow({ where: { id: targetRoomId } });
    if (room.status === "Occupied") {
      throw new Error(`Room ${room.roomNumber} is currently occupied.`);
    }

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
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

    await recordAuditLog({
      hotelId: booking.hotelId,
      userId,
      action: "GUEST_CHECKED_IN",
      entity: "Booking",
      entityId: bookingId,
      newValue: { roomNumber: room.roomNumber, guest: booking.primaryGuest.fullName },
    });

    return updatedBooking;
  });
}

export async function checkOutGuest(bookingId: string, userId?: string) {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { folio: { include: { items: true, payments: true } } },
    });

    if (booking.status !== "CheckedIn") {
      throw new Error("Guest can only be checked out from CheckedIn status");
    }

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CheckedOut",
        actualCheckOut: new Date(),
      },
    });

    if (booking.roomId) {
      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: "Dirty" },
      });
    }

    if (booking.folio) {
      const balance = Number(booking.folio.balanceDue);
      if (balance <= 0.01) {
        await tx.folio.update({
          where: { id: booking.folio.id },
          data: { status: "Settled" },
        });
      }
    }

    await recordAuditLog({
      hotelId: booking.hotelId,
      userId,
      action: "GUEST_CHECKED_OUT",
      entity: "Booking",
      entityId: bookingId,
    });

    return updatedBooking;
  });
}

export async function switchRoom(
  bookingId: string,
  newRoomId: string,
  reason: string,
  userId?: string,
) {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { room: true },
    });

    const oldRoom = booking.room;
    const targetRoom = await tx.room.findUniqueOrThrow({ where: { id: newRoomId } });

    if (targetRoom.status === "Occupied" || targetRoom.status === "Blocked") {
      throw new Error(`Target Room ${targetRoom.roomNumber} is not available for room switch`);
    }

    if (oldRoom) {
      await tx.room.update({
        where: { id: oldRoom.id },
        data: { status: "Dirty" },
      });
    }

    await tx.room.update({
      where: { id: newRoomId },
      data: { status: "Occupied" },
    });

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: { roomId: newRoomId },
    });

    await recordAuditLog({
      hotelId: booking.hotelId,
      userId,
      action: "ROOM_SWITCHED",
      entity: "Booking",
      entityId: bookingId,
      previousValue: { roomId: oldRoom?.id, roomNumber: oldRoom?.roomNumber },
      newValue: { roomId: newRoomId, roomNumber: targetRoom.roomNumber, reason },
    });

    return updatedBooking;
  });
}
