"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar, Users } from "lucide-react";
import { MEAL_PLANS } from "@hotel/config";
import { defaultStay, stayQuery, type StayParams } from "../lib/stay";

const ROOM_OPTIONS = [1, 2, 3, 4, 5, 6];
const ADULT_OPTIONS = [1, 2, 3, 4, 5, 6];
const CHILD_OPTIONS = [0, 1, 2, 3, 4];

interface SearchBarProps {
  stay?: StayParams;
  className?: string;
  /** Where the search submits to. Keeps the guest on the same room when set. */
  actionPath?: string;
}

export function SearchBar({ stay, className = "", actionPath = "/rooms" }: SearchBarProps) {
  const router = useRouter();
  const initial = stay ?? defaultStay();
  const [draft, setDraft] = useState<StayParams>(initial);

  const set = <K extends keyof StayParams>(key: K, value: StayParams[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checkOut =
      draft.checkOutDate > draft.checkInDate
        ? draft.checkOutDate
        : draft.checkInDate;
    router.push(`${actionPath}?${stayQuery({ ...draft, checkOutDate: checkOut })}`);
  };

  const fieldClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500";

  return (
    <form
      onSubmit={submit}
      className={`bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 p-4 sm:p-5 rounded-2xl shadow-2xl text-left ${className}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" /> Check-In
          </label>
          <input
            type="date"
            value={draft.checkInDate}
            onChange={(e) => set("checkInDate", e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" /> Check-Out
          </label>
          <input
            type="date"
            value={draft.checkOutDate}
            min={draft.checkInDate}
            onChange={(e) => set("checkOutDate", e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" /> Adults
          </label>
          <select
            value={draft.adults}
            onChange={(e) => set("adults", Number(e.target.value))}
            className={fieldClass}
          >
            {ADULT_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} Adult{count > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" /> Children
          </label>
          <select
            value={draft.children}
            onChange={(e) => set("children", Number(e.target.value))}
            className={fieldClass}
          >
            {CHILD_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} Child{count === 1 ? "" : "ren"}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" /> Rooms
          </label>
          <select
            value={draft.rooms}
            onChange={(e) => set("rooms", Number(e.target.value))}
            className={fieldClass}
          >
            {ROOM_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} Room{count > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            Meal Plan
          </label>
          <select
            value={draft.mealPlan ?? ""}
            onChange={(e) =>
              set("mealPlan", (e.target.value || null) as StayParams["mealPlan"])
            }
            className={fieldClass}
          >
            <option value="">Any plan</option>
            {Object.values(MEAL_PLANS).map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.code} - {plan.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
      >
        Check Availability <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
