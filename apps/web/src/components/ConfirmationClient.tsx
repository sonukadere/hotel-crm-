"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  Search,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@hotel/utils";
import { MEAL_PLANS } from "@hotel/config";
import { ApiError, apiGet } from "../lib/api";
import type { BookingConfirmation } from "../lib/types";
import { readBookingSession } from "../lib/bookingSession";
import { nightsBetween } from "../lib/stay";

interface ConfirmationClientProps {
  bookingNumber: string;
}

export function ConfirmationClient({ bookingNumber }: ConfirmationClientProps) {
  const [reference, setReference] = useState(bookingNumber);
  const [mobile, setMobile] = useState("");
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(false);

  useEffect(() => {
    const session = readBookingSession();
    if (session && (!bookingNumber || session.bookingNumber === bookingNumber)) {
      setReference(session.bookingNumber);
      setMobile(session.mobile);
    }
    setSessionResolved(true);
  }, [bookingNumber]);

  const lookup = useCallback(
    async (target: { bookingNumber: string; mobile: string }) => {
      if (!target.bookingNumber.trim() || !target.mobile.trim()) {
        setErrors(["Booking number and mobile number are both required"]);
        return;
      }
      setLoading(true);
      setErrors([]);
      try {
        const data = await apiGet<BookingConfirmation>(
          `/public/bookings/${encodeURIComponent(target.bookingNumber.trim())}`,
          { mobile: target.mobile.trim() },
          { timeoutMs: 8000 },
        );
        setConfirmation(data);
      } catch (error) {
        setConfirmation(null);
        setErrors(error instanceof ApiError ? error.errors : [(error as Error).message]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sessionResolved || !mobile || !reference || confirmation) return;
    void lookup({ bookingNumber: reference, mobile });
  }, [sessionResolved, mobile, reference, confirmation, lookup]);

  const fieldClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500";

  // ------------------------------ lookup form ------------------------------
  if (!confirmation) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Find your booking
          </h1>
          <p className="text-sm text-slate-400">
            Enter the booking number and the mobile number used at checkout.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void lookup({ bookingNumber: reference, mobile });
          }}
          className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Booking number
            </label>
            <input
              className={fieldClass}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="BK-YYMMDD-0001"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mobile number
            </label>
            <input
              className={fieldClass}
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="10-digit Indian number"
              inputMode="numeric"
            />
          </div>

          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 space-y-1">
              {errors.map((error) => (
                <p key={error} className="text-xs text-red-200/80">
                  {error}
                </p>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            View booking
          </button>
        </form>

        <div className="text-center">
          <Link href="/rooms" className="text-xs text-slate-500 hover:text-amber-400">
            Browse rooms instead
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------ confirmation ------------------------------
  const nights = nightsBetween(confirmation.stay.checkInDate, confirmation.stay.checkOutDate);
  const plan = MEAL_PLANS[confirmation.stay.mealPlan];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4" /> Booking confirmed
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {confirmation.stay.roomType.name}
        </h1>
        <p className="text-sm text-slate-400">
          {confirmation.bookingNumbers.length > 1
            ? `${confirmation.bookingNumbers.length} rooms reserved • `
            : ""}
          Booking number{" "}
          <span className="font-mono text-amber-400">{confirmation.primaryBookingNumber}</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-400 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save
          </button>
          <Link
            href="/rooms"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors"
          >
            Book another stay
          </Link>
        </div>
      </div>

      {/* Stay */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Check-in
            </p>
            <p className="text-white font-semibold mt-1 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
              {formatIndianDate(confirmation.stay.checkInDate)}
            </p>
            <p className="text-slate-500 mt-0.5">
              from {confirmation.hotel.checkInTime ?? "14:00"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Check-out
            </p>
            <p className="text-white font-semibold mt-1 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
              {formatIndianDate(confirmation.stay.checkOutDate)}
            </p>
            <p className="text-slate-500 mt-0.5">
              by {confirmation.hotel.checkOutTime ?? "11:00"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Guests
            </p>
            <p className="text-white font-semibold mt-1">
              {confirmation.stay.adults} adult{confirmation.stay.adults === 1 ? "" : "s"},{" "}
              {confirmation.stay.children} child{confirmation.stay.children === 1 ? "" : "ren"}
            </p>
            <p className="text-slate-500 mt-0.5">
              {confirmation.stay.rooms} room{confirmation.stay.rooms === 1 ? "" : "s"} • {nights}{" "}
              night{nights === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Meal plan
            </p>
            <p className="text-white font-semibold mt-1">
              {confirmation.stay.mealPlan} • {plan?.name ?? ""}
            </p>
            <p className="text-slate-500 mt-0.5">{confirmation.stay.ratePlan.name}</p>
          </div>
        </div>

        {confirmation.stay.roomNumbers.length > 0 && (
          <div className="pt-4 border-t border-slate-800 text-xs text-slate-300">
            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider mr-2">
              Rooms
            </span>
            {confirmation.stay.roomNumbers.join(", ")}
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Guest
            </p>
            <p className="text-white font-semibold mt-1">{confirmation.guest.fullName}</p>
            <p className="text-slate-400">{confirmation.guest.mobile}</p>
            {confirmation.guest.email && (
              <p className="text-slate-400">{confirmation.guest.email}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Property
            </p>
            <p className="text-white font-semibold mt-1">{confirmation.hotel.name}</p>
            <p className="text-slate-400 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {confirmation.hotel.address}, {confirmation.hotel.city} - {confirmation.hotel.pincode}
            </p>
            <p className="text-slate-400 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 shrink-0" /> {confirmation.hotel.phone}
            </p>
            {confirmation.hotel.email && (
              <p className="text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" /> {confirmation.hotel.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-3 text-xs">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Payment summary
          </h2>
          <div className="flex items-center justify-between text-slate-300">
            <span>Room subtotal</span>
            <span className="font-mono">{formatINR(confirmation.pricing.roomSubtotal)}</span>
          </div>
          {confirmation.pricing.discount > 0 && (
            <div className="flex items-center justify-between text-emerald-400">
              <span>Discount</span>
              <span className="font-mono">-{formatINR(confirmation.pricing.discount)}</span>
            </div>
          )}
          {confirmation.pricing.services > 0 && (
            <div className="flex items-center justify-between text-slate-300">
              <span>Services</span>
              <span className="font-mono">{formatINR(confirmation.pricing.services)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-slate-400">
            <span>GST</span>
            <span className="font-mono">{formatINR(confirmation.pricing.gst)}</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <span className="text-white font-bold uppercase text-[11px]">Total</span>
            <span className="text-xl font-extrabold text-amber-400 font-mono">
              {formatINR(confirmation.pricing.finalAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">{confirmation.pricing.amountInWords}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-3 text-xs">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Payment received
          </h2>
          <div className="flex items-center justify-between text-slate-300">
            <span>Amount paid</span>
            <span className="font-mono text-emerald-400">
              {formatINR(confirmation.payment.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Method</span>
            <span>{confirmation.payment.method}</span>
          </div>
          {confirmation.payment.transactionRef && (
            <div className="flex items-center justify-between text-slate-400">
              <span>Transaction</span>
              <span className="font-mono truncate max-w-[180px]">
                {confirmation.payment.transactionRef}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-slate-400">
            <span>Paid on</span>
            <span>{new Date(confirmation.payment.paidAt).toLocaleString("en-IN")}</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {confirmation.confirmation.sent
              ? `Confirmation sent via ${confirmation.confirmation.channel}.`
              : "Keep the booking number handy at reception for check-in."}
          </p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-2 text-xs text-amber-200/90">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <p>
          Please carry a government-issued photo ID for every guest. Check-in is subject to
          hotel verification and availability of the assigned room type.
        </p>
      </div>
    </div>
  );
}
