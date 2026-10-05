import { GSTBreakdown } from "@hotel/types";
import { GST_CONFIG, SAC_CODES, GSTConfigOverride } from "./gstConstants";
import { roundCurrency } from "../formatters";

export interface CalculateRoomGSTParams {
  tariffPerNightOrTotal: number;
  hotelStateCode: string;
  guestStateCode?: string;
  placeOfSupply?: string;
  overrides?: GSTConfigOverride;
}

/**
 * Calculates Indian Room GST based on per-day tariff:
 * - <= ₹1,000 => 0% (budget exemption if enabled)
 * - <= ₹7,500 => 12% (6% CGST + 6% SGST, or 12% IGST)
 * - > ₹7,500 => 18% (9% CGST + 9% SGST, or 18% IGST)
 *
 * Supports both direct 3-argument signature and options object.
 */
export function calculateRoomGST(
  paramsOrTariff: CalculateRoomGSTParams | number,
  maybeHotelState?: string,
  maybeGuestState?: string,
): GSTBreakdown {
  let tariffPerNight: number;
  let hotelStateCode: string;
  let guestStateCode: string | undefined;
  let placeOfSupply: string | undefined;
  let overrides: GSTConfigOverride | undefined;

  if (typeof paramsOrTariff === "number") {
    tariffPerNight = paramsOrTariff;
    hotelStateCode = maybeHotelState || "27";
    guestStateCode = maybeGuestState || hotelStateCode;
  } else {
    tariffPerNight = paramsOrTariff.tariffPerNightOrTotal;
    hotelStateCode = paramsOrTariff.hotelStateCode;
    guestStateCode = paramsOrTariff.guestStateCode;
    placeOfSupply = paramsOrTariff.placeOfSupply;
    overrides = paramsOrTariff.overrides;
  }

  const taxableAmount = roundCurrency(tariffPerNight);

  const threshold = overrides?.thresholdINR ?? GST_CONFIG.ROOM_THRESHOLD_INR;
  const rateBelow = overrides?.rateBelowThreshold ?? GST_CONFIG.ROOM_RATE_BELOW_OR_EQUAL_THRESHOLD;
  const rateAbove = overrides?.rateAboveThreshold ?? GST_CONFIG.ROOM_RATE_ABOVE_THRESHOLD;

  // Determine rate based on tariff slab (Page 2 PRD logic)
  let gstRate = rateBelow;
  if (taxableAmount > threshold) {
    gstRate = rateAbove; // 18% luxury slab
  } else if (taxableAmount <= 1000) {
    gstRate = 0.00; // 0% budget exemption
  }

  // Determine place of supply and intra-state vs inter-state
  const hState = hotelStateCode.trim().padStart(2, "0");
  const pos = (placeOfSupply || guestStateCode || hState).trim().padStart(2, "0");
  const isInterState = hState !== pos;

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = gstRate;
    igstAmount = roundCurrency(taxableAmount * igstRate);
  } else {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = roundCurrency(taxableAmount * cgstRate);
    sgstAmount = roundCurrency(taxableAmount * sgstRate);
  }

  const totalTax = roundCurrency(cgstAmount + sgstAmount + igstAmount);
  const grandTotal = roundCurrency(taxableAmount + totalTax);

  return {
    taxableAmount,
    gstRate,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    grandTotal,
    totalWithTax: grandTotal,
    sacCode: SAC_CODES.ROOM_ACCOMMODATION,
    isInterState,
    placeOfSupply: pos,
  };
}
