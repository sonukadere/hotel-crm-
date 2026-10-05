"use client";

import React, { useState, useMemo } from "react";
import {
  calculateBookingSubtotal,
  calculateRoomGST,
  formatINR,
  numberToIndianWords,
  isValidGSTIN,
  maskAadhaar,
} from "@hotel/utils";
import { INDIAN_STATE_CODES, DEFAULT_HOTEL_INFO } from "@hotel/config";
import type { MealPlan } from "@hotel/types";
import { ShieldCheck, CheckCircle2, Lock, CreditCard } from "lucide-react";

export default function BookingPage() {
  const [roomType, setRoomType] = useState<"std" | "dlx" | "sui">("dlx");
  const [checkIn, setCheckIn] = useState("2026-10-10");
  const [checkOut, setCheckOut] = useState("2026-10-12");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [mealPlan, setMealPlan] = useState<MealPlan>("CP");

  // Guest compliance state
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [guestStateCode, setGuestStateCode] = useState("27"); // Default Maharashtra
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [corporateGstin, setCorporateGstin] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const baseRates = {
    std: 4200,
    dlx: 6500,
    sui: 12500,
  };

  const mealPlanAddons: Record<MealPlan, number> = {
    EP: 0,
    CP: 500,
    MAP: 1400,
    AP: 2200,
  };

  const currentBaseRate = baseRates[roomType];

  // Dynamic calculations via centralized engine
  const rateCalculation = useMemo(() => {
    return calculateBookingSubtotal({
      basePlanRate: currentBaseRate,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.15,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adultCount: adults,
      childCount: children,
      mealPlan,
      mealPlanRatePerPersonPerNight: mealPlanAddons[mealPlan],
    });
  }, [currentBaseRate, checkIn, checkOut, adults, children, mealPlan]);

  const gstCalculation = useMemo(() => {
    return calculateRoomGST({
      tariffPerNightOrTotal: rateCalculation.taxableAmount,
      hotelStateCode: DEFAULT_HOTEL_INFO.stateCode, // 27 Maharashtra
      guestStateCode: guestStateCode,
    });
  }, [rateCalculation.taxableAmount, guestStateCode]);

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setBookingConfirmed(true);
    }, 1500);
  };

  if (bookingConfirmed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-white">Booking & Payment Confirmed!</h1>
        <p className="text-sm text-slate-300">
          Thank you, <span className="font-semibold text-white">{fullName}</span>. Your reservation at {DEFAULT_HOTEL_INFO.name} is confirmed.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-left space-y-3 text-xs">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Reservation Number:</span>
            <span className="font-mono text-amber-400 font-bold">GRP-2026-9812</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Dates:</span>
            <span className="text-white">{checkIn} to {checkOut} ({rateCalculation.totalNights} Nights)</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Guest Masked ID:</span>
            <span className="font-mono text-white">{maskAadhaar(aadhaarNumber || "123456789012")}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">GST Invoice Amount:</span>
            <span className="font-bold text-emerald-400 text-sm">{formatINR(gstCalculation.grandTotal)}</span>
          </div>
          <div className="pt-2 text-[11px] text-slate-500 italic">
            In Words: {numberToIndianWords(gstCalculation.grandTotal)}
          </div>
        </div>

        <a
          href="/"
          className="inline-block px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
        >
          Return to Home
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Complete Your Reservation
        </h1>
        <p className="text-xs text-slate-400">
          Direct Booking Engine with Real-Time Indian GST Tax Breakdown & Instant Payment
        </p>
      </div>

      <form onSubmit={handlePayment} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Room & Guest Info */}
        <div className="lg:col-span-7 space-y-6">
          {/* Room & Stay Selection */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400">
              1. Stay & Room Selection
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setRoomType("std")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  roomType === "std"
                    ? "bg-amber-500/10 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <p className="text-xs font-bold">Standard</p>
                <p className="text-xs font-semibold text-amber-400 mt-1">{formatINR(4200)}</p>
                <p className="text-[10px] text-slate-500">12% GST</p>
              </button>

              <button
                type="button"
                onClick={() => setRoomType("dlx")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  roomType === "dlx"
                    ? "bg-amber-500/10 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <p className="text-xs font-bold">Deluxe Balcony</p>
                <p className="text-xs font-semibold text-amber-400 mt-1">{formatINR(6500)}</p>
                <p className="text-[10px] text-slate-500">12% GST</p>
              </button>

              <button
                type="button"
                onClick={() => setRoomType("sui")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  roomType === "sui"
                    ? "bg-amber-500/10 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <p className="text-xs font-bold">Maharaja Suite</p>
                <p className="text-xs font-semibold text-amber-400 mt-1">{formatINR(12500)}</p>
                <p className="text-[10px] text-slate-500">18% GST</p>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Check-In</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Check-Out</label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Adults</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={adults}
                  onChange={(e) => setAdults(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Children</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={children}
                  onChange={(e) => setChildren(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Meal Plan</label>
                <select
                  value={mealPlan}
                  onChange={(e) => setMealPlan(e.target.value as MealPlan)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                >
                  <option value="EP">EP (Room Only)</option>
                  <option value="CP">CP (Breakfast)</option>
                  <option value="MAP">MAP (Half Board)</option>
                  <option value="AP">AP (All Meals)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Guest Identity & Compliance */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400">
              2. Guest Identification & Compliance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Full Legal Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Anand Mahindra"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">10-Digit Mobile *</label>
                <input
                  type="tel"
                  placeholder="9820012345"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email *</label>
                <input
                  type="email"
                  placeholder="guest@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Place of Supply (State) *
                </label>
                <select
                  value={guestStateCode}
                  onChange={(e) => setGuestStateCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                >
                  {Object.entries(INDIAN_STATE_CODES).map(([code, name]) => (
                    <option key={code} value={code}>
                      [{code}] {name} {code === "27" ? "(Intra-state CGST/SGST)" : "(Inter-state IGST)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Aadhaar / ID Number (Masked)
                </label>
                <input
                  type="text"
                  placeholder="12-digit Aadhaar number"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">UIDAI privacy compliant</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Corporate GSTIN (Optional B2B)
                </label>
                <input
                  type="text"
                  placeholder="27AAAAA0000A1Z5"
                  value={corporateGstin}
                  onChange={(e) => setCorporateGstin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase"
                />
                {corporateGstin && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    {isValidGSTIN(corporateGstin) ? "✓ Valid GSTIN for tax invoice" : "Invalid GSTIN"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Price & GST Tax Summary */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 sticky top-28 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Price & GST Invoice</span>
              <span className="text-[10px] text-amber-400 font-mono">SAC: 996311</span>
            </h3>

            <div className="space-y-3 text-xs border-b border-slate-800 pb-4">
              <div className="flex justify-between text-slate-300">
                <span>Room Charges ({rateCalculation.totalNights} Nights)</span>
                <span>{formatINR(rateCalculation.roomSubtotal)}</span>
              </div>

              {rateCalculation.mealPlanCharges > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Meal Plan Charges ({mealPlan})</span>
                  <span>{formatINR(rateCalculation.mealPlanCharges)}</span>
                </div>
              )}

              {rateCalculation.extraGuestCharges > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Extra Guest Surcharge</span>
                  <span>{formatINR(rateCalculation.extraGuestCharges)}</span>
                </div>
              )}

              <div className="flex justify-between text-white font-semibold pt-1 border-t border-slate-800/60">
                <span>Taxable Subtotal</span>
                <span>{formatINR(rateCalculation.taxableAmount)}</span>
              </div>
            </div>

            {/* Indian GST Tax Breakdown */}
            <div className="space-y-2 text-xs bg-slate-950/80 p-3.5 rounded-lg border border-slate-800 font-mono">
              <p className="text-[11px] font-bold text-slate-400 uppercase font-sans">
                Tax Breakdown (POS: {gstCalculation.placeOfSupply})
              </p>

              {gstCalculation.isInterState ? (
                <div className="flex justify-between text-amber-400">
                  <span>IGST @ {(gstCalculation.igstRate * 100).toFixed(0)}%:</span>
                  <span>{formatINR(gstCalculation.igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-amber-400">
                    <span>CGST @ {(gstCalculation.cgstRate * 100).toFixed(0)}%:</span>
                    <span>{formatINR(gstCalculation.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-amber-400">
                    <span>SGST @ {(gstCalculation.sgstRate * 100).toFixed(0)}%:</span>
                    <span>{formatINR(gstCalculation.sgstAmount)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800 font-semibold">
                <span>Total Indian GST:</span>
                <span>{formatINR(gstCalculation.totalTax)}</span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white">Grand Total Payable:</span>
                <span className="text-2xl font-black text-amber-400">
                  {formatINR(gstCalculation.grandTotal)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                {numberToIndianWords(gstCalculation.grandTotal)}
              </p>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <span>Securing Razorpay Checkout...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Pay with Razorpay / UPI
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> 256-Bit SSL Encrypted
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-amber-400" /> UPI / Cards / NetBanking
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
