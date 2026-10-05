import type { FrontDeskPaymentStatus } from "@hotel/types";
import { roundCurrency } from "../formatters";

export interface PaymentStatusInput {
  grandTotal: number;
  paidAmount: number;
  bookingStatus?: string;
}

/**
 * Derives the front-desk payment badge for a stay.
 * A cancelled stay holding collected money is shown as Refunded so front desk
 * never mistakes a refundable advance for revenue.
 */
export function derivePaymentStatus(input: PaymentStatusInput): FrontDeskPaymentStatus {
  const total = roundCurrency(input.grandTotal || 0);
  const paid = roundCurrency(input.paidAmount || 0);

  if (input.bookingStatus === "Cancelled") {
    return paid > 0 ? "Refunded" : "Unpaid";
  }

  if (total <= 0) return paid > 0 ? "Paid" : "Unpaid";
  if (paid <= 0.01) return "Unpaid";
  if (paid >= total - 0.01) return "Paid";
  return "Partially Paid";
}

export const FRONT_DESK_PAYMENT_STATUS_VARIANT: Record<
  FrontDeskPaymentStatus,
  string
> = {
  Unpaid: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  "Partially Paid": "text-amber-300 bg-amber-500/10 border-amber-500/30",
  Paid: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  Refunded: "text-sky-300 bg-sky-500/10 border-sky-500/30",
};
