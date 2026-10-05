import type {
  CheckoutGstLine,
  CheckoutPaymentLine,
  CheckoutSummary,
  FolioItem,
  Payment,
} from "@hotel/types";
import { calculateFolioBalance } from "../folio/calculateFolioBalance";
import { roundCurrency, numberToIndianWords } from "../formatters";
import { derivePaymentStatus } from "./paymentStatus";

export interface CheckoutSummaryInput {
  booking: {
    id: string;
    bookingNumber: string;
    checkInDate: string;
    checkOutDate: string;
    actualCheckIn?: string | null;
    actualCheckOut?: string | null;
    totalNights: number;
    grandTotal: number;
    paidAmount: number;
  };
  guest: { fullName: string; mobile: string };
  folio: {
    id: string;
    folioNumber: string;
    status: string;
    items: FolioItem[];
    payments: Payment[];
    gstTransactions?: Array<{
      taxableAmount: number;
      cgstRate: number;
      cgstAmount: number;
      sgstRate: number;
      sgstAmount: number;
      igstRate: number;
      igstAmount: number;
      totalTax: number;
      sacCode: string;
      placeOfSupply: string;
    }>;
  };
  room?: { id: string; roomNumber: string } | null;
}

/**
 * Builds the settlement sheet shown at check-out:
 * room charges, service charges, GST, payments, deposit held and balance due.
 *
 * `serviceCharges` is the sum of every non-room, non-discount folio line that is
 * still live (F&B, laundry, spa, minibar, ...), so it reflects what was actually
 * consumed rather than an assumed percentage.
 */
export function buildCheckoutSummary(input: CheckoutSummaryInput): CheckoutSummary {
  const { items, payments, gstTransactions } = input.folio;
  const balance = calculateFolioBalance(items, payments);

  const roomCharges = roundCurrency(balance.roomChargesDebit);
  const serviceCharges = roundCurrency(balance.serviceChargesDebit);

  const discountAmount = roundCurrency(
    items
      .filter((i) => !i.isVoided && i.itemType === "Discount")
      .reduce((sum, i) => sum + Math.abs(Number(i.totalPrice)), 0),
  );

  const advanceDeposit = roundCurrency(
    payments
      .filter(
        (p) =>
          p.status === "Captured" &&
          (p.notes || "").toLowerCase().includes("advance"),
      )
      .reduce((sum, p) => sum + Number(p.amount), 0),
  );

  const paymentLines: CheckoutPaymentLine[] = payments.map((p) => ({
    paymentId: p.id,
    paymentNumber: p.paymentNumber,
    method: p.method,
    status: p.status,
    amount: Number(p.amount),
    receivedAt: p.receivedAt,
    panNumber: p.panNumber,
    notes: p.notes,
  }));

  const hasGstLedger = Boolean(gstTransactions && gstTransactions.length > 0);

  const gstSource: Array<{
    taxableAmount: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    totalTax: number;
    sacCode: string;
    placeOfSupply: string;
    description: string;
  }> = hasGstLedger
    ? (gstTransactions as NonNullable<CheckoutSummaryInput["folio"]["gstTransactions"]>).map(
        (gst) => ({
          taxableAmount: Number(gst.taxableAmount),
          cgstRate: Number(gst.cgstRate),
          cgstAmount: Number(gst.cgstAmount),
          sgstRate: Number(gst.sgstRate),
          sgstAmount: Number(gst.sgstAmount),
          igstRate: Number(gst.igstRate),
          igstAmount: Number(gst.igstAmount),
          totalTax: Number(gst.totalTax),
          sacCode: gst.sacCode,
          placeOfSupply: gst.placeOfSupply,
          description: `Taxable value @ SAC ${gst.sacCode}`,
        }),
      )
    : items
        .filter((i) => !i.isVoided)
        .map((i) => {
          const tax = Number(i.gstAmount) || 0;
          const rate = Number(i.gstRate) || 0;
          return {
            taxableAmount: Number(i.totalPrice),
            cgstRate: rate / 2,
            cgstAmount: rate > 0 ? roundCurrency(tax / 2) : 0,
            sgstRate: rate / 2,
            sgstAmount: rate > 0 ? roundCurrency(tax / 2) : 0,
            igstRate: 0,
            igstAmount: 0,
            totalTax: tax,
            sacCode: i.sacCode,
            placeOfSupply: "",
            description: i.description,
          };
        });

  const gstLines: CheckoutGstLine[] = gstSource.map((line) => ({
    sacCode: line.sacCode,
    description: line.description,
    taxableAmount: roundCurrency(line.taxableAmount),
    gstRate: roundCurrency(Math.max(line.cgstRate, line.sgstRate, line.igstRate) * 2),
    cgstAmount: roundCurrency(line.cgstAmount),
    sgstAmount: roundCurrency(line.sgstAmount),
    igstAmount: roundCurrency(line.igstAmount),
    totalTax: roundCurrency(line.totalTax),
    placeOfSupply: line.placeOfSupply,
  }));

  return {
    bookingId: input.booking.id,
    bookingNumber: input.booking.bookingNumber,
    folioId: input.folio.id,
    folioNumber: input.folio.folioNumber,
    folioStatus: input.folio.status,
    guestName: input.guest.fullName,
    mobile: input.guest.mobile,
    roomId: input.room?.id,
    roomNumber: input.room?.roomNumber,
    checkInDate: input.booking.checkInDate,
    checkOutDate: input.booking.checkOutDate,
    actualCheckIn: input.booking.actualCheckIn ?? undefined,
    actualCheckOut: input.booking.actualCheckOut ?? undefined,
    totalNights: input.booking.totalNights,
    roomCharges,
    serviceCharges,
    discountAmount,
    taxableAmount: roundCurrency(
      items
        .filter((i) => !i.isVoided)
        .reduce((sum, i) => sum + Number(i.totalPrice), 0),
    ),
    taxAmount: balance.totalTax,
    totalDebit: balance.totalDebit,
    totalCredit: balance.totalCredit,
    advanceDeposit,
    balanceDue: balance.balanceDue,
    isSettled: balance.isSettled,
    paymentStatus: derivePaymentStatus({
      grandTotal: balance.totalDebit,
      paidAmount: balance.totalCredit,
    }),
    amountInWords: numberToIndianWords(Math.max(0, balance.balanceDue)),
    gstLines,
    payments: paymentLines,
  };
}
