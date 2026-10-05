import Link from "next/link";
import { formatINR } from "@hotel/utils";
import { MEAL_PLANS } from "@hotel/config";
import { Check, ShieldCheck } from "lucide-react";

const ROOMS_CATALOG = [
  {
    id: "std",
    name: "Standard Heritage Room",
    basePrice: 4200,
    maxAdults: 2,
    maxChildren: 1,
    size: "350 sq.ft",
    view: "Heritage Courtyard View",
    image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
    description: "Classic architecture meets modern luxury. Hand-carved teak furnishings, luxury rain shower, and heritage acoustics.",
    amenities: ["King Bed / Twin Beds", "Smart HDTV", "Espresso Machine", "In-Room Safe", "Complimentary WiFi"],
  },
  {
    id: "dlx",
    name: "Deluxe Courtyard Balcony",
    basePrice: 6500,
    maxAdults: 3,
    maxChildren: 2,
    size: "480 sq.ft",
    view: "Botanical Garden & Fountain View",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    description: "Spacious private terrace suite with hand-painted fresco ceilings, oversized marble vanity, and deep-soaking bathtub.",
    amenities: ["Private Balcony", "Premium Mini Bar", "Deep Soaking Tub", "Soundproof Glazing", "Pillow Menu"],
  },
  {
    id: "sui",
    name: "Maharaja Royal Suite",
    basePrice: 12500,
    maxAdults: 4,
    maxChildren: 2,
    size: "850 sq.ft",
    view: "Panoramic Skyline & Heritage Palace Lawns",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    description: "An extravagant suite reserved for royalty and heads of state. Includes private dining parlor, whirlpool jacuzzi, and personalized butler.",
    amenities: ["Private Jacuzzi", "Dedicated 24/7 Butler", "Complimentary Airport Chauffeur", "Executive Lounge Access"],
  },
];

export default function RoomsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Rooms & Royal Suites
        </h1>
        <p className="text-sm text-slate-400">
          Discover our exquisitely appointed residences, designed with timeless Indian craftsmanship and modern indulgence.
        </p>
      </div>

      {/* Meal Plan Guide */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        {Object.values(MEAL_PLANS).map((plan) => (
          <div key={plan.code} className="space-y-1">
            <span className="font-bold text-amber-400 uppercase tracking-wider">{plan.code} ({plan.name})</span>
            <p className="text-slate-400 text-[11px]">{plan.description}</p>
          </div>
        ))}
      </div>

      {/* Catalog Listing */}
      <div className="space-y-8">
        {ROOMS_CATALOG.map((room) => {
          const isAbove7500 = room.basePrice > 7500;
          const gstRatePct = isAbove7500 ? 18 : 12;
          const gstAmount = (room.basePrice * gstRatePct) / 100;
          const totalWithTax = room.basePrice + gstAmount;

          return (
            <div
              key={room.id}
              className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 hover:border-slate-700 transition-colors"
            >
              <div className="lg:col-span-5 relative h-72 lg:h-auto min-h-[260px]">
                <img
                  src={room.image}
                  alt={room.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-2xl font-bold text-white">{room.name}</h3>
                    <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full font-medium">
                      {room.size} • {room.view}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{room.description}</p>

                  <div className="pt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                    {room.amenities.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 text-slate-300">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">{formatINR(room.basePrice)}</span>
                      <span className="text-xs text-slate-400">/ night base</span>
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> +{gstRatePct}% GST ({formatINR(gstAmount)}) = {formatINR(totalWithTax)} net
                    </p>
                  </div>

                  <Link
                    href={`/booking?room=${room.id}&rate=${room.basePrice}`}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-lg shadow-amber-600/20 transition-all"
                  >
                    Select & Reserve Room
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
