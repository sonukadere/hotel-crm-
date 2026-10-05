import { FolioItem, Payment } from "@hotel/types";
import { roundCurrency } from "../formatters";

export interface FolioBalanceResult {
  totalDebit: number;
  totalCredit: number;
  balanceDue: number;
  totalTax: number;
  roomChargesDebit: number;
  serviceChargesDebit: number;
  isSettled: boolean;
}

/**
 * Calculates current debit, credit, and balance due for a Hotel Guest Folio
 * Only active, non-voided items and successful payments are counted.
 */
export function calculateFolioBalance(
  items: FolioItem[],
  payments: Payment[],
): FolioBalanceResult {
  let roomChargesDebit = 0;
  let serviceChargesDebit = 0;
  let totalTax = 0;

  for (const item of items) {
    if (item.isVoided) continue;

    const lineTotal = item.totalPrice;
    const lineTax = item.gstAmount || 0;
    totalTax += lineTax;

    if (item.itemType === "Room") {
      roomChargesDebit += lineTotal;
    } else if (item.itemType === "Discount") {
      roomChargesDebit -= Math.abs(lineTotal);
    } else {
      serviceChargesDebit += lineTotal;
    }
  }

  const totalDebit = roundCurrency(roomChargesDebit + serviceChargesDebit + totalTax);

  let totalCredit = 0;
  for (const payment of payments) {
    if (payment.status === "Captured") {
      totalCredit += payment.amount;
    } else if (payment.status === "Refunded") {
      totalCredit -= payment.amount;
    } else if (payment.status === "PartiallyRefunded") {
      // Partial refunds are handled via separate refund ledger entries or reduced captured amounts
      totalCredit += payment.amount;
    }
  }

  totalCredit = roundCurrency(totalCredit);
  const balanceDue = roundCurrency(totalDebit - totalCredit);

  return {
    totalDebit,
    totalCredit,
    balanceDue,
    totalTax: roundCurrency(totalTax),
    roomChargesDebit: roundCurrency(roomChargesDebit),
    serviceChargesDebit: roundCurrency(serviceChargesDebit),
    isSettled: balanceDue <= 0.01,
  };
}
