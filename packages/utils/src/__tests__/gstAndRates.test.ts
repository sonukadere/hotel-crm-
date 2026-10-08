import { describe, it, expect } from "vitest";
import {
  calculateRoomGST,
  calculateServiceGST,
  isValidGSTIN,
  extractStateCodeFromGSTIN,
  validateCorporateGST,
  validateCashCompliance,
  validateInternationalGuest,
  validateIdentityDocument,
  calculateBookingSubtotal,
  calculateEffectiveDailyRate,
  calculateExtraGuestCharges,
  calculateMealPlanCharges,
  calculateDiscount,
  calculateTaxableAmount,
  formatINR,
  numberToIndianWords,
  maskAadhaar,
  isSellableRoomState,
  isOutOfServiceRoomState,
  isOccupiedRoomState,
  canTransitionRoomState,
  checkRoomStateTransition,
} from "../index";

describe("MODULE 3 — Indian GST & Compliance Engine", () => {
  it("calculates 12% room GST for tariff <= ₹7,500 (Intra-state: Maharashtra to Maharashtra)", () => {
    const result = calculateRoomGST({
      tariffPerNightOrTotal: 5000,
      hotelStateCode: "27", // Maharashtra
      guestStateCode: "27",
    });

    expect(result.taxableAmount).toBe(5000);
    expect(result.gstRate).toBe(0.12);
    expect(result.cgstRate).toBe(0.06);
    expect(result.sgstRate).toBe(0.06);
    expect(result.igstRate).toBe(0);
    expect(result.cgstAmount).toBe(300);
    expect(result.sgstAmount).toBe(300);
    expect(result.igstAmount).toBe(0);
    expect(result.grandTotal).toBe(5600);
    expect(result.totalWithTax).toBe(5600);
    expect(result.isInterState).toBe(false);
  });

  it("calculates room GST using direct 3-argument signature from PRD specification", () => {
    // Exact signature: calculateRoomGST(tariffPerNight, hotelStateCode, guestStateCode)
    const result = calculateRoomGST(5000, "27", "27");
    expect(result.taxableAmount).toBe(5000);
    expect(result.gstRate).toBe(0.12);
    expect(result.cgstAmount).toBe(300);
    expect(result.sgstAmount).toBe(300);
    expect(result.totalWithTax).toBe(5600);
  });

  it("applies 0% budget exemption for tariff <= ₹1,000", () => {
    const budgetResult = calculateRoomGST(850, "27", "27");
    expect(budgetResult.gstRate).toBe(0.00);
    expect(budgetResult.totalTax).toBe(0);
    expect(budgetResult.totalWithTax).toBe(850);
  });

  it("calculates 18% room GST for tariff > ₹7,500 (Inter-state: Hotel in MH '27', Guest in DL '07')", () => {
    const result = calculateRoomGST({
      tariffPerNightOrTotal: 10000,
      hotelStateCode: "27", // Maharashtra
      guestStateCode: "07", // Delhi
    });

    expect(result.taxableAmount).toBe(10000);
    expect(result.gstRate).toBe(0.18);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
    expect(result.igstRate).toBe(0.18);
    expect(result.igstAmount).toBe(1800);
    expect(result.totalTax).toBe(1800);
    expect(result.grandTotal).toBe(11800);
    expect(result.isInterState).toBe(true);
  });

  it("calculates restaurant dining service GST at 5% SAC 996331", () => {
    const result = calculateServiceGST({
      amount: 2000,
      serviceType: "food",
      hotelStateCode: "27",
      guestStateCode: "27",
    });

    expect(result.sacCode).toBe("996331");
    expect(result.gstRate).toBe(0.05);
    expect(result.cgstAmount).toBe(50);
    expect(result.sgstAmount).toBe(50);
    expect(result.totalTax).toBe(100);
    expect(result.grandTotal).toBe(2100);
  });

  it("validates valid and invalid 15-digit Indian GSTIN", () => {
    // Valid format: 27AAAAA0000A1Z5 (Valid state 27 MH)
    expect(isValidGSTIN("27AAAAA0000A1Z5")).toBe(true);
    // Invalid state code 99
    expect(isValidGSTIN("99AAAAA0000A1Z5")).toBe(false);
    // Invalid length
    expect(isValidGSTIN("27AAAAA0000A1Z")).toBe(false);
    // Empty
    expect(isValidGSTIN("")).toBe(false);
  });

  it("enforces Cash Compliance under Section 269ST and PAN mandate", () => {
    // Under 50k: No PAN required, valid cash
    const smallCash = validateCashCompliance(40000);
    expect(smallCash.isValid).toBe(true);
    expect(smallCash.requiresPan).toBe(false);

    // Between 50k and 2 Lakhs: PAN required
    const midCashWithoutPan = validateCashCompliance(75000);
    expect(midCashWithoutPan.isValid).toBe(false);
    expect(midCashWithoutPan.requiresPan).toBe(true);

    const midCashWithPan = validateCashCompliance(75000, "ABCDE1234F");
    expect(midCashWithPan.isValid).toBe(true);
    expect(midCashWithPan.requiresPan).toBe(true);

    // 2 Lakhs or above: Illegal cash payment under Section 269ST
    const largeCash = validateCashCompliance(200000, "ABCDE1234F");
    expect(largeCash.isValid).toBe(false);
    expect(largeCash.exceedsCashLimit).toBe(true);
  });

  it("validates B2B GST Corporate Invoice details with state code extraction", () => {
    // Valid corporate GSTIN for Maharashtra
    const gstin = "27AAACT2727Q1ZW";
    expect(isValidGSTIN(gstin)).toBe(true);
    expect(extractStateCodeFromGSTIN(gstin)).toBe("27");

    const validCorporate = validateCorporateGST({
      gstin,
      companyName: "Tata Steel Limited",
      companyAddress: "Bombay House, Mumbai",
      stateCode: "27",
    });
    expect(validCorporate.isValid).toBe(true);
    expect(validCorporate.errors.length).toBe(0);

    const invalidCorporate = validateCorporateGST({
      gstin: "INVALID_GST",
      companyName: "",
    });
    expect(invalidCorporate.isValid).toBe(false);
    expect(invalidCorporate.errors.length).toBeGreaterThan(0);
  });

  it("validates International Guest C-Form requirements with all statutory fields", () => {
    const valid = validateInternationalGuest({
      passportNumber: "Z1234567",
      nationality: "United Kingdom",
      visaNumber: "IND987654",
      visaExpiry: "2027-12-31",
      arrivalDate: "2026-10-01",
      departureDate: "2026-10-15",
      arrivalPort: "BOM Mumbai Airport",
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errors.length).toBe(0);

    const invalid = validateInternationalGuest({
      passportNumber: "",
      nationality: "France",
      visaNumber: "",
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  it("validates identity proof documents: Aadhaar, PAN, Voter ID, Driving License, Passport", () => {
    expect(validateIdentityDocument("Aadhaar", "123456789012").isValid).toBe(true);
    expect(validateIdentityDocument("Aadhaar", "1234").isValid).toBe(false);

    expect(validateIdentityDocument("PAN", "ABCDE1234F").isValid).toBe(true);
    expect(validateIdentityDocument("PAN", "12345").isValid).toBe(false);

    expect(validateIdentityDocument("VoterID", "ABC1234567").isValid).toBe(true);
    expect(validateIdentityDocument("VoterID", "123").isValid).toBe(false);

    expect(validateIdentityDocument("Passport", "Z1234567").isValid).toBe(true);
    expect(validateIdentityDocument("DrivingLicense", "MH1220110012345").isValid).toBe(true);
  });

  it("correctly masks 12-digit Aadhaar numbers", () => {
    expect(maskAadhaar("123456789012")).toBe("XXXX-XXXX-9012");
    expect(maskAadhaar("1234 5678 9012")).toBe("XXXX-XXXX-9012");
  });

  it("formats Indian currency and words properly", () => {
    expect(formatINR(150000)).toContain("1,50,000.00");
    expect(numberToIndianWords(150000)).toBe("Rupees One Lakh Fifty Thousand Only");
  });
});

describe("MODULE 5 — Room Rate & Calculation Engine", () => {
  it("calculates 3-night stay with weekend multiplier and extra adults", () => {
    // 2026-10-09 (Friday) to 2026-10-12 (Monday) = 3 nights (Fri, Sat, Sun)
    const result = calculateBookingSubtotal({
      basePlanRate: 4000,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.25, // Friday & Saturday get 1.25x
      extraAdults: 1,
      extraAdultRatePerNight: 800,
      checkInDate: "2026-10-09",
      checkOutDate: "2026-10-12",
      discountFlat: 500,
    });

    expect(result.totalNights).toBe(3);
    // Friday: 4000 * 1.25 = 5000
    // Saturday: 4000 * 1.25 = 5000
    // Sunday: 4000 * 1.0 = 4000
    // Total room base = 14000
    expect(result.roomSubtotal).toBe(14000);
    // Extra adult: 800 * 3 nights = 2400
    expect(result.extraGuestCharges).toBe(2400);
    // Subtotal = 16400, Discount = 500 => Taxable = 15900
    expect(result.totalDiscount).toBe(500);
    expect(result.taxableAmount).toBe(15900);
    expect(result.nights.length).toBe(3);
  });

  it("calculates effective daily rate with all components", () => {
    const result = calculateEffectiveDailyRate({
      basePlanRate: 5000,
      seasonalMultiplier: 1.2,
      weekendMultiplier: 1.15,
      extraAdults: 2,
      extraChildren: 1,
      extraAdultRatePerNight: 1000,
      extraChildRatePerNight: 500,
      isWeekend: true,
    });
    // roomBaseNightly = 5000 * 1.2 * 1.15 = 5000 * 1.38 = 6900
    expect(result.roomBaseNightly).toBe(6900);
    expect(result.extraAdultCharges).toBe(2000);
    expect(result.extraChildCharges).toBe(500);
    expect(result.totalDailyRate).toBe(9400);
  });

  it("calculates extra guest charges over multiple nights", () => {
    const total = calculateExtraGuestCharges(2, 800, 1, 400, 3);
    // adults: 2*800*3=4800, children: 1*400*3=1200, total 6000
    expect(total).toBe(6000);
  });

  it("calculates meal plan charges", () => {
    const total = calculateMealPlanCharges(1200, 3, 2); // 1200 * 3 * 2 = 7200
    expect(total).toBe(7200);
  });

  it("calculates discount with both percent and flat", () => {
    const discount = calculateDiscount(10000, 10, 500); // 1000 + 500 = 1500
    expect(discount).toBe(1500);
  });

  it("calculates taxable amount after discount", () => {
    const taxable = calculateTaxableAmount(10000, 1500);
    expect(taxable).toBe(8500);
  });

  it("supports seasonal pricing variations", () => {
    const result = calculateBookingSubtotal({
      basePlanRate: 3000,
      seasonalMultiplier: 1.5,
      weekendMultiplier: 1.0,
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-03", // 2 nights, Mon/Tue
    });
    expect(result.totalNights).toBe(2);
    expect(result.roomSubtotal).toBe(9000); // 3000 * 1.5 * 2
  });

  it("handles meal plans in calculation", () => {
    const result = calculateBookingSubtotal({
      basePlanRate: 2000,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.0,
      mealPlanRatePerPersonPerNight: 800,
      adultCount: 2,
      childCount: 0,
      checkInDate: "2026-10-13",
      checkOutDate: "2026-10-15", // 2 nights
    });
    expect(result.totalNights).toBe(2);
    expect(result.roomSubtotal).toBe(4000);
    expect(result.mealPlanCharges).toBe(3200); // 800 * 2 * 2
    expect(result.taxableAmount).toBe(7200);
  });

  it("handles extra children charges", () => {
    const result = calculateBookingSubtotal({
      basePlanRate: 3000,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.0,
      extraChildren: 2,
      extraChildRatePerNight: 600,
      checkInDate: "2026-10-13",
      checkOutDate: "2026-10-16", // 3 nights
    });
    expect(result.extraGuestCharges).toBe(3600); // 2 * 600 * 3
  });

  it("supports positional argument signature for calculateEffectiveDailyRate", () => {
    // calculateEffectiveDailyRate(basePlanRate, seasonal, weekend, extraAdults, extraChildren, adultRate, childRate, isWeekend)
    const result = calculateEffectiveDailyRate(4000, 1.2, 1.25, 1, 1, 800, 400, true);
    // base: 4000 * 1.2 * 1.25 = 6000
    // adults: 800, children: 400 => total: 7200
    expect(result.roomBaseNightly).toBe(6000);
    expect(result.extraAdultCharges).toBe(800);
    expect(result.extraChildCharges).toBe(400);
    expect(result.totalDailyRate).toBe(7200);
  });

  it("complies strictly with PRD rate engine output structure and does NOT calculate GST", () => {
    const result = calculateBookingSubtotal({
      basePlanRate: 5000,
      seasonalMultiplier: 1.1,
      weekendMultiplier: 1.2,
      extraAdults: 1,
      extraChildren: 1,
      extraAdultRatePerNight: 1000,
      extraChildRatePerNight: 500,
      checkInDate: "2026-10-16", // Friday
      checkOutDate: "2026-10-18", // Sunday (2 nights: Friday, Saturday)
      mealPlan: "CP",
      adultCount: 2,
      childCount: 1,
      discount: 800, // Flat discount using input.discount
    });

    // Check all PRD required output fields
    expect(result).toHaveProperty("nights");
    expect(result).toHaveProperty("roomSubtotal");
    expect(result).toHaveProperty("extraGuestCharges");
    expect(result).toHaveProperty("mealPlanCharges");
    expect(result).toHaveProperty("discount");
    expect(result).toHaveProperty("taxableAmount");

    // Both Friday & Saturday are weekend nights (1.2 multiplier)
    // Daily base: 5000 * 1.1 * 1.2 = 6600 nightly => 13200 for 2 nights
    expect(result.roomSubtotal).toBe(13200);

    // Extra guests: (1 * 1000 + 1 * 500) * 2 nights = 3000
    expect(result.extraGuestCharges).toBe(3000);

    // CP default: 500 per guest per night * 3 guests * 2 nights = 3000
    expect(result.mealPlanCharges).toBe(3000);

    // Subtotal = 13200 + 3000 + 3000 = 19200
    // Discount = 800 => Taxable = 18400
    expect(result.discount).toBe(800);
    expect(result.taxableAmount).toBe(18400);

    // Confirm GST is completely omitted from the rate engine
    expect((result as any).gst).toBeUndefined();
    expect((result as any).cgstAmount).toBeUndefined();
    expect((result as any).totalTax).toBeUndefined();

    // Nightly breakdown verification
    expect(result.nights.length).toBe(2);
    expect(result.nights[0]?.isWeekend).toBe(true);
    expect(result.nights[1]?.isWeekend).toBe(true);
  });
});

describe("MODULE 4 — Room Catalog & Inventory State Machine & Rules", () => {
  it("verifies all 6 Room Statuses are recognized correctly", () => {
    const validStatuses = ["Clean", "Dirty", "Occupied", "Blocked", "Maintenance", "Available"] as const;
    expect(validStatuses).toHaveLength(6);

    // Sellable rooms
    expect(isSellableRoomState("Available")).toBe(true);
    expect(isSellableRoomState("Clean")).toBe(true);
    expect(isSellableRoomState("Dirty")).toBe(true);
    expect(isSellableRoomState("Occupied")).toBe(false);
    expect(isSellableRoomState("Blocked")).toBe(false);
    expect(isSellableRoomState("Maintenance")).toBe(false);

    // Out of service
    expect(isOutOfServiceRoomState("Blocked")).toBe(true);
    expect(isOutOfServiceRoomState("Maintenance")).toBe(true);
    expect(isOutOfServiceRoomState("Available")).toBe(false);

    // In-house occupied
    expect(isOccupiedRoomState("Occupied")).toBe(true);
    expect(isOccupiedRoomState("Available")).toBe(false);
  });

  it("enforces legal status transitions and guards occupied rooms", () => {
    // Dirty -> Clean housekeeping turnover is valid
    expect(canTransitionRoomState("Dirty", "Clean")).toBe(true);
    // Clean -> Available inspection is valid
    expect(canTransitionRoomState("Clean", "Available")).toBe(true);
    // Available -> Blocked is valid
    expect(canTransitionRoomState("Available", "Blocked")).toBe(true);
    // Available -> Maintenance is valid
    expect(canTransitionRoomState("Available", "Maintenance")).toBe(true);

    // Manual transition check for occupied room cannot be forced directly to Available without checkout
    const occupiedCheck = checkRoomStateTransition({
      from: "Occupied",
      to: "Available",
      hasInHouseBooking: true,
    });
    expect(occupiedCheck.allowed).toBe(false);

    // Dirty room can be transitioned to Clean
    const dirtyCheck = checkRoomStateTransition({
      from: "Dirty",
      to: "Clean",
    });
    expect(dirtyCheck.allowed).toBe(true);
  });

  it("handles all 4 standard meal plan codes (EP, CP, MAP, AP) in rate calculations", () => {
    const mealPlans = ["EP", "CP", "MAP", "AP"] as const;
    expect(mealPlans).toContain("EP");
    expect(mealPlans).toContain("CP");
    expect(mealPlans).toContain("MAP");
    expect(mealPlans).toContain("AP");

    // EP: Room only (0 meal charge)
    const epCharges = calculateMealPlanCharges(0, 2, 2);
    expect(epCharges).toBe(0);

    // CP: Buffet Breakfast (e.g. ₹500/guest/night)
    const cpCharges = calculateMealPlanCharges(500, 2, 2);
    expect(cpCharges).toBe(2000); // 500 * 2 * 2

    // MAP: Breakfast + Lunch/Dinner (e.g. ₹1,200/guest/night)
    const mapCharges = calculateMealPlanCharges(1200, 3, 2);
    expect(mapCharges).toBe(7200); // 1200 * 3 * 2

    // AP: All 3 meals (e.g. ₹1,800/guest/night)
    const apCharges = calculateMealPlanCharges(1800, 2, 3);
    expect(apCharges).toBe(10800); // 1800 * 2 * 3
  });
});

