import React, { useState, useEffect } from "react";
import { Modal, Button, Input } from "@hotel/ui";
import { formatINR, isValidPAN, validateCashCompliance } from "@hotel/utils";
import type { CheckoutSummary, RoomStatus, PaymentMethod } from "@hotel/types";
import { getCheckoutSummaryApi, checkOutGuestApi } from "../../services/frontDeskApi";
import {
  CreditCard,
  AlertTriangle,
  Receipt,
  User,
  BedDouble,
  Calendar,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string | null;
  onSuccess: (msg: string) => void;
}

export function CheckOutModal({
  isOpen,
  onClose,
  bookingId,
  onSuccess,
}: CheckOutModalProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [fetchError, setFetchError] = useState("");

  // Settlement Form State
  const [settlementAmount, setSettlementAmount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [transactionRef, setTransactionRef] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [panError, setPanError] = useState("");
  const [cashWarning, setCashWarning] = useState("");
  const [postRoomStatus, setPostRoomStatus] = useState<RoomStatus>("Dirty");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (isOpen && bookingId) {
      loadSummary(bookingId);
    } else {
      setSummary(null);
      setFetchError("");
      setSubmitError("");
    }
  }, [isOpen, bookingId]);

  const loadSummary = async (id: string) => {
    setLoading(true);
    setFetchError("");
    try {
      const data = await getCheckoutSummaryApi(id);
      setSummary(data);
      const due = Math.max(0, data.balanceDue);
      setSettlementAmount(due > 0 ? String(due) : "0");
      setPostRoomStatus("Dirty");
    } catch (err: any) {
      setFetchError(err.message || "Failed to load check-out settlement sheet");
    } finally {
      setLoading(false);
    }
  };

  const handleSettlementAmountChange = (val: string) => {
    setSettlementAmount(val);
    const amt = parseFloat(val) || 0;
    if (paymentMethod === "Cash") {
      const compliance = validateCashCompliance(amt, panNumber);
      setCashWarning(compliance.isValid ? "" : compliance.errors.join(". "));
    } else {
      setCashWarning("");
    }
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
    const amt = parseFloat(settlementAmount) || 0;
    if (method === "Cash") {
      const compliance = validateCashCompliance(amt, panNumber);
      setCashWarning(compliance.isValid ? "" : compliance.errors.join(". "));
    } else {
      setCashWarning("");
    }
  };

  const handlePanChange = (pan: string) => {
    const upper = pan.toUpperCase();
    setPanNumber(upper);
    if (upper && !isValidPAN(upper)) {
      setPanError("Invalid PAN format (e.g., ABCDE1234F)");
    } else {
      setPanError("");
      if (paymentMethod === "Cash") {
        const amt = parseFloat(settlementAmount) || 0;
        const compliance = validateCashCompliance(amt, upper);
        setCashWarning(compliance.isValid ? "" : compliance.errors.join(". "));
      }
    }
  };

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !bookingId) return;

    const amt = parseFloat(settlementAmount) || 0;

    // Compliance verification
    if (paymentMethod === "Cash" && amt > 0) {
      const compliance = validateCashCompliance(amt, panNumber);
      if (!compliance.isValid) {
        setSubmitError(compliance.errors.join(". "));
        return;
      }
    }

    if (amt > 0 && (paymentMethod === "Card" || paymentMethod === "UPI" || paymentMethod === "Bank Transfer") && !transactionRef) {
      // Recommend ref
    }

    const remaining = summary.balanceDue - amt;
    if (remaining > 0.01) {
      const confirmUnderpaid = window.confirm(
        `Warning: An outstanding balance of ${formatINR(remaining)} remains. Proceed with checkout?`
      );
      if (!confirmUnderpaid) return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const settlement =
        amt > 0
          ? {
              amount: amt,
              method: paymentMethod,
              transactionRef: transactionRef || `Check-out ${paymentMethod}`,
              panNumber: panNumber || undefined,
            }
          : undefined;

      await checkOutGuestApi({
        bookingId,
        settlement,
        roomStatus: postRoomStatus,
      });

      onSuccess(
        `Guest ${summary.guestName} successfully checked out from Room ${summary.roomNumber || "—"}. Room marked as ${postRoomStatus}.`
      );
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Check-out operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guest Check-Out & Settlement"
      description="Review room charges, service add-ons, GST ledger, advance deposits, and settle final balance"
      maxWidth="lg"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Computing checkout settlement sheet & GST ledger...</p>
        </div>
      ) : fetchError ? (
        <div className="p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <p className="text-rose-400 text-sm font-semibold">{fetchError}</p>
          <Button variant="outline" size="sm" onClick={() => bookingId && loadSummary(bookingId)}>
            Try Again
          </Button>
        </div>
      ) : summary ? (
        <form onSubmit={handleCheckOut} className="space-y-4">
          {/* Guest & Room Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-400 flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-amber-400" /> Guest Name
              </p>
              <p className="text-white font-bold text-sm mt-0.5">{summary.guestName}</p>
              <p className="text-slate-500 font-mono text-[11px]">{summary.mobile}</p>
            </div>
            <div>
              <p className="text-slate-400 flex items-center gap-1 font-medium">
                <BedDouble className="w-3.5 h-3.5 text-amber-400" /> Room Assigned
              </p>
              <p className="text-white font-bold text-sm mt-0.5">Room {summary.roomNumber || "—"}</p>
              <p className="text-slate-500 text-[11px]">{summary.totalNights} Night(s) Stay</p>
            </div>
            <div>
              <p className="text-slate-400 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Duration
              </p>
              <p className="text-white font-semibold mt-0.5">{summary.checkInDate}</p>
              <p className="text-slate-400 text-[11px]">to {summary.checkOutDate}</p>
            </div>
            <div>
              <p className="text-slate-400 flex items-center gap-1 font-medium">
                <Receipt className="w-3.5 h-3.5 text-amber-400" /> Folio Number
              </p>
              <p className="text-amber-400 font-mono font-bold mt-0.5">{summary.folioNumber}</p>
              <p className="text-slate-500 text-[11px]">Booking #{summary.bookingNumber}</p>
            </div>
          </div>

          {/* Detailed Financial Calculation Grid */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-4 h-4" /> Comprehensive Folio Breakdown
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Room Charges (SAC 996311)</span>
                <span className="font-semibold text-white">{formatINR(summary.roomCharges)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Service Charges (F&B SAC 996331, Laundry SAC 999799)</span>
                <span className="font-semibold text-white">{formatINR(summary.serviceCharges)}</span>
              </div>

              {summary.discountAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-400">
                  <span>Less: Promotional Discounts & Credits</span>
                  <span className="font-semibold">- {formatINR(summary.discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
                <span>Taxable Amount</span>
                <span className="font-semibold text-slate-200">{formatINR(summary.taxableAmount)}</span>
              </div>

              {/* GST breakdown items */}
              {summary.gstLines && summary.gstLines.length > 0 ? (
                summary.gstLines.map((gst, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] text-slate-400 pl-3">
                    <span>
                      GST @ {gst.gstRate}% (SAC {gst.sacCode})
                      {gst.cgstAmount > 0 ? ` [CGST: ${formatINR(gst.cgstAmount)} + SGST: ${formatINR(gst.sgstAmount)}]` : ` [IGST: ${formatINR(gst.igstAmount)}]`}
                    </span>
                    <span className="font-mono text-slate-300">{formatINR(gst.totalTax)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between items-center text-slate-300">
                  <span>Total GST</span>
                  <span className="font-semibold text-white">{formatINR(summary.taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold text-white pt-2 border-t border-slate-800">
                <span>Total Gross Bill (Debits)</span>
                <span className="text-amber-300 font-mono text-sm">{formatINR(summary.totalDebit)}</span>
              </div>

              {/* Payments & Deposits */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                {summary.advanceDeposit > 0 && (
                  <div className="flex justify-between items-center text-emerald-400 text-xs">
                    <span>Less: Advance Deposit Held</span>
                    <span className="font-semibold font-mono">- {formatINR(summary.advanceDeposit)}</span>
                  </div>
                )}
                {summary.totalCredit - summary.advanceDeposit > 0 && (
                  <div className="flex justify-between items-center text-emerald-400 text-xs">
                    <span>Less: Mid-Stay Payments Captured</span>
                    <span className="font-semibold font-mono">
                      - {formatINR(summary.totalCredit - summary.advanceDeposit)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                  <span>Total Credits Received</span>
                  <span className="text-emerald-400 font-mono">{formatINR(summary.totalCredit)}</span>
                </div>
              </div>

              {/* Net Balance Due Banner */}
              <div className={`p-3 rounded-lg flex items-center justify-between mt-2 ${
                summary.balanceDue <= 0
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              }`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    {summary.balanceDue <= 0 ? "Folio Fully Settled" : "Net Balance Due"}
                  </span>
                  {summary.amountInWords && summary.balanceDue > 0 && (
                    <span className="text-[10px] text-slate-400 block mt-0.5 italic">
                      {summary.amountInWords}
                    </span>
                  )}
                </div>
                <span className="text-xl font-black font-mono">
                  {formatINR(Math.max(0, summary.balanceDue))}
                </span>
              </div>
            </div>
          </div>

          {/* Final Settlement Collection Box (if balance due > 0 or custom payment) */}
          {summary.balanceDue > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-400" /> Settle Balance at Check-Out
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Settlement Amount (INR) *"
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => handleSettlementAmountChange(e.target.value)}
                  required
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value as PaymentMethod)}
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="UPI">UPI (QR Code / VPA)</option>
                    <option value="Card">Card (Credit / Debit POS)</option>
                    <option value="Cash">Cash (Physical Currency)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                    <option value="Razorpay">Razorpay / Online Gateway</option>
                    <option value="Other">Other Mode</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Transaction Ref / Auth Code"
                  placeholder="e.g. UPI/123456789012 or POS-AUTH-981"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                />

                {paymentMethod === "Cash" && (
                  <Input
                    label="PAN Number (Mandatory if Cash >= ₹50,000)"
                    placeholder="ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => handlePanChange(e.target.value)}
                    error={panError}
                    helperText="Section 269ST / Rule 114B Income Tax Safeguard"
                  />
                )}
              </div>

              {cashWarning && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{cashWarning}</span>
                </div>
              )}
            </div>
          )}

          {/* Housekeeping Release State Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white">Post-Checkout Room Status</p>
              <p className="text-[11px] text-slate-400">
                Mark room as Dirty for housekeeping or Clean if room was un-touched
              </p>
            </div>
            <select
              value={postRoomStatus}
              onChange={(e) => setPostRoomStatus(e.target.value as RoomStatus)}
              className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 h-9"
            >
              <option value="Dirty">Dirty (Standard Housekeeping Protocol)</option>
              <option value="Clean">Clean (Skip Housekeeping Inspection)</option>
              <option value="Maintenance">Maintenance (Inspect before re-release)</option>
            </select>
          </div>

          {submitError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing Check-Out...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Confirm Check-Out & Release Room
                </span>
              )}
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
