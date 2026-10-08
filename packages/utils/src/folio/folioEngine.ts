import { FolioItem, Payment, FolioItemType } from "@hotel/types";
import { roundCurrency, numberToIndianWords } from "../formatters";

export interface FolioCalculationBreakdown {
  // Debit Components
  roomSubtotal: number;
  roomDiscount: number;
  discountedRoomSubtotal: number;
  totalRoomGST: number;

  totalServicesCharges: number;
  totalServicesGST: number;
  servicesBreakdownByCategory: Record<
    string,
    { taxable: number; gst: number; total: number; sacCode: string }
  >;

  totalDebit: number;

  // Credit Components
  advanceDeposit: number;
  razorpayPayments: number;
  cashCollected: number;
  loyaltyRedeemed: number;
  cardPayments: number;
  upiPayments: number;
  bankTransferPayments: number;
  otherPayments: number;
  totalRefunded: number;

  totalCredit: number;

  // Balance
  balanceDue: number;
  isSettled: boolean;
  amountInWords: string;

  // Split Billing Breakdown
  corporate: {
    debit: number;
    taxable: number;
    tax: number;
    credit: number;
    balanceDue: number;
  };
  personal: {
    debit: number;
    taxable: number;
    tax: number;
    credit: number;
    balanceDue: number;
  };
}

export const SAC_BY_ITEM_TYPE: Record<FolioItemType, string> = {
  Room: "996311",
  Food: "996331",
  Restaurant: "996331",
  InRoomDining: "996331",
  Laundry: "999799",
  Spa: "999722",
  Housekeeping: "999799",
  Banquet: "997212",
  OtherService: "999799",
  Discount: "996311",
};

export const DEFAULT_GST_RATE_BY_ITEM_TYPE: Record<FolioItemType, number> = {
  Room: 0.12, // 12% if <= 7500, 18% if > 7500
  Food: 0.05, // 5% standalone restaurant / in-room dining
  Restaurant: 0.05,
  InRoomDining: 0.05,
  Laundry: 0.18,
  Spa: 0.18,
  Housekeeping: 0.18,
  Banquet: 0.18,
  OtherService: 0.18,
  Discount: 0,
};

/**
 * Centralized Hotel Folio Calculation Engine
 * Implements Module 7 statutory calculation formula:
 *
 * totalDebit = discountedRoomSubtotal + totalRoomGST + totalServicesCharges + totalServicesGST
 * totalCredit = advanceDeposit + razorpayPayments + cashCollected + loyaltyRedeemed (+ other digital payments)
 * balanceDue = totalDebit - totalCredit
 */
