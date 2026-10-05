import { DEFAULT_HOTEL_INFO } from "@hotel/config";
import { Award, Compass, HeartHandshake } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
          A Century of Grandeur
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          The Heritage of {DEFAULT_HOTEL_INFO.name}
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed font-light">
          Founded in 1932 overlooking the majestic Arabian Sea, Grand Rajwada Palace stands as a living testament to Indian architectural magnificence, aristocratic hospitality, and royal tradition.
        </p>
      </div>

      <div className="relative h-96 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <img
          src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=80"
          alt="Palace Heritage Architecture"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-3">
          <Award className="w-8 h-8 text-amber-400" />
          <h3 className="text-base font-bold text-white">Atithi Devo Bhava</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Our revered ethos honors every traveler as divine, offering warm namaste greetings, personalized garland welcome, and bespoke attention.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-3">
          <Compass className="w-8 h-8 text-amber-400" />
          <h3 className="text-base font-bold text-white">Restored Palatial Design</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Intricate jharokhas, hand-carved Makrana marble columns, and silver-leaf detailing lovingly preserved across three historical wings.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-3">
          <HeartHandshake className="w-8 h-8 text-amber-400" />
          <h3 className="text-base font-bold text-white">Modern Excellence</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Contemporary luxury with fiber optic infrastructure, intelligent room climate automation, and seamless digital payments.
          </p>
        </div>
      </div>
    </div>
  );
}
