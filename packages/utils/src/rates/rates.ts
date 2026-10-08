import { RateCalculationInput, RateCalculationResult, NightlyRateBreakdown } from "@hotel/types";
import { parseISODate, formatDateToISO, isWeekendNight } from "../dates";
import { roundCurrency } from "../formatters";

export interface EffectiveDailyRateParams {
  basePlanRate: number;
  seasonalMultiplier?: number;
  weekendMultiplier?: number;
  extraAdults?: number;
  extraChildren?: number;
  extraAdultRatePerNight?: number;
  extraChildRatePerNight?: number;
  isWeekend?: boolean;
}

/**
 * Calculates effective daily room rate for a single night
 * Formula: (basePlanRate * seasonalMultiplier * weekendMultiplier) + (extraAdults * extraAdultRatePerNight) + (extraChildren * extraChildRatePerNight)
 */
export function calculateEffectiveDailyRate(
  paramsOrBaseRate: EffectiveDailyRateParams | number,
  maybeSeasonalMultiplier?: number,
  maybeWeekendMultiplier?: number,
  maybeExtraAdults?: number,
  maybeExtraChildren?: number,
  maybeExtraAdultRate?: number,
  maybeExtraChildRate?: number,
  maybeIsWeekend?: boolean,
): {
  roomBaseNightly: number;
  extraAdultCharges: number;
  extraChildCharges: number;
  totalDailyRate: number;
} {
  let basePlanRate: number;
  let seasonalMultiplier = 1.0;
  let weekendMultiplier = 1.0;
  let extraAdults = 0;
  let extraChildren = 0;
  let extraAdultRatePerNight = 0;
  let extraChildRatePerNight = 0;
  let isWeekend = false;

  if (typeof paramsOrBaseRate === "number") {
    basePlanRate = paramsOrBaseRate;
    seasonalMultiplier = maybeSeasonalMultiplier ?? 1.0;
    weekendMultiplier = maybeWeekendMultiplier ?? 1.0;
    extraAdults = maybeExtraAdults ?? 0;
    extraChildren = maybeExtraChildren ?? 0;
    extraAdultRatePerNight = maybeExtraAdultRate ?? 0;
    extraChildRatePerNight = maybeExtraChildRate ?? 0;
    isWeekend = maybeIsWeekend ?? false;
  } else {
    basePlanRate = paramsOrBaseRate.basePlanRate;
    seasonalMultiplier = paramsOrBaseRate.seasonalMultiplier ?? 1.0;
    weekendMultiplier = paramsOrBaseRate.weekendMultiplier ?? 1.0;
    extraAdults = paramsOrBaseRate.extraAdults ?? 0;
    extraChildren = paramsOrBaseRate.extraChildren ?? 0;
    extraAdultRatePerNight = paramsOrBaseRate.extraAdultRatePerNight ?? 0;
    extraChildRatePerNight = paramsOrBaseRate.extraChildRatePerNight ?? 0;
    isWeekend = paramsOrBaseRate.isWeekend ?? false;
  }

  const activeWeekendMultiplier = isWeekend ? weekendMultiplier : 1.0;
  const roomBaseNightly = roundCurrency(
    basePlanRate * seasonalMultiplier * activeWeekendMultiplier,
  );
  const extraAdultCharges = roundCurrency(extraAdults * extraAdultRatePerNight);
  const extraChildCharges = roundCurrency(extraChildren * extraChildRatePerNight);
  const totalDailyRate = roundCurrency(
    roomBaseNightly + extraAdultCharges + extraChildCharges,
  );

  return {
    roomBaseNightly,
    extraAdultCharges,
    extraChildCharges,
    totalDailyRate,
  };
}

/**
 * Calculates extra guest charges over N nights
 */
export function calculateExtraGuestCharges(
  extraAdults: number,
  extraAdultRatePerNight: number,
  extraChildren: number,
  extraChildRatePerNight: number,
  nights: number,
): number {
  const adultTotal = extraAdults * extraAdultRatePerNight * nights;
  const childTotal = extraChildren * extraChildRatePerNight * nights;
  return roundCurrency(adultTotal + childTotal);
}

/**
 * Calculates meal plan charges over stay
 */
export function calculateMealPlanCharges(
  mealPlanRatePerPersonPerNight: number,
  guestCount: number,
  nights: number,
): number {
  return roundCurrency(mealPlanRatePerPersonPerNight * guestCount * nights);
}

/**
 * Calculates discount
 */
export function calculateDiscount(
  subtotal: number,
  discountPercent = 0,
  discountFlat = 0,
): number {
  let discount = 0;
  if (discountPercent > 0) {
    discount += (subtotal * discountPercent) / 100;
  }
  if (discountFlat > 0) {
    discount += discountFlat;
  }
  discount = Math.min(discount, subtotal);
  return roundCurrency(discount);
}

/**
 * Calculates taxable amount = subtotal - discount
 */
