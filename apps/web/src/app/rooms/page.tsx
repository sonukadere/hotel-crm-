import Link from "next/link";
import { formatINR } from "@hotel/utils";
import { MEAL_PLANS } from "@hotel/config";
import { AlertTriangle, Check, ShieldCheck, Users, Moon } from "lucide-react";
import { apiGet } from "../../lib/api";
import type { PublicSearchResponse } from "../../lib/types";
import { SearchBar } from "../../components/SearchBar";
import { parseStay, nightsBetween, stayQuery } from "../../lib/stay";

export const dynamic = "force-dynamic";

interface RoomsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80";

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const stay = parseStay(searchParams);
  const nights = nightsBetween(stay.checkInDate, stay.checkOutDate);

  let results: PublicSearchResponse | null = null;
  let failure: string | null = null;
  try {
    results = await apiGet<PublicSearchResponse>("/public/search", {
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      adults: stay.adults,
      children: stay.children,
      rooms: stay.rooms,
      mealPlan: stay.mealPlan ?? undefined,
      guestStateCode: stay.guestStateCode ?? undefined,
    });
  } catch (error) {
    failure = (error as Error).message;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Rooms & Royal Suites
        </h1>
        <p className="text-sm text-slate-400">
          {stay.checkInDate} → {stay.checkOutDate} • {stay.adults} adult
          {stay.adults > 1 ? "s" : ""} • {stay.children} child
          {stay.children === 1 ? "" : "ren"} • {stay.rooms} room{stay.rooms > 1 ? "s" : ""}
          {stay.mealPlan ? ` • ${stay.mealPlan} plan` : ""}
        </p>
      </div>

      <SearchBar stay={stay} />

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        {Object.values(MEAL_PLANS).map((plan) => (
          <div key={plan.code} className="space-y-1">
            <span className="font-bold text-amber-400 uppercase tracking-wider">
              {plan.code} ({plan.name})
            </span>
            <p className="text-slate-400 text-[11px]">{plan.description}</p>
          </div>
        ))}
      </div>

      {failure && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Live availability is unavailable</p>
            <p className="text-xs text-slate-400">{failure}</p>
            <p className="text-xs text-slate-500">
              Please retry in a moment, or call the reservation desk to hold a room.
            </p>
          </div>
        </div>
      )}

      {results && results.results.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center space-y-2">
          <p className="text-lg font-bold text-white">No room types are configured yet</p>
          <p className="text-xs text-slate-400">
            Please check back shortly or contact the front desk directly.
          </p>
        </div>
      )}

      {results && results.results.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {results.availableRoomTypes} of {results.results.length} room types available for
              these dates
            </span>
            <span>{results.nights} night{results.nights === 1 ? "" : "s"}</span>
          </div>

          {results.results.map((room) => {
            const bestOffer = room.offers.find((offer) => offer.quote) ?? null;
            const detailHref = `/rooms/${room.roomTypeId}?${stayQuery(stay)}`;

            return (
              <div
                key={room.roomTypeId}
                className={`bg-slate-900/40 border rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 transition-colors ${
                  room.isAvailable
                    ? "border-slate-800 hover:border-slate-700"
                    : "border-slate-900 opacity-70"
                }`}
              >
                <div className="lg:col-span-5 relative h-72 lg:h-auto min-h-[260px]">
                  <img
                    src={room.images[0] ?? FALLBACK_IMAGE}
                    alt={room.name}
                    className="w-full h-full object-cover"
                  />
                  <span
                    className={`absolute top-3 left-3 text-[11px] font-bold px-3 py-1 rounded-full border backdrop-blur-md ${
                      room.isAvailable
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950/80 border-slate-700 text-slate-300"
                    }`}
                  >
                    {room.isAvailable
                      ? `${room.availableRooms} of ${room.totalRooms} rooms free`
                      : "Unavailable for these dates"}
                  </span>
                </div>

                <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-2xl font-bold text-white">{room.name}</h3>
                      <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full font-medium">
                        {room.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{room.description}</p>

                    <div className="pt-1 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        {room.occupancy.maxAdults} adults • {room.occupancy.maxChildren} children
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-amber-400" />
                        {nights} night{nights === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-300">
                      {room.amenities.slice(0, 5).map((item) => (
                        <span key={item} className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-amber-400" /> {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {room.offers.slice(0, 4).map((offer) => {
                        const href = `${detailHref}&ratePlanId=${offer.ratePlanId}&mealPlan=${offer.mealPlan}`;
                        return (
                          <Link
                            key={`${offer.ratePlanId}-${offer.mealPlan}`}
                            href={room.isAvailable ? href : detailHref}
                            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors ${
                              room.isAvailable
                                ? "border-slate-800 hover:border-amber-500/60 bg-slate-950/40"
                                : "border-slate-900 bg-slate-950/30 cursor-not-allowed"
                            }`}
                          >
                            <span className="text-left">
                              <span className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                                {offer.mealPlan} • {offer.ratePlanName}
                              </span>
                              <span className="block text-[10px] text-slate-500">
                                {offer.quote
                                  ? `${offer.quote.nights} nights, ${offer.quote.rooms} room${
                                      offer.quote.rooms > 1 ? "s" : ""
                                    } • GST included`
                                  : "Unavailable"}
                              </span>
                            </span>
                            <span className="text-right">
                              <span className="block text-lg font-extrabold text-white font-mono">
                                {offer.quote ? formatINR(offer.quote.summary.finalAmount) : "—"}
                              </span>
                              <span className="block text-[10px] text-slate-500">total stay</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        {bestOffer?.quote
                          ? `From ${formatINR(bestOffer.quote.summary.roomSubtotal)} stay subtotal, ${formatINR(bestOffer.quote.summary.gst)} GST`
                          : "All-inclusive pricing shown at checkout"}
                      </p>

                      <Link
                        href={detailHref}
                        className={`inline-flex items-center justify-center px-6 py-3 rounded-lg font-bold text-sm shadow-lg transition-all ${
                          room.isAvailable
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-amber-600/20"
                            : "bg-slate-800 text-slate-500 shadow-none cursor-not-allowed"
                        }`}
                      >
                        {room.isAvailable ? "View Room & Reserve" : "Change your dates"}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