export function calculateCentralizedFolio(
  items: FolioItem[],
  payments: Payment[],
): FolioCalculationBreakdown {
  let roomSubtotal = 0;
  let roomDiscount = 0;
  let totalRoomGST = 0;

  let totalServicesCharges = 0;
  let totalServicesGST = 0;

  const servicesBreakdownByCategory: Record<
    string,
    { taxable: number; gst: number; total: number; sacCode: string }
  > = {};

  let corporateTaxable = 0;
  let corporateTax = 0;
  let personalTaxable = 0;
  let personalTax = 0;

  let explicitCorporateCredit = 0;
  let explicitPersonalCredit = 0;
  let unallocatedCredit = 0;

  for (const item of items) {
    const isVoid = item.isVoided || (item as any).isVoid;
    if (isVoid) continue;

    const itemType = (item.itemType || (item as any).type) as FolioItemType;
    const lineTotal = Number(item.totalPrice ?? (item as any).amount) || 0;
    const lineGst =
      Number(
        item.gstAmount ??
          ((Number((item as any).cgst) || 0) +
            (Number((item as any).sgst) || 0) +
            (Number((item as any).igst) || 0)),
      ) || 0;
    const isCorporate = (item.splitTarget || (item as any).splitTarget) === "Corporate";

    if (itemType === "Room") {
      roomSubtotal += lineTotal;
      totalRoomGST += lineGst;
    } else if (itemType === "Discount") {
      roomDiscount += Math.abs(lineTotal);
      totalRoomGST -= Math.abs(lineGst);
    } else {
      totalServicesCharges += lineTotal;
      totalServicesGST += lineGst;

      const cat = itemType;
      if (!servicesBreakdownByCategory[cat]) {
        servicesBreakdownByCategory[cat] = {
          taxable: 0,
          gst: 0,
          total: 0,
          sacCode: item.sacCode || SAC_BY_ITEM_TYPE[cat] || "999799",
        };
      }
      servicesBreakdownByCategory[cat].taxable += lineTotal;
      servicesBreakdownByCategory[cat].gst += lineGst;
      servicesBreakdownByCategory[cat].total += lineTotal + lineGst;
    }

    if (isCorporate) {
      if (itemType === "Discount") {
        corporateTaxable -= Math.abs(lineTotal);
        corporateTax -= Math.abs(lineGst);
      } else {
        corporateTaxable += lineTotal;
        corporateTax += lineGst;
      }
    } else {
      if (itemType === "Discount") {
        personalTaxable -= Math.abs(lineTotal);
        personalTax -= Math.abs(lineGst);
      } else {
        personalTaxable += lineTotal;
        personalTax += lineGst;
      }
    }
  }

  const discountedRoomSubtotal = roundCurrency(Math.max(0, roomSubtotal - roomDiscount));
  const roundedRoomGST = roundCurrency(Math.max(0, totalRoomGST));
  const roundedServicesCharges = roundCurrency(totalServicesCharges);
  const roundedServicesGST = roundCurrency(totalServicesGST);

  // totalDebit = discountedRoomSubtotal + totalRoomGST + totalServicesCharges + totalServicesGST
  const totalDebit = roundCurrency(
    discountedRoomSubtotal + roundedRoomGST + roundedServicesCharges + roundedServicesGST,
  );

  // Credit calculation
  let advanceDeposit = 0;
  let razorpayPayments = 0;
  let cashCollected = 0;
  let loyaltyRedeemed = 0;
  let cardPayments = 0;
  let upiPayments = 0;
  let bankTransferPayments = 0;
  let otherPayments = 0;
  let totalRefunded = 0;

  for (const payment of payments) {
    const amt = Number(payment.amount) || 0;
    const isRefund = payment.status === "Refunded" || (payment as any).isRefunded;
    const refundAmt = Number((payment as any).refundedAmount) || (isRefund ? amt : 0);
    const notes = (payment.notes || "").toLowerCase();

    if (refundAmt > 0) {
      totalRefunded += refundAmt;
    }

    // Skip failed payments or fully refunded payments
    if (payment.status === "Failed" || (payment.status === "Refunded" && refundAmt >= amt)) {
      continue;
    }

    const netAmt = Math.max(0, amt - (payment.status !== "Refunded" ? refundAmt : 0));

    // Check advance vs operational
    const isAdvance =
      (payment as any).isAdvance ||
      notes.includes("advance") ||
      notes.includes("deposit") ||
      notes.includes("booking deposit");

    if (isAdvance) {
      advanceDeposit += netAmt;
    } else {
      if ((payment as any).isLoyaltyRedemption || notes.includes("loyalty")) {
        loyaltyRedeemed += netAmt;
      } else if (payment.method === "Razorpay" || (payment as any).razorpayPaymentId || (payment as any).razorpayOrderId) {
        razorpayPayments += netAmt;
      } else if (payment.method === "Cash") {
        cashCollected += netAmt;
      } else if (payment.method === "Card") {
        cardPayments += netAmt;
      } else if (payment.method === "UPI") {
        upiPayments += netAmt;
      } else if (payment.method === "Bank Transfer") {
        bankTransferPayments += netAmt;
      } else {
        otherPayments += netAmt;
      }
    }

    // Split attribution
    const paymentSplit = (payment as any).splitTarget;
    if (paymentSplit === "Corporate") {
      explicitCorporateCredit += netAmt;
    } else if (paymentSplit === "Personal") {
      explicitPersonalCredit += netAmt;
    } else {
      unallocatedCredit += netAmt;
    }
  }

  // Net captured credits
  const totalCredit = roundCurrency(
    advanceDeposit +
      razorpayPayments +
      cashCollected +
      loyaltyRedeemed +
      cardPayments +
      upiPayments +
      bankTransferPayments +
      otherPayments,
  );

  // balanceDue = totalDebit - totalCredit
  const balanceDue = roundCurrency(totalDebit - totalCredit);
  const isSettled = balanceDue <= 0.01;

  // Split Billing calculation
  const corporateDebit = roundCurrency(Math.max(0, corporateTaxable + corporateTax));
  const personalDebit = roundCurrency(Math.max(0, personalTaxable + personalTax));

  // Allocate payments
  const corporateCredit = roundCurrency(
    explicitCorporateCredit +
      Math.min(Math.max(0, corporateDebit - explicitCorporateCredit), unallocatedCredit),
  );
  const remainingUnallocated = Math.max(
    0,
    unallocatedCredit - (corporateCredit - explicitCorporateCredit),
  );
  const personalCredit = roundCurrency(explicitPersonalCredit + remainingUnallocated);

  const corporateBalanceDue = roundCurrency(Math.max(0, corporateDebit - corporateCredit));
  const personalBalanceDue = roundCurrency(Math.max(0, personalDebit - personalCredit));

  return {
    roomSubtotal: roundCurrency(roomSubtotal),
    roomDiscount: roundCurrency(roomDiscount),
    discountedRoomSubtotal,
    totalRoomGST: roundedRoomGST,
    totalServicesCharges: roundedServicesCharges,
    totalServicesGST: roundedServicesGST,
    servicesBreakdownByCategory,
    totalDebit,

    advanceDeposit: roundCurrency(advanceDeposit),
    razorpayPayments: roundCurrency(razorpayPayments),
    cashCollected: roundCurrency(cashCollected),
    loyaltyRedeemed: roundCurrency(loyaltyRedeemed),
    cardPayments: roundCurrency(cardPayments),
    upiPayments: roundCurrency(upiPayments),
    bankTransferPayments: roundCurrency(bankTransferPayments),
    otherPayments: roundCurrency(otherPayments),
    totalRefunded: roundCurrency(totalRefunded),
    totalCredit,

    balanceDue,
    isSettled,
    amountInWords: numberToIndianWords(Math.max(0, balanceDue)),

    corporate: {
      debit: corporateDebit,
      taxable: roundCurrency(Math.max(0, corporateTaxable)),
      tax: roundCurrency(Math.max(0, corporateTax)),
      credit: corporateCredit,
      balanceDue: corporateBalanceDue,
    },
    personal: {
      debit: personalDebit,
      taxable: roundCurrency(Math.max(0, personalTaxable)),
      tax: roundCurrency(Math.max(0, personalTax)),
      credit: personalCredit,
      balanceDue: personalBalanceDue,
    },
  };
}
