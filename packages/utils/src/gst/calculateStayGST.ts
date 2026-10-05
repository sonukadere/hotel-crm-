import type { GSTBreakdown, NightlyGSTSlab } from "@hotel/types";
import { roundCurrency } from "../formatters";
import { calculateRoomGST } from "./calculateRoomGST";

/**
 * Aggregates room GST across a stay.
 *
 * Under Indian GST rules accommodation (SAC 996311) is classified on the tariff
 * of a *unit of accommodation per day*, and the 12% / 18% slabs must be applied
 * night by night rather than to the stay total. A 3-night stay that crosses from
 * ₹7,000 to ₹8,000 nightly therefore splits across both slabs.
 *
 * Nightly tariffs of ₹1,000 or below attract the 0% budget exemption.
 */
export function calculateStayGST(params: {
  nightlyTariffs: Array<number | { tariff: number; date?: string }>;
  hotelStateCode: string;
  guestStateCode?: string;
  placeOfSupply?: string;
}): { breakdown: GSTBreakdown; slabs: NightlyGSTSlab[] } {
  const tariffs = params.nightlyTariffs.map((entry) =>
    typeof entry === "number" ? entry : entry.tariff,
  );

  const nights = tariffs.length > 0 ? tariffs : [0];
  const results = nights.map((tariff) =>
    calculateRoomGST({
      tariffPerNightOrTotal: tariff,
      hotelStateCode: params.hotelStateCode,
      guestStateCode: params.guestStateCode,
      placeOfSupply: params.placeOfSupply,
    }),
  );

  const slabs: NightlyGSTSlab[] = [];
  for (const result of results) {
    const existing = slabs.find((slab) => slab.gstRate === result.gstRate);
    if (existing) {
      existing.nightCount += 1;
      existing.taxableAmount = roundCurrency(existing.taxableAmount + result.taxableAmount);
      existing.cgstAmount = roundCurrency(existing.cgstAmount + result.cgstAmount);
      existing.sgstAmount = roundCurrency(existing.sgstAmount + result.sgstAmount);
      existing.igstAmount = roundCurrency(existing.igstAmount + result.igstAmount);
      existing.totalTax = roundCurrency(existing.totalTax + result.totalTax);
    } else {
      slabs.push({
        gstRate: result.gstRate,
        nightCount: 1,
        taxableAmount: result.taxableAmount,
        cgstRate: result.cgstRate,
        cgstAmount: result.cgstAmount,
        sgstRate: result.sgstRate,
        sgstAmount: result.sgstAmount,
        igstRate: result.igstRate,
        igstAmount: result.igstAmount,
        totalTax: result.totalTax,
      });
    }
  }

  const taxableAmount = roundCurrency(
    slabs.reduce((sum, slab) => sum + slab.taxableAmount, 0),
  );
  const cgstAmount = roundCurrency(slabs.reduce((sum, slab) => sum + slab.cgstAmount, 0));
  const sgstAmount = roundCurrency(slabs.reduce((sum, slab) => sum + slab.sgstAmount, 0));
  const igstAmount = roundCurrency(slabs.reduce((sum, slab) => sum + slab.igstAmount, 0));
  const totalTax = roundCurrency(cgstAmount + sgstAmount + igstAmount);

  // Rates on the aggregate mirror the dominant slab. A single-slab stay reports
  // its exact rate; a split stay reports the highest slab and carries the full
  // per-slab split in `slabs` so nothing is hidden from the invoice.
  const primary = results[0]!;
  const isInterState = primary.isInterState;
  const dominantRate = slabs.reduce((max, slab) => Math.max(max, slab.gstRate), 0);

  const breakdown: GSTBreakdown = {
    taxableAmount,
    gstRate: dominantRate,
    cgstRate: isInterState ? 0 : dominantRate / 2,
    sgstRate: isInterState ? 0 : dominantRate / 2,
    igstRate: isInterState ? dominantRate : 0,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    grandTotal: roundCurrency(taxableAmount + totalTax),
    totalWithTax: roundCurrency(taxableAmount + totalTax),
    sacCode: primary.sacCode,
    isInterState,
    placeOfSupply: primary.placeOfSupply,
  };

  return { breakdown, slabs };
}
