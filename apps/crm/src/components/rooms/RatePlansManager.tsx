import React, { useState } from "react";
import { Button, Input, Modal } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type { RatePlan, RoomType, MealPlan } from "@hotel/types";
import { Plus, Check, Edit2 } from "lucide-react";

interface RatePlansManagerProps {
  ratePlans: RatePlan[];
  roomTypes: RoomType[];
  onAddRatePlan: (data: Partial<RatePlan>) => Promise<void> | void;
  onUpdateRatePlan: (id: string, data: Partial<RatePlan>) => Promise<void> | void;
}

const MEAL_PLAN_DESCRIPTIONS: Record<MealPlan, { name: string; desc: string; badgeColor: string }> = {
  EP: { name: "European Plan", desc: "Room Only (No Meals Included)", badgeColor: "bg-slate-800 text-slate-300" },
  CP: { name: "Continental Plan", desc: "Includes Buffet Breakfast", badgeColor: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
  MAP: { name: "Modified American Plan", desc: "Breakfast + Choice of Lunch or Dinner", badgeColor: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
  AP: { name: "American Plan", desc: "All 3 Meals Included (Full Board)", badgeColor: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
};

export function RatePlansManager({
  ratePlans,
  roomTypes,
  onAddRatePlan,
  onUpdateRatePlan,
}: RatePlansManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);

  // Form State
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id || "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mealPlan, setMealPlan] = useState<MealPlan>("EP");
  const [baseRate, setBaseRate] = useState("");
  const [seasonalMultiplier, setSeasonalMultiplier] = useState("1.00");
  const [weekendMultiplier, setWeekendMultiplier] = useState("1.15");
  const [extraAdultRate, setExtraAdultRate] = useState("800");
  const [extraChildRate, setExtraChildRate] = useState("400");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingPlan(null);
    setRoomTypeId(roomTypes[0]?.id || "");
    setCode("");
    setName("");
    setMealPlan("EP");
    setBaseRate(String(roomTypes[0]?.basePrice || 4500));
    setSeasonalMultiplier("1.00");
    setWeekendMultiplier("1.15");
    setExtraAdultRate("800");
    setExtraChildRate("400");
    setIsActive(true);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (plan: RatePlan) => {
    setEditingPlan(plan);
    setRoomTypeId(plan.roomTypeId);
    setCode(plan.code);
    setName(plan.name);
    setMealPlan(plan.mealPlan);
    setBaseRate(String(plan.baseRate));
    setSeasonalMultiplier(String(plan.seasonalMultiplier));
    setWeekendMultiplier(String(plan.weekendMultiplier));
    setExtraAdultRate(String(plan.extraAdultRate));
    setExtraChildRate(String(plan.extraChildRate));
    setIsActive(plan.isActive);
    setError("");
    setIsModalOpen(true);
  };

  const handleRoomTypeChange = (id: string) => {
    setRoomTypeId(id);
    const matched = roomTypes.find((rt) => rt.id === id);
    if (matched && !editingPlan) {
      setBaseRate(String(matched.basePrice));
      setCode(`${matched.code}-${mealPlan}`);
      setName(`${matched.name} - ${mealPlan}`);
    }
  };

  const handleMealPlanChange = (mp: MealPlan) => {
    setMealPlan(mp);
    const matched = roomTypes.find((rt) => rt.id === roomTypeId);
    if (matched && !editingPlan) {
      setCode(`${matched.code}-${mp}`);
      setName(`${matched.name} - ${mp} (${MEAL_PLAN_DESCRIPTIONS[mp].name})`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code.trim() || !name.trim()) {
      setError("Rate Plan Code and Name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<RatePlan> = {
        roomTypeId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        mealPlan,
        baseRate: parseFloat(baseRate) || 4000,
        seasonalMultiplier: parseFloat(seasonalMultiplier) || 1.0,
        weekendMultiplier: parseFloat(weekendMultiplier) || 1.15,
        extraAdultRate: parseFloat(extraAdultRate) || 800,
        extraChildRate: parseFloat(extraChildRate) || 400,
        isActive,
      };

      if (editingPlan) {
        await onUpdateRatePlan(editingPlan.id, payload);
      } else {
        await onAddRatePlan(payload);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save rate plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Rate Plans & Meal Plan Configurations
          </h3>
          <p className="text-xs text-slate-400">
            Define tariffs with seasonal multipliers, weekend surcharges, extra bed charges, and meal plans (EP, CP, MAP, AP).
          </p>
        </div>
        <Button variant="gold" size="sm" onClick={openAddModal} className="flex items-center gap-1.5 font-semibold">
          <Plus className="w-4 h-4" /> Add Rate Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {ratePlans.map((plan) => {
          const matchedType = roomTypes.find((rt) => rt.id === plan.roomTypeId);
          const mealMeta = MEAL_PLAN_DESCRIPTIONS[plan.mealPlan] || MEAL_PLAN_DESCRIPTIONS.EP;

          return (
            <div
              key={plan.id}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-amber-500/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${mealMeta.badgeColor}`}>
                        {plan.mealPlan}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 font-semibold">{plan.code}</span>
                    </div>
                    <h4 className="font-bold text-white text-sm mt-1">{plan.name}</h4>
                    <p className="text-xs text-amber-400/90 font-medium mt-0.5">
                      Applicable Room: {matchedType?.name || "All Standard"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 italic">{mealMeta.desc}</p>
                  </div>
                  <button
                    onClick={() => openEditModal(plan)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Edit Rate Plan"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Base Rate</span>
                    <span className="font-bold text-white text-sm">{formatINR(plan.baseRate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Weekend Surge</span>
                    <span className="font-semibold text-amber-400">
                      {Math.round((plan.weekendMultiplier - 1) * 100)}% ({plan.weekendMultiplier}x)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Season Multiplier</span>
                    <span className="font-semibold text-emerald-400">{plan.seasonalMultiplier}x</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-xs">
                  <div className="text-slate-400">
                    Extra Adult: <span className="font-semibold text-slate-200">{formatINR(plan.extraAdultRate)}</span>
                  </div>
                  <div className="text-slate-400">
                    Extra Child: <span className="font-semibold text-slate-200">{formatINR(plan.extraChildRate)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    plan.isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {plan.isActive ? "Active Plan" : "Archived Plan"}
                </span>
                <button
                  onClick={() => openEditModal(plan)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                >
                  Edit Multipliers &gt;
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Rate Plan Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? `Edit Rate Plan: ${editingPlan.name}` : "Create New Rate Plan"}
        description="Configure seasonal dynamic multipliers, weekend tariffs, extra guest rates, and meal package."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Room Category
              </label>
              <select
                value={roomTypeId}
                onChange={(e) => handleRoomTypeChange(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({rt.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Meal Plan (Indian Standard)
              </label>
              <select
                value={mealPlan}
                onChange={(e) => handleMealPlanChange(e.target.value as MealPlan)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="EP">EP — European Plan (Room Only)</option>
                <option value="CP">CP — Continental Plan (With Breakfast)</option>
                <option value="MAP">MAP — Modified American Plan (Breakfast + Lunch/Dinner)</option>
                <option value="AP">AP — American Plan (All Meals)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Plan Code"
              placeholder="e.g. DLX-CP"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Input
              label="Plan Name"
              placeholder="e.g. Deluxe Continental with Breakfast"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Base Rate (₹ per night)"
              type="number"
              placeholder="6500"
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              required
            />
            <Input
              label="Seasonal Multiplier"
              type="number"
              step="0.05"
              placeholder="1.00"
              value={seasonalMultiplier}
              onChange={(e) => setSeasonalMultiplier(e.target.value)}
              helperText="1.25 = 25% peak surge"
              required
            />
            <Input
              label="Weekend Multiplier"
              type="number"
              step="0.05"
              placeholder="1.15"
              value={weekendMultiplier}
              onChange={(e) => setWeekendMultiplier(e.target.value)}
              helperText="1.15 = 15% Fri-Sun surge"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Extra Adult Rate (₹)"
              type="number"
              value={extraAdultRate}
              onChange={(e) => setExtraAdultRate(e.target.value)}
              placeholder="800"
              required
            />
            <Input
              label="Extra Child Rate (₹)"
              type="number"
              value={extraChildRate}
              onChange={(e) => setExtraChildRate(e.target.value)}
              placeholder="400"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="plan-active-toggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="plan-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active Plan in Reservation Engine
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting} className="flex items-center gap-1.5">
              {isSubmitting ? <span>Saving...</span> : <><Check className="w-4 h-4" /> Save Rate Plan</>}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
