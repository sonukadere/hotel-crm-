"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cleanIndianMobile, formatINR, formatIndianDate, isValidGSTIN, isValidIndianMobile } from "@hotel/utils";
import { INDIAN_STATE_CODES, MEAL_PLANS } from "@hotel/config";
import { ApiError, apiGet, apiPost } from "../lib/api";
import type {
  BookingConfirmation,
  CheckoutResponse,
  PublicHotel,
  PublicQuote,
  PublicRoomType,
  PublicService,
  QuoteResponse,
} from "../lib/types";
import { nightsBetween, stayQuery, type StayParams } from "../lib/stay";
import { saveBookingSession } from "../lib/bookingSession";
import { PriceSummary } from "./PriceSummary";

interface BookingClientProps {
  stay: StayParams;
  roomTypeId: string;
  ratePlanId?: string;
  mealPlan: string | null;
}

interface GuestForm {
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  stateCode: string;
  gstin: string;
  specialRequests: string;
}

const EMPTY_GUEST: GuestForm = {
  fullName: "",
  mobile: "",
  email: "",
  address: "",
  city: "",
  stateCode: "",
  gstin: "",
  specialRequests: "",
};

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay]");
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "true";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function randomToken(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function BookingClient({ stay, roomTypeId, ratePlanId, mealPlan }: BookingClientProps) {
  const router = useRouter();
  const nights = nightsBetween(stay.checkInDate, stay.checkOutDate);

  const [room, setRoom] = useState<PublicRoomType | null>(null);
  const [hotel, setHotel] = useState<PublicHotel | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [plan, setPlan] = useState<{ ratePlanId: string; mealPlan: string | null }>({
    ratePlanId: ratePlanId ?? "",
    mealPlan,
  });

  const [guest, setGuest] = useState<GuestForm>(EMPTY_GUEST);
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteErrors, setQuoteErrors] = useState<string[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payErrors, setPayErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");

  const quoteSeq = useRef(0);
  const bootstrapped = useRef(false);

  // ---- initial catalogue load -------------------------------------------------
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cancelled = false;
    (async () => {
      try {
        const [roomType, hotelRow, serviceRows] = await Promise.all([
          apiGet<PublicRoomType>(`/public/room-types/${roomTypeId}`, {}, { timeoutMs: 6000 }),
          apiGet<PublicHotel>("/public/hotel", {}, { timeoutMs: 6000 }).catch(() => null),
          apiGet<PublicService[]>("/public/services", {}, { timeoutMs: 6000 }).catch(() => []),
        ]);
        if (cancelled) return;
        setRoom(roomType);
        setHotel(hotelRow);
        setServices(serviceRows);
        setPlan((current) => ({
          ratePlanId: current.ratePlanId || roomType.ratePlans[0]?.ratePlanId || "",
          mealPlan: current.mealPlan ?? roomType.ratePlans[0]?.mealPlan ?? null,
        }));
        setGuest((current) => ({
          ...current,
          stateCode: current.stateCode || hotelRow?.stateCode || "",
        }));
      } catch (error) {
        if (!cancelled) setSetupError((error as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomTypeId]);

  // ---- live server-side quote -------------------------------------------------
  const selection = useMemo(
    () => ({
      roomTypeId,
      ratePlanId: plan.ratePlanId || undefined,
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      adults: stay.adults,
      children: stay.children,
      rooms: stay.rooms,
      mealPlan: plan.mealPlan ?? undefined,
      guestStateCode: guest.stateCode || undefined,
      services: selectedServices.map((serviceId) => ({ serviceId, quantity: 1 })),
    }),
    [
      roomTypeId,
      plan.ratePlanId,
      plan.mealPlan,
      stay.checkInDate,
      stay.checkOutDate,
      stay.adults,
      stay.children,
      stay.rooms,
      guest.stateCode,
      selectedServices,
    ],
  );

  const refreshQuote = useCallback(async () => {
    const seq = ++quoteSeq.current;
    setQuoteLoading(true);
    try {
      const data = await apiPost<QuoteResponse>("/public/quote", selection);
      if (seq !== quoteSeq.current) return;
      setQuote(data.quote);
      setQuoteErrors([]);
      setPlan((current) =>
        current.mealPlan === data.quote.mealPlan ? current : { ...current, mealPlan: data.quote.mealPlan },
      );
    } catch (error) {
      if (seq !== quoteSeq.current) return;
      setQuote(null);
      setQuoteErrors(
        error instanceof ApiError ? error.errors : [(error as Error).message],
      );
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false);
    }
  }, [selection]);

  useEffect(() => {
    void refreshQuote();
  }, [refreshQuote]);

  // ---- guest form helpers -----------------------------------------------------
  const setField = (key: keyof GuestForm, value: string) =>
    setGuest((current) => ({ ...current, [key]: value }));

  const validateGuest = (): string[] => {
    const errors: string[] = [];
    if (guest.fullName.trim().length < 2) errors.push("Guest name is required");
    if (!isValidIndianMobile(cleanIndianMobile(guest.mobile)))
      errors.push("Enter a valid 10-digit Indian mobile number");
    if (guest.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim()))
      errors.push("Enter a valid email address");
    if (!guest.stateCode) errors.push("Place of supply (state) is required");
    if (guest.gstin.trim() && !isValidGSTIN(guest.gstin.trim().toUpperCase()))
      errors.push("Enter a valid 15-character GSTIN");
    return errors;
  };

  // ---- payment ----------------------------------------------------------------
  const completeBooking = async (
    checkout: CheckoutResponse,
    payment: { orderId: string; paymentId: string; signature: string },
  ) => {
    setStatus("Confirming your booking\u2026");
    const result = await apiPost<{ confirmation: BookingConfirmation; duplicate: boolean }>(
      "/public/confirm",
      {
        token: checkout.token,
        razorpay: payment,
        selection,
        guest: {
          fullName: guest.fullName.trim(),
          mobile: cleanIndianMobile(guest.mobile),
          email: guest.email.trim() || undefined,
          address: guest.address.trim() || undefined,
          city: guest.city.trim() || undefined,
          stateCode: guest.stateCode,
          state: INDIAN_STATE_CODES[guest.stateCode],
          gstin: guest.gstin.trim() ? guest.gstin.trim().toUpperCase() : undefined,
          specialRequests: guest.specialRequests.trim() || undefined,
        },
      },
    );

    saveBookingSession({
      bookingNumber: result.confirmation.primaryBookingNumber,
      mobile: cleanIndianMobile(guest.mobile),
      savedAt: Date.now(),
    });

    router.push(`/booking/confirmation?bookingNumber=${result.confirmation.primaryBookingNumber}`);
  };

  const payNow = async () => {
    if (paying) return;
    setPayErrors([]);

    const errors = validateGuest();
    if (errors.length > 0) {
      setPayErrors(errors);
      return;
    }
    if (!quote) {
      setPayErrors(["Please wait for the final price to load."]);
      return;
    }

    setPaying(true);
    try {
      setStatus("Creating your secure payment order\u2026");
      const checkout = await apiPost<CheckoutResponse>("/public/checkout", selection);

      if (checkout.order.demo) {
        // Test keys (or no keys): simulate a captured Razorpay payment so the
        // whole booking flow can be exercised without a live gateway account.
        setStatus("Completing simulated payment\u2026");
        await completeBooking(checkout, {
          orderId: checkout.order.orderId,
          paymentId: randomToken("simulated_pay"),
          signature: randomToken("simulated_sig"),
        });
        return;
      }

      setStatus("Opening Razorpay\u2026");
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new ApiError("Secure checkout could not be loaded. Please try again.", 503);
      }

      const razorpay = new window.Razorpay({
        key: checkout.order.keyId,
        amount: checkout.order.amount,
        currency: checkout.order.currency,
        name: hotel?.name ?? "Hotel Booking",
        description: `${room?.name ?? "Room"} • ${nights} night${nights === 1 ? "" : "s"}`,
        order_id: checkout.order.orderId,
        prefill: {
          name: guest.fullName.trim(),
          email: guest.email.trim() || undefined,
          contact: `91${cleanIndianMobile(guest.mobile)}`,
        },
        theme: { color: "#f59e0b" },
        handler: (response: RazorpaySuccess) => {
          void completeBooking(checkout, {
            orderId: response.razorpay_order_id || checkout.order.orderId,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }).catch((error) => {
            setPaying(false);
            setStatus("");
            setPayErrors(
              error instanceof ApiError ? error.errors : [(error as Error).message],
            );
          });
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setStatus("");
          },
        },
      });

      razorpay.open();
    } catch (error) {
      setPaying(false);
      setStatus("");
      setPayErrors(error instanceof ApiError ? error.errors : [(error as Error).message]);
    }
  };

  // ---- render -----------------------------------------------------------------
  const fieldClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500";

  const selectedPlan = room?.ratePlans.find((item) => item.ratePlanId === plan.ratePlanId);
  const selectedMealPlan = (plan.mealPlan ?? quote?.mealPlan ?? "EP") as keyof typeof MEAL_PLANS;

  if (setupError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white">We could not start your booking</h1>
        <p className="text-sm text-slate-400">{setupError}</p>
        <Link
          href={`/rooms?${stayQuery(stay)}`}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Choose another room
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/rooms/${roomTypeId}?${stayQuery(stay)}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to room
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Guest details & payment
          </h1>
        </div>
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> GST invoice • Razorpay secure
          checkout • No card details stored
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ---------------- Guest details ---------------- */}
        <div className="lg:col-span-7 space-y-6">
          {/* Stay summary */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-white">{room?.name ?? "Room"}</p>
              <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">
                {selectedPlan?.name ?? "Best available rate"} • {MEAL_PLANS[selectedMealPlan]?.code}{" "}
                {MEAL_PLANS[selectedMealPlan] ? `- ${MEAL_PLANS[selectedMealPlan].name}` : ""}
              </p>
            </div>
            <div className="text-xs text-slate-300 text-right">
              <p className="flex items-center justify-end gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                {formatIndianDate(stay.checkInDate)} → {formatIndianDate(stay.checkOutDate)}
              </p>
              <p className="text-slate-500 mt-1">
                {nights} night{nights === 1 ? "" : "s"} • {stay.rooms} room
                {stay.rooms > 1 ? "s" : ""} • {stay.adults} adult{stay.adults > 1 ? "s" : ""} •{" "}
                {stay.children} child{stay.children === 1 ? "" : "ren"}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Primary guest
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Full name *
                </label>
                <input
                  className={fieldClass}
                  value={guest.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  placeholder="As per government ID"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Mobile *
                </label>
                <input
                  className={fieldClass}
                  value={guest.mobile}
                  onChange={(e) => setField("mobile", e.target.value)}
                  placeholder="10-digit Indian number"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Email
                </label>
                <input
                  className={fieldClass}
                  value={guest.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  City
                </label>
                <input
                  className={fieldClass}
                  value={guest.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Mumbai"
                  autoComplete="address-level2"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Address
                </label>
                <input
                  className={fieldClass}
                  value={guest.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="Street, locality"
                  autoComplete="street-address"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Place of supply (state) *
                </label>
                <select
                  className={fieldClass}
                  value={guest.stateCode}
                  onChange={(e) => setField("stateCode", e.target.value)}
                >
                  <option value="">Select state</option>
                  {Object.entries(INDIAN_STATE_CODES)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  GSTIN (for business billing)
                </label>
                <input
                  className={fieldClass}
                  value={guest.gstin}
                  onChange={(e) => setField("gstin", e.target.value.toUpperCase())}
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Special requests
                </label>
                <textarea
                  className={`${fieldClass} min-h-[90px]`}
                  value={guest.specialRequests}
                  onChange={(e) => setField("specialRequests", e.target.value)}
                  placeholder="Early check-in, honeymoon setup, dietary needs\u2026"
                />
              </div>
            </div>
          </div>

          {/* Add-on services */}
          {services.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Enhance your stay
                </h2>
                <span className="text-[10px] text-slate-500">Billed to your folio</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((service) => {
                  const active = selectedServices.includes(service.serviceId);
                  return (
                    <button
                      key={service.serviceId}
                      type="button"
                      onClick={() =>
                        setSelectedServices((current) =>
                          current.includes(service.serviceId)
                            ? current.filter((id) => id !== service.serviceId)
                            : [...current, service.serviceId],
                        )
                      }
                      className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                        active
                          ? "border-amber-500/60 bg-amber-500/10"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{service.name}</span>
                        <span className="text-xs font-mono text-amber-400">
                          {formatINR(service.basePrice)}
                        </span>
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-1">
                        {service.category} • {service.gstRate}% GST
                        {active ? " • added" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Price + pay ---------------- */}
        <div className="lg:col-span-5 space-y-4">
          <div className="lg:sticky lg:top-28 space-y-4">
            {quote && <PriceSummary quote={quote} title="Your price" />}

            {!quote && quoteErrors.length === 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">
                  Recalculating your total with the reservation desk…
                </p>
              </div>
            )}

            {quoteErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Price unavailable
                </p>
                {quoteErrors.map((error) => (
                  <p key={error} className="text-xs text-red-200/80">
                    {error}
                  </p>
                ))}
              </div>
            )}

            {payErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 space-y-1">
                {payErrors.map((error) => (
                  <p key={error} className="text-xs text-red-200/80 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
                  </p>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void payNow()}
              disabled={!quote || quoteLoading || paying}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {status || "Processing\u2026"}
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  {quote ? `Pay ${formatINR(quote.summary.finalAmount)}` : "Pay securely"}
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              The payable amount is recalculated on our servers when you pay - if the tariff
              changes before payment, you will be asked to review the new price.
            </p>

            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Booking confirmed instantly with a booking number and email/SMS summary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
