import React, { useState, useEffect } from "react";
import { Modal, Button, Input } from "@hotel/ui";
import {
  calculateBookingSubtotal,
  calculateRoomGST,
  formatINR,
  roundCurrency,
} from "@hotel/utils";
import type { Room, RoomType, RatePlan, MealPlan, IdentityType } from "@hotel/types";
import { searchGuestByMobileApi, createReservationApi } from "../../services/frontDeskApi";
import { Search, Calendar, Check, Tag } from "lucide-react";

interface CreateReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  hotelStateCode?: string;
  preselectedRoomId?: string;
  onSuccess: (msg: string) => void;
}

export function CreateReservationModal({
  isOpen,
  onClose,
  rooms,
  roomTypes,
  ratePlans,
  hotelStateCode = "27",
  preselectedRoomId,
  onSuccess,
}: CreateReservationModalProps) {
  // 1. Guest search / Details
  const [mobile, setMobile] = useState("");
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [guestStateCode, setGuestStateCode] = useState("27");
  const [identityType, setIdentityType] = useState<IdentityType>("Aadhaar");
  const [idNumber, setIdNumber] = useState("");

  // 2. Dates
  const today = new Date().toISOString().split("T")[0]!;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]!;
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);

  // 3. Room & Rate Plan & Meal Plan
  const [selectedRoomId, setSelectedRoomId] = useState(preselectedRoomId || "");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(roomTypes[0]?.id || "");
  const [selectedRatePlanId, setSelectedRatePlanId] = useState(ratePlans[0]?.id || "");
  const [mealPlan, setMealPlan] = useState<MealPlan>("EP");

  // 4. Guests
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // 5. Discount & Deposit
  const [discountFlat, setDiscountFlat] = useState("0");
  const discountPercent = "0";
  const [advanceDeposit, setAdvanceDeposit] = useState("2000");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [specialRequests, setSpecialRequests] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Filter available rooms matching selected room type
  const matchedRooms = rooms.filter(
    (r) => r.isActive && r.roomTypeId === selectedRoomTypeId && r.status !== "Occupied",
  );

  const matchedRatePlans = ratePlans.filter((p) => p.roomTypeId === selectedRoomTypeId);

  // Set initial selections when room type changes
  useEffect(() => {
    if (matchedRooms.length > 0 && !matchedRooms.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(matchedRooms[0]!.id);
    }
    if (matchedRatePlans.length > 0 && !matchedRatePlans.some((p) => p.id === selectedRatePlanId)) {
      setSelectedRatePlanId(matchedRatePlans[0]!.id);
      setMealPlan(matchedRatePlans[0]!.mealPlan);
    }
  }, [selectedRoomTypeId, matchedRooms, matchedRatePlans]);

  // Guest lookup
  const handleGuestSearch = async () => {
    const clean = mobile.replace(/[^0-9]/g, "");
    if (clean.length < 10) return;
    setIsSearchingGuest(true);
    try {
      const g = await searchGuestByMobileApi(clean);
      if (g) {
        setFullName(g.fullName);
        setEmail(g.email || "");
        setCity(g.city || "Mumbai");
        if (g.stateCode) setGuestStateCode(g.stateCode);
        if (g.identities && g.identities.length > 0) {
          setIdentityType(g.identities[0]!.identityType as IdentityType);
          setIdNumber(g.identities[0]!.maskedIdNumber || g.identities[0]!.idNumber);
        }
      }
    } finally {
      setIsSearchingGuest(false);
    }
  };

  // 6. Real-time Calculation (Base Rate, Seasonal, Weekend, Extra Guests, Meal Plan, Discount, and GST Engine)
  const currentRatePlan = ratePlans.find((p) => p.id === selectedRatePlanId) || ratePlans[0];
  const baseRate = currentRatePlan ? Number(currentRatePlan.baseRate) : 4200;
  const seasonalMultiplier = currentRatePlan ? Number(currentRatePlan.seasonalMultiplier) : 1.0;
  const weekendMultiplier = currentRatePlan ? Number(currentRatePlan.weekendMultiplier) : 1.15;
  const extraAdultRate = currentRatePlan ? Number(currentRatePlan.extraAdultRate) : 800;
  const extraChildRate = currentRatePlan ? Number(currentRatePlan.extraChildRate) : 400;

  // Meal Plan pricing default
  const defaultMealRates: Record<MealPlan, number> = {
    EP: 0,
    CP: 500,
    MAP: 1200,
    AP: 1800,
  };
  const mealPlanRate = defaultMealRates[mealPlan] ?? 0;

  // Rate calculation from Module 5 engine
  const rateCalc = calculateBookingSubtotal({
    basePlanRate: baseRate,
    seasonalMultiplier,
    weekendMultiplier,
    extraAdults: Math.max(0, adults - 2),
    extraChildren: children,
    extraAdultRatePerNight: extraAdultRate,
    extraChildRatePerNight: extraChildRate,
    checkInDate,
    checkOutDate,
    mealPlan,
    mealPlanRatePerPersonPerNight: mealPlanRate,
    adultCount: adults,
    childCount: children,
    discountFlat: parseFloat(discountFlat) || 0,
    discountPercent: parseFloat(discountPercent) || 0,
  });

  // Average per-night tariff for room slab determination
  const avgNightlyTariff =
    rateCalc.totalNights > 0 ? rateCalc.taxableAmount / rateCalc.totalNights : rateCalc.taxableAmount;

  // GST calculation from Module 3 engine
  const gstBreakdown = calculateRoomGST({
    tariffPerNightOrTotal: avgNightlyTariff,
    hotelStateCode,
    guestStateCode,
  });

  // Scale total tax by night count
  const totalTaxAmount = roundCurrency(gstBreakdown.totalTax * Math.max(1, rateCalc.totalNights));
  const grandTotal = roundCurrency(rateCalc.taxableAmount + totalTaxAmount);
  const depositNum = parseFloat(advanceDeposit) || 0;
  const balanceDue = roundCurrency(Math.max(0, grandTotal - depositNum));

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Guest Full Name is required");
      return;
    }
    if (mobile.replace(/[^0-9]/g, "").length !== 10) {
      setError("10-digit mobile number is mandatory");
      return;
    }

    setIsSubmitting(true);
    try {
      await createReservationApi({
        hotelId: currentRatePlan?.hotelId || "hotel-1",
        roomId: selectedRoomId || undefined,
        roomTypeId: selectedRoomTypeId,
        ratePlanId: selectedRatePlanId,
        checkInDate,
        checkOutDate,
        adults,
        children,
        mealPlan,
        specialRequests,
        discountFlat: parseFloat(discountFlat) || 0,
        discountPercent: parseFloat(discountPercent) || 0,
        guest: {
          fullName: fullName.trim(),
          mobile: mobile.replace(/[^0-9]/g, ""),
          email: email.trim() || undefined,
          city,
          stateCode: guestStateCode,
          identityType,
          idNumber: !/[*X]/.test(idNumber) ? idNumber.trim() || undefined : undefined,
        },
        advancePayment: depositNum > 0 ? {
          amount: depositNum,
          method: paymentMethod,
          transactionRef: `Advance Deposit (${paymentMethod})`,
        } : undefined,
      });

      onSuccess(`Reservation confirmed for ${fullName}! Booking confirmed with ₹${formatINR(depositNum)} advance.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to confirm reservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Reservation & Booking"
      description="12-step reservation engine: rate plans, seasonal/weekend multipliers, meal plans, GST calculation, and deposit collection."
      maxWidth="xl"
    >
      <form onSubmit={handleConfirmReservation} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* 1. GUEST INFORMATION */}
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            1. Guest Details & 10-Digit Mobile Search
          </span>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Mobile Number (10 digits)"
                placeholder="e.g. 9820012345"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                maxLength={10}
                required
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGuestSearch}
                disabled={isSearchingGuest || mobile.length < 10}
                className="h-9 border-slate-700"
              >
                <Search className="w-3.5 h-3.5 mr-1" />
                Search
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Guest Full Name"
              placeholder="e.g. Vikram Singhania"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              label="Email Address (Optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* 2. DATES & ROOM TYPE */}
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> 2. Dates, Room Selection & Rate Plan
          </span>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Check-In Date"
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              required
            />
            <Input
              label="Check-Out Date"
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Room Type</label>
              <select
                value={selectedRoomTypeId}
                onChange={(e) => setSelectedRoomTypeId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({formatINR(rt.basePrice)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Room (Optional)</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="">Auto-Assign at Check-In</option>
                {matchedRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} ({r.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Rate Plan & Meal Plan</label>
              <select
                value={selectedRatePlanId}
                onChange={(e) => {
                  setSelectedRatePlanId(e.target.value);
                  const p = ratePlans.find((plan) => plan.id === e.target.value);
                  if (p) setMealPlan(p.mealPlan);
                }}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                {matchedRatePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mealPlan})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <Input
              label="Adults (Capacity 1-4)"
              type="number"
              min={1}
              max={6}
              value={adults}
              onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)}
            />
            <Input
              label="Children"
              type="number"
              min={0}
              max={4}
              value={children}
              onChange={(e) => setChildren(parseInt(e.target.value, 10) || 0)}
            />
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Meal Plan</label>
              <select
                value={mealPlan}
                onChange={(e) => setMealPlan(e.target.value as MealPlan)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="EP">EP (Room Only)</option>
                <option value="CP">CP (Buffet Breakfast)</option>
                <option value="MAP">MAP (Breakfast + Dinner)</option>
                <option value="AP">AP (Full Board 3 Meals)</option>
              </select>
            </div>
            <Input
              label="Flat Discount (₹)"
              type="number"
              value={discountFlat}
              onChange={(e) => setDiscountFlat(e.target.value)}
            />
          </div>

          <div className="pt-1">
            <Input
              label="Special Requests (e.g. Quiet room, late check-in, extra bed)"
              placeholder="e.g. Early check-in requested, high floor, non-smoking"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
            />
          </div>
        </div>

        {/* 3. REAL-TIME RATE & GST BREAKDOWN CARDS */}
        <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Live Quote: Rate & GST Engine Breakdown
            </span>
            <span className="text-xs text-slate-400">
              {rateCalc.totalNights} Night(s) • Base {formatINR(baseRate)}/n
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Room Base Charges:</span>
              <span className="text-white font-bold">{formatINR(rateCalc.roomSubtotal)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Extra Guest Charges:</span>
              <span className="text-white font-bold">{formatINR(rateCalc.extraGuestCharges)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Meal Plan Charges:</span>
              <span className="text-white font-bold">{formatINR(rateCalc.mealPlanCharges)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Total Discount:</span>
              <span className="text-emerald-400 font-bold">-{formatINR(rateCalc.discount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Net Taxable Amount:</span>
              <span className="text-white font-bold text-sm">{formatINR(rateCalc.taxableAmount)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">
                GST ({(gstBreakdown.gstRate * 100).toFixed(0)}% • {gstBreakdown.isInterState ? "IGST" : "CGST+SGST"}):
              </span>
              <span className="text-amber-400 font-bold text-sm">+{formatINR(totalTaxAmount)}</span>
            </div>
            <div>
              <span className="text-amber-400 block text-[11px] font-bold">Grand Total (Inc. Taxes):</span>
              <span className="text-amber-400 font-black text-base">{formatINR(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* 4. ADVANCE DEPOSIT & CONFIRMATION */}
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            4. Advance Deposit & Payment Capture
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Advance Deposit (₹)"
              type="number"
              value={advanceDeposit}
              onChange={(e) => setAdvanceDeposit(e.target.value)}
            />

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Payment Channel</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="UPI">UPI / Instant QR</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank_Transfer">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Balance Payable at Check-In</label>
              <div className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center font-bold text-sm text-slate-200 font-mono">
                {formatINR(balanceDue)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" size="sm" disabled={isSubmitting} className="font-bold">
            <Check className="w-4 h-4 mr-1" />
            {isSubmitting ? "Creating Reservation..." : "Confirm Booking & Issue Folio"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
