import Link from "next/link";
import {
  Utensils,
  Sparkles,
  Wifi,
  Shield,
  CheckCircle,
} from "lucide-react";
import { formatINR } from "@hotel/utils";
import { MEAL_PLANS } from "@hotel/config";
import { apiGet } from "../lib/api";
import type { PublicRoomType } from "../lib/types";
import { SearchBar } from "../components/SearchBar";
import { defaultStay, stayQuery } from "../lib/stay";

export const dynamic = "force-dynamic";

const FALLBACK_ROOMS = [
  {
    id: "",
    name: "Standard Heritage Room",
    basePrice: 4200,
    tag: "Best Value",
    description:
      "Elegant courtyard-facing room with handcrafted wooden furnishings and modern amenities.",
    image:
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Free High-Speed WiFi", "King Bed", "Smart TV", "Tea/Coffee Maker"],
  },
  {
    id: "",
    name: "Deluxe Courtyard View",
    basePrice: 6500,
    tag: "Popular",
    description:
      "Spacious private balcony suite overlooking the royal botanical gardens and fountain.",
    image:
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Private Balcony", "Breakfast Included (CP)", "Mini Bar", "Marble Bath"],
  },
  {
    id: "",
    name: "Maharaja Royal Suite",
    basePrice: 12500,
    tag: "Luxury Masterpiece",
    description:
      "The pinnacle of Indian luxury living with separate living salon, jacuzzi, and dedicated butler.",
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Private Jacuzzi", "24/7 Butler Service", "Complimentary Airport Transfer"],
  },
];

async function getFeaturedRooms(): Promise<PublicRoomType[]> {
  try {
    const rooms = await apiGet<PublicRoomType[]>("/public/room-types", {}, { timeoutMs: 4000 });
    return rooms.slice(0, 3);
  } catch {
    return [];
  }
}

const FALLBACK_IMAGES = FALLBACK_ROOMS.map((room) => room.image);

export default async function HomePage() {
  const featured = await getFeaturedRooms();
  const stay = defaultStay();
  const searchQuery = stayQuery(stay);

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2000&q=80')`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/40" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 text-center space-y-6 pt-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" /> Luxury Indian Hospitality Since 1932
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            Where Timeless Royalty <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
              Meets Modern Grace
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed font-light">
            Indulge in an extraordinary sanctuary of royal heritage, bespoke butler service, and
            Michelin-inspired Indian cuisine in the heart of Mumbai.
          </p>

          <div className="mt-8 max-w-5xl mx-auto">
            <SearchBar stay={stay} />
          </div>
        </div>
      </section>

      {/* Featured Rooms & Suites Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            Handcrafted Sanctuaries
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Our Suites & Heritage Rooms
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Live tariffs for your selected dates - every price below is calculated by our
            reservation desk, taxes included.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featured.length > 0
            ? featured.map((room, index) => (
                <div
                  key={room.roomTypeId}
                  className="group bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 flex flex-col"
                >
                  <div className="relative h-60 overflow-hidden">
                    <img
                      src={room.images[0] ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]}
                      alt={room.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md text-amber-400 text-xs font-semibold px-3 py-1 rounded-full border border-amber-500/30">
                      {room.ratePlans[0]?.name ?? "Direct Rate"}
                    </span>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                        {room.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {room.description}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        {room.amenities.slice(0, 4).map((amenity) => (
                          <span key={amenity} className="flex items-center gap-1.5">
                            <CheckCircle className="w-3 h-3 text-amber-400" /> {amenity}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-black text-white">
                          {formatINR(room.basePrice)}
                        </span>
                        <span className="text-xs text-slate-400"> / night</span>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {room.occupancy.maxAdults} adults • {room.totalRooms} rooms
                        </p>
                      </div>
                      <Link
                        href={`/rooms/${room.roomTypeId}?${searchQuery}`}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors"
                      >
                        View & Reserve
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            : FALLBACK_ROOMS.map((room) => (
                <div
                  key={room.name}
                  className="group bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 flex flex-col"
                >
                  <div className="relative h-60 overflow-hidden">
                    <img
                      src={room.image}
                      alt={room.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md text-amber-400 text-xs font-semibold px-3 py-1 rounded-full border border-amber-500/30">
                      {room.tag}
                    </span>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                        {room.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {room.description}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        {room.amenities.map((amenity) => (
                          <span key={amenity} className="flex items-center gap-1.5">
                            <CheckCircle className="w-3 h-3 text-amber-400" /> {amenity}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-black text-white">
                          {formatINR(room.basePrice)}
                        </span>
                        <span className="text-xs text-slate-400"> / night</span>
                      </div>
                      <Link
                        href={`/rooms?${searchQuery}`}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors"
                      >
                        Check Dates
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </section>

      {/* Meal Plans */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            Choose Your Meal Plan
          </p>
          <h2 className="text-3xl font-black text-white tracking-tight">EP • CP • MAP • AP</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Every tariff is priced for the meal plan you pick. The rate you see at checkout already
            includes the plan and all applicable GST.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.values(MEAL_PLANS).map((plan) => (
            <div
              key={plan.code}
              className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider">
                {plan.code}
              </span>
              <h4 className="text-base font-bold text-white">{plan.name}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{plan.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hospitality Services & Inclusions */}
      <section className="bg-slate-950 border-y border-slate-800/80 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Signature Royal Amenities
            </h2>
            <p className="text-xs text-slate-400">
              Complimentary privileges extended to every esteemed guest of the Palace
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <Utensils className="w-8 h-8 text-amber-400" />
              <h4 className="text-base font-bold text-white">Royal Dining</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Traditional Awadhi, Mughlai, and Coastal delicacies prepared by master khansamas.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              <h4 className="text-base font-bold text-white">Ayurvedic Wellness Spa</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Holistic rejuvenation therapies rooted in ancient Vedic wellness rituals.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <Wifi className="w-8 h-8 text-amber-400" />
              <h4 className="text-base font-bold text-white">Gigabit Fiber WiFi</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Seamless encrypted connectivity across suites, lounges, and royal courtyards.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <Shield className="w-8 h-8 text-amber-400" />
              <h4 className="text-base font-bold text-white">Verified Compliance</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Official GST-compliant tax invoicing, Razorpay instant checkout, and masked Aadhaar
                privacy.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