export function calculateTaxableAmount(subtotal: number, discount: number): number {
  return roundCurrency(Math.max(0, subtotal - discount));
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Complete Booking Rate Calculation Engine
 * Generates nightly breakdowns and full monetary totals
 */
export function calculateBookingSubtotal(input: RateCalculationInput): RateCalculationResult {
  const inDate = parseISODate(input.checkInDate);
  const outDate = parseISODate(input.checkOutDate);

  const seasonalMultiplier = input.seasonalMultiplier ?? 1.0;
  const weekendMultiplier = input.weekendMultiplier ?? 1.15;
  const extraAdults = Math.max(0, input.extraAdults ?? 0);
  const extraChildren = Math.max(0, input.extraChildren ?? 0);
  const extraAdultRatePerNight = input.extraAdultRatePerNight ?? 0;
  const extraChildRatePerNight = input.extraChildRatePerNight ?? 0;
  const defaultMealRates: Record<string, number> = {
    EP: 0,
    CP: 500,
    MAP: 1200,
    AP: 1800,
  };
  const mealPlanRate = input.mealPlanRatePerPersonPerNight !== undefined
    ? input.mealPlanRatePerPersonPerNight
    : (input.mealPlan ? (defaultMealRates[input.mealPlan] ?? 0) : 0);
  const totalGuests = (input.adultCount ?? 1) + (input.childCount ?? 0);

  const nights: NightlyRateBreakdown[] = [];
  const current = new Date(inDate.getTime());

  let totalRoomBase = 0;
  let totalExtraGuest = 0;
  let totalMealPlan = 0;

  while (current.getTime() < outDate.getTime()) {
    const isWknd = isWeekendNight(current);
    const dayOfWeek = DAY_NAMES[current.getUTCDay()]!;
    const dateStr = formatDateToISO(current);

    const daily = calculateEffectiveDailyRate({
      basePlanRate: input.basePlanRate,
      seasonalMultiplier,
      weekendMultiplier,
      extraAdults,
      extraChildren,
      extraAdultRatePerNight,
      extraChildRatePerNight,
      isWeekend: isWknd,
    });

    const nightlyMealCharges = roundCurrency(mealPlanRate * totalGuests);

    totalRoomBase += daily.roomBaseNightly;
    totalExtraGuest += daily.extraAdultCharges + daily.extraChildCharges;
    totalMealPlan += nightlyMealCharges;

    nights.push({
      date: dateStr,
      dayOfWeek,
      isWeekend: isWknd,
      basePlanRate: input.basePlanRate,
      seasonalMultiplier,
      weekendMultiplier: isWknd ? weekendMultiplier : 1.0,
      roomBaseNightly: daily.roomBaseNightly,
      extraAdultCharges: daily.extraAdultCharges,
      extraChildCharges: daily.extraChildCharges,
      mealPlanCharges: nightlyMealCharges,
      discountPerNight: 0,
      effectiveNightlyRate: roundCurrency(daily.totalDailyRate + nightlyMealCharges),
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Handle case where checkIn == checkOut (minimum 1 night)
  if (nights.length === 0) {
    const isWknd = isWeekendNight(inDate);
    const daily = calculateEffectiveDailyRate({
      basePlanRate: input.basePlanRate,
      seasonalMultiplier,
      weekendMultiplier,
      extraAdults,
      extraChildren,
      extraAdultRatePerNight,
      extraChildRatePerNight,
      isWeekend: isWknd,
    });
    const nightlyMealCharges = roundCurrency(mealPlanRate * totalGuests);
    totalRoomBase += daily.roomBaseNightly;
    totalExtraGuest += daily.extraAdultCharges + daily.extraChildCharges;
    totalMealPlan += nightlyMealCharges;
    nights.push({
      date: formatDateToISO(inDate),
      dayOfWeek: DAY_NAMES[inDate.getUTCDay()]!,
      isWeekend: isWknd,
      basePlanRate: input.basePlanRate,
      seasonalMultiplier,
      weekendMultiplier: isWknd ? weekendMultiplier : 1.0,
      roomBaseNightly: daily.roomBaseNightly,
      extraAdultCharges: daily.extraAdultCharges,
      extraChildCharges: daily.extraChildCharges,
      mealPlanCharges: nightlyMealCharges,
      discountPerNight: 0,
      effectiveNightlyRate: roundCurrency(daily.totalDailyRate + nightlyMealCharges),
    });
  }

  const roomSubtotal = roundCurrency(totalRoomBase);
  const extraGuestCharges = roundCurrency(totalExtraGuest);
  const mealPlanCharges = roundCurrency(totalMealPlan);

  const rawSubtotal = roundCurrency(roomSubtotal + extraGuestCharges + mealPlanCharges);
  const flatDiscount = input.discountFlat ?? input.discount ?? 0;
  const totalDiscount = calculateDiscount(
    rawSubtotal,
    input.discountPercent ?? 0,
    flatDiscount,
  );
  const taxableAmount = calculateTaxableAmount(rawSubtotal, totalDiscount);

  // Distribute discount proportionally across nights for transparent audit
  const discountPerNight = roundCurrency(totalDiscount / nights.length);
  nights.forEach((n) => {
    n.discountPerNight = discountPerNight;
    n.effectiveNightlyRate = roundCurrency(Math.max(0, n.effectiveNightlyRate - discountPerNight));
  });

  return {
    nights,
    totalNights: nights.length,
    roomSubtotal,
    extraGuestCharges,
    mealPlanCharges,
    totalDiscount,
    discount: totalDiscount,
    taxableAmount,
  };
}
