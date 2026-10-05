import type {
  MealPlan,
  QuoteLine,
  ReservationQuote,
  ReservationQuoteInput,
} from "@hotel/types";
import { calculateBookingSubtotal } from "../rates/rates";
import { calculateStayGST } from "../gst/calculateStayGST";
import { roundCurrency, numberToIndianWords } from "../formatters";
import { countNights } from "./dateRanges";

/**
 * Builds the full front-desk rate quote for a stay:
 * room rate -> extra guest charges -> meal plan -> discount -> GST -> deposit -> balance.
 *
 * This is a pure function so the reservation modal, the create-reservation endpoint
 * and the room switch endpoint all quote identically and can be unit tested.
 */
export function buildReservationQuote(input: ReservationQuoteInput): ReservationQuote {
  const errors: string[] = [];
  const warnings: string[] = [];

  const adults = Math.max(1, Math.floor(input.adults || 0));
  const children = Math.max(0, Math.floor(input.children || 0));
  const mealPlan: MealPlan = input.mealPlan ?? input.ratePlan.mealPlan ?? "EP";
  const baseAdults = Math.max(1, input.baseAdults ?? 2);

  const nights = countNights({ start: input.checkInDate, end: input.checkOutDate });

  if (input.maxAdults !== undefined && adults > input.maxAdults) {
    warnings.push(
      `${adults} adults exceeds the room type maximum of ${input.maxAdults}`,
    );
  }
  if (input.maxChildren !== undefined && children > input.maxChildren) {
    warnings.push(
      `${children} children exceeds the room type maximum of ${input.maxChildren}`,
    );
  }
  if (nights > 30) {
    warnings.push("Stays longer than 30 nights require manager approval");
  }
  if ((input.discountPercent ?? 0) > 50) {
    warnings.push("Discount above 50% requires manager approval");
  }
  if (
    (input.discountPercent ?? 0) < 0 ||
    (input.discountFlat ?? 0) < 0 ||
    input.checkOutDate === input.checkInDate
  ) {
    errors.push("Check-out date must be after check-in date and discounts cannot be negative");
  }

  const rate = calculateBookingSubtotal({
    basePlanRate: input.ratePlan.baseRate,
    seasonalMultiplier: input.ratePlan.seasonalMultiplier,
    weekendMultiplier: input.ratePlan.weekendMultiplier,
    extraAdults: Math.max(0, adults - baseAdults),
    extraChildren: children,
    extraAdultRatePerNight: input.ratePlan.extraAdultRate,
    extraChildRatePerNight: input.ratePlan.extraChildRate,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    mealPlan,
    mealPlanRatePerPersonPerNight: input.mealPlanRatePerPersonPerNight,
    adultCount: adults,
    childCount: children,
    discountPercent: input.discountPercent,
    discountFlat: input.discountFlat,
  });

  // GST is assessed per night so a stay may legitimately straddle the 12%/18% slabs.
  const { breakdown: gst, slabs } = calculateStayGST({
    nightlyTariffs: rate.nights.map((n) => ({
      tariff: n.effectiveNightlyRate,
      date: n.date,
    })),
    hotelStateCode: input.hotelStateCode,
    guestStateCode: input.guestStateCode,
  });

  const grandTotal = roundCurrency(gst.taxableAmount + gst.totalTax);
  const advanceDeposit = roundCurrency(Math.max(0, input.advanceDeposit ?? 0));

  if (advanceDeposit > grandTotal) {
    errors.push("Advance deposit cannot exceed the grand total");
  }

  const balanceDue = roundCurrency(grandTotal - advanceDeposit);

  const lines: QuoteLine[] = [
    {
      key: "roomCharges",
      label: `Room charges (${rate.totalNights} night${rate.totalNights === 1 ? "" : "s"})`,
      amount: rate.roomSubtotal,
      kind: "charge",
    },
  ];

  if (rate.extraGuestCharges > 0) {
    lines.push({
      key: "extraGuestCharges",
      label: `Extra guest charges (${Math.max(0, adults - baseAdults)} adult(s), ${children} child(ren))`,
      amount: rate.extraGuestCharges,
      kind: "charge",
    });
  }

  if (rate.mealPlanCharges > 0) {
    lines.push({
      key: "mealPlanCharges",
      label: `Meal plan charges (${mealPlan})`,
      amount: rate.mealPlanCharges,
      kind: "charge",
    });
  }

  if (rate.totalDiscount > 0) {
    const discountLabel = (input.discountPercent ?? 0) > 0
      ? `Discount (${input.discountPercent}%${(input.discountFlat ?? 0) > 0 ? ` + ₹${roundCurrency(input.discountFlat ?? 0)}` : ""})`
      : "Discount (flat)";
    lines.push({
      key: "discount",
      label: discountLabel,
      amount: -rate.totalDiscount,
      kind: "discount",
    });
  }

  if (gst.cgstAmount > 0) {
    lines.push({
      key: "cgst",
      label: `CGST @ ${(gst.cgstRate * 100).toFixed(0)}%`,
      amount: gst.cgstAmount,
      kind: "tax",
    });
    lines.push({
      key: "sgst",
      label: `SGST @ ${(gst.sgstRate * 100).toFixed(0)}%`,
      amount: gst.sgstAmount,
      kind: "tax",
    });
  } else if (gst.igstAmount > 0) {
    lines.push({
      key: "igst",
      label: `IGST @ ${(gst.igstRate * 100).toFixed(0)}% (inter-state)`,
      amount: gst.igstAmount,
      kind: "tax",
    });
  }

  if (advanceDeposit > 0) {
    lines.push({
      key: "advanceDeposit",
      label: "Advance deposit collected",
      amount: -advanceDeposit,
      kind: "discount",
    });
  }

  lines.push({
    key: "grandTotal",
    label: "Grand total",
    amount: grandTotal,
    kind: "total",
  });

  lines.push({
    key: "balanceDue",
    label: "Balance due at check-out",
    amount: balanceDue,
    kind: "total",
  });

  return {
    totalNights: rate.totalNights,
    nights: rate.nights,
    nightsPerSlab: slabs,
    roomCharges: rate.roomSubtotal,
    extraCharges: roundCurrency(rate.extraGuestCharges),
    mealPlanCharges: rate.mealPlanCharges,
    discountAmount: rate.totalDiscount,
    taxableAmount: gst.taxableAmount,
    gst,
    grandTotal,
    advanceDeposit,
    balanceDue,
    amountInWords: numberToIndianWords(grandTotal),
    lines,
    errors,
    warnings,
  };
}
