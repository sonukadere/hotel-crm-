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
});
