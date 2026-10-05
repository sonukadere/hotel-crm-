import { GSTBreakdown } from "@hotel/types";
import { GST_CONFIG, SAC_CODES } from "./gstConstants";
import { roundCurrency } from "../formatters";

export interface CalculateServiceGSTParams {
  amount: number;
  serviceType: "food" | "laundry" | "banquet" | "spa" | "other";
  hotelStateCode: string;
  guestStateCode?: string;
  placeOfSupply?: string;
  customRate?: number;
  customSacCode?: string;
}

/**
 * Calculates GST for hospitality non-room services:
 * - Restaurant & Dining (SAC 996331) -> 5%
 * - Laundry & Housekeeping (SAC 999799) -> 18%
 * - Banquet & Event Spaces (SAC 997212) -> 18%
 * - Spa & Wellness (SAC 999721) -> 18%
 */
export function calculateServiceGST({
  amount,
  serviceType,
  hotelStateCode,
  guestStateCode,
  placeOfSupply,
  customRate,
  customSacCode,
}: CalculateServiceGSTParams): GSTBreakdown {
  const taxableAmount = roundCurrency(amount);

  let gstRate = customRate ?? GST_CONFIG.SERVICES_STANDARD_RATE;
  let sacCode = customSacCode ?? SAC_CODES.LAUNDRY_HOUSEKEEPING;

  switch (serviceType) {
    case "food":
      gstRate = customRate ?? GST_CONFIG.FOOD_RESTAURANT_RATE;
      sacCode = customSacCode ?? SAC_CODES.RESTAURANT_DINING;
      break;
    case "laundry":
      gstRate = customRate ?? GST_CONFIG.SERVICES_STANDARD_RATE;
      sacCode = customSacCode ?? SAC_CODES.LAUNDRY_HOUSEKEEPING;
      break;
    case "banquet":
      gstRate = customRate ?? GST_CONFIG.SERVICES_STANDARD_RATE;
      sacCode = customSacCode ?? SAC_CODES.BANQUET_EVENT_SPACES;
      break;
    case "spa":
      gstRate = customRate ?? GST_CONFIG.SERVICES_STANDARD_RATE;
      sacCode = customSacCode ?? SAC_CODES.SPA_WELLNESS;
      break;
    case "other":
    default:
      gstRate = customRate ?? GST_CONFIG.SERVICES_STANDARD_RATE;
      sacCode = customSacCode ?? SAC_CODES.BUSINESS_SERVICES;
      break;
  }

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
    sacCode,
    isInterState,
    placeOfSupply: pos,
  };
}
