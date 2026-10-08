import Link from "next/link";
import { formatINR } from "@hotel/utils";
import { MEAL_PLANS } from "@hotel/config";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { apiGet } from "../../../lib/api";
import type { PublicRoomResult, PublicRoomType, PublicSearchResponse } from "../../../lib/types";
import { SearchBar } from "../../../components/SearchBar";
import { parseStay, stayQuery } from "../../../lib/stay";

export const dynamic = "force-dynamic";

interface RoomDetailPageProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
];

export default async function RoomDetailPage({ params, searchParams }: RoomDetailPageProps) {
  const stay = parseStay(searchParams);
  const staySearch = stayQuery(stay);
  const selectedRatePlan = typeof searchParams.ratePlanId === "string" ? searchParams.ratePlanId : null;

  let room: PublicRoomType | null = null;
  let offer: PublicRoomResult | null = null;
  let failure: string | null = null;

  try {
    room = await apiGet<PublicRoomType>(`/public/room-types/${params.id}`, {}, { timeoutMs: 5000 });
  } catch (error) {
    failure = (error as Error).message;
  }

  if (room) {
    try {
      const search = await apiGet<PublicSearchResponse>("/public/search", {
        roomTypeId: room.roomTypeId,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        adults: stay.adults,
        children: stay.children,
        rooms: stay.rooms,
        mealPlan: stay.mealPlan ?? undefined,
      });
      offer = search.results[0] ?? null;
    } catch {
      offer = null;
    }
  }

  if (!room) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white">Room unavailable</h1>
        <p className="text-sm text-slate-400">{failure ?? "This room type could not be found."}</p>
        <Link
          href={`/rooms?${staySearch}`}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to rooms
        </Link>
      </div>
    );
  }

  const images = room.images.length > 0 ? room.images : FALLBACK_IMAGES;
  const offers = offer?.offers ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <Link
        href={`/rooms?${staySearch}`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to availability
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gallery */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative h-80 sm:h-[420px] rounded-2xl overflow-hidden border border-slate-800">
            <img src={images[0]} alt={room.name} className="w-full h-full object-cover" />
            <span className="absolute top-3 left-3 text-[11px] font-bold px-3 py-1 rounded-full bg-slate-950/80 border border-amber-500/40 text-amber-400 backdrop-blur-md">
              {room.code}
            </span>
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-3 gap-3">
              {images.slice(1, 4).map((image) => (
                <div
                  key={image}
                  className="h-24 sm:h-28 rounded-xl overflow-hidden border border-slate-800"
                >
                  <img src={image} alt={room.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">{room.name}</h1>
            <p className="text-sm text-slate-400 leading-relaxed">{room.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Sleeps
              </p>
              <p className="text-white font-semibold mt-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                {room.occupancy.maxAdults} adults, {room.occupancy.maxChildren} children
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Inventory
              </p>
              <p className="text-white font-semibold mt-1">
                {offer ? `${offer.availableRooms} of ${offer.totalRooms} free` : `${room.totalRooms} rooms`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Amenities
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              {room.amenities.length > 0
                ? room.amenities.map((amenity) => (
                    <span key={amenity} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {amenity}
                    </span>
                  ))
                : ["Complimentary WiFi", "Air Conditioning", "Daily Housekeeping"].map((amenity) => (
                    <span key={amenity} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {amenity}
                    </span>
                  ))}
            </div>
          </div>
        </div>
      </div>

      {/* Date controls */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-white">Your stay</h2>
          <p className="text-xs text-slate-400">
            {stay.checkInDate} → {stay.checkOutDate} • {stay.rooms} room
            {stay.rooms > 1 ? "s" : ""} • {stay.adults} adult{stay.adults > 1 ? "s" : ""}
          </p>
        </div>
        <SearchBar stay={stay} actionPath={`/rooms/${room.roomTypeId}`} />
      </section>

      {/* Rate plans / meal plans with live server prices */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-white">Choose your rate & meal plan</h2>
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Prices recalculated by our
            reservation desk
          </p>
        </div>

        {offers.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-sm text-slate-400">
            Tariffs could not be loaded for these dates. Please retry, or contact the front desk.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {offers.map((rateOffer) => {
            const isSelected =
              selectedRatePlan === rateOffer.ratePlanId ||
              (!selectedRatePlan && rateOffer.matchesRequestedMealPlan);
            const href = `/booking?${stayQuery(stay, {
              roomTypeId: room.roomTypeId,
              ratePlanId: rateOffer.ratePlanId,
              mealPlan: rateOffer.mealPlan,
            })}`;
            const plan = MEAL_PLANS[rateOffer.mealPlan];

            return (
              <div
                key={`${rateOffer.ratePlanId}-${rateOffer.mealPlan}`}
                className={`rounded-2xl border p-5 space-y-4 transition-colors ${
                  isSelected
                    ? "border-amber-500/60 bg-slate-900/70"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">{rateOffer.ratePlanName}</p>
                    <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">
                      {rateOffer.mealPlan} • {plan?.name}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-400 font-mono">
                    {rateOffer.ratePlanCode}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">{plan?.description}</p>

                {rateOffer.quote ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>
                        Room subtotal ({rateOffer.quote.rooms} room
                        {rateOffer.quote.rooms > 1 ? "s" : ""} × {rateOffer.quote.nights} night
                        {rateOffer.quote.nights === 1 ? "" : "s"})
                      </span>
                      <span className="font-mono">
                        {formatINR(rateOffer.quote.summary.roomSubtotal)}
                      </span>
                    </div>
                    {rateOffer.quote.summary.discount > 0 && (
                      <div className="flex items-center justify-between text-emerald-400">
                        <span>Discount</span>
                        <span className="font-mono">
                          -{formatINR(rateOffer.quote.summary.discount)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-400">
                      <span>GST</span>
                      <span className="font-mono">{formatINR(rateOffer.quote.summary.gst)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="font-bold text-white uppercase text-[11px]">
                        Total payable
                      </span>
                      <span className="text-xl font-extrabold text-amber-400 font-mono">
                        {formatINR(rateOffer.quote.summary.finalAmount)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {rateOffer.errors[0] ?? "Not available for these dates"}
                  </p>
                )}

                <Link
                  href={rateOffer.quote ? href : `/rooms?${stayQuery(stay)}`}
                  className={`block w-full text-center px-5 py-3 rounded-lg font-bold text-sm transition-all ${
                    rateOffer.quote
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-lg shadow-amber-600/20"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {rateOffer.quote ? "Reserve this plan" : "Choose other dates"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Meal plan guide */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        {Object.values(MEAL_PLANS).map((plan) => (
          <div key={plan.code} className="space-y-1">
            <span className="font-bold text-amber-400 uppercase tracking-wider">
              {plan.code} ({plan.name})
            </span>
            <p className="text-slate-400 text-[11px]">{plan.description}</p>
          </div>
        ))}
      </section>

      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        Free cancellation as per hotel policy • GST included in every price shown • Secure Razorpay
        checkout
      </p>
    </div>
  );
}
