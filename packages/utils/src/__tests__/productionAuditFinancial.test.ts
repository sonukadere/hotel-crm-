import { describe, it, expect } from "vitest";
import {
  calculateRoomGST,
  calculateServiceGST,
  calculateBookingSubtotal,
  calculateFolioBalance,
  calculateCentralizedFolio,
  calculateRedemptionValue,
  calculateRedemptionCap,
  roundCurrency,
} from "../index";
import type { FolioItem, Payment, LoyaltyProgramSettings } from "@hotel/types";

describe("Module 16 — Production Audit: Financial & GST Logic", () => {
  const HOTEL_STATE_MAHARASHTRA = "27";
  const GUEST_STATE_MAHARASHTRA = "27";
  const GUEST_STATE_DELHI = "07";

  describe("1. Room Tariff GST Slabs (<= ₹7,500 @ 12%, > ₹7,500 @ 18%)", () => {
    it("applies 12% GST for room tariff <= ₹7,500 (e.g. ₹5,000/night)", () => {
      const tariff = 5000;
      const gstResult = calculateRoomGST(tariff, HOTEL_STATE_MAHARASHTRA, GUEST_STATE_MAHARASHTRA);

      expect(gstResult.gstRate).toBe(0.12);
      expect(gstResult.totalTax).toBe(600); // 12% of 5000 = 600
      expect(gstResult.sacCode).toBe("996311");
    });

    it("applies exactly 12% GST at the slab threshold of ₹7,500/night", () => {
      const tariff = 7500;
      const gstResult = calculateRoomGST(tariff, HOTEL_STATE_MAHARASHTRA, GUEST_STATE_MAHARASHTRA);

      expect(gstResult.gstRate).toBe(0.12);
      expect(gstResult.totalTax).toBe(900); // 12% of 7500 = 900
    });

    it("applies 18% GST for room tariff > ₹7,500 (e.g. ₹7,501/night)", () => {
      const tariff = 7501;
      const gstResult = calculateRoomGST(tariff, HOTEL_STATE_MAHARASHTRA, GUEST_STATE_MAHARASHTRA);

      expect(gstResult.gstRate).toBe(0.18);
      expect(gstResult.totalTax).toBe(roundCurrency(7501 * 0.18)); // 1350.18
    });

    it("applies 18% GST for luxury suite of ₹15,000/night", () => {
      const tariff = 15000;
      const gstResult = calculateRoomGST(tariff, HOTEL_STATE_MAHARASHTRA, GUEST_STATE_MAHARASHTRA);

      expect(gstResult.gstRate).toBe(0.18);
      expect(gstResult.totalTax).toBe(2700); // 18% of 15000 = 2700
    });
  });

  describe("2. Intra-State vs Inter-State Tax Distribution", () => {
    it("distributes CGST 50% and SGST 50% with IGST=0 for intra-state (MH -> MH)", () => {
      const tariff = 6000; // 12% total = 720
      const gstResult = calculateRoomGST(tariff, HOTEL_STATE_MAHARASHTRA, GUEST_STATE_MAHARASHTRA);

      expect(gstResult.totalTax).toBe(720);
      expect(gstResult.cgstRate).toBe(0.06);
      expect(gstResult.cgstAmount).toBe(360);
      expect(gstResult.sgstRate).toBe(0.06);
      expect(gstResult.sgstAmount).toBe(360);
      expect(gstResult.igstRate).toBe(0);
      expect(gstResult.igstAmount).toBe(0);
    });

    it("allocates IGST 100% with CGST=0 and SGST=0 for inter-state (MH -> DL)", () => {
      const tariff = 10000; // 18% total = 1800
      const gstResult = calculateRoomGST(tariff, HOTEL_STATE_MAHARASHTRA, GUEST_STATE_DELHI);

      expect(gstResult.totalTax).toBe(1800);
      expect(gstResult.cgstRate).toBe(0);
      expect(gstResult.cgstAmount).toBe(0);
      expect(gstResult.sgstRate).toBe(0);
      expect(gstResult.sgstAmount).toBe(0);
      expect(gstResult.igstRate).toBe(0.18);
      expect(gstResult.igstAmount).toBe(1800);
    });
  });

  describe("3. Discounts & Net Taxable Subtotal", () => {
    it("calculates room discount and assesses GST on the discounted taxable value", () => {
      const subtotal = calculateBookingSubtotal({
        basePlanRate: 8000,
        seasonalMultiplier: 1.0,
        weekendMultiplier: 1.0,
        checkInDate: "2026-10-10",
        checkOutDate: "2026-10-11",
        discountPercent: 10, // 10% discount on 8000 = 800
      });

      expect(subtotal.roomSubtotal).toBe(8000);
      expect(subtotal.totalDiscount).toBe(800);
      expect(subtotal.taxableAmount).toBe(7200);

      // Effective nightly rate is 7200 <= 7500 -> 12% slab
      const gst = calculateRoomGST(subtotal.nights[0]!.effectiveNightlyRate, HOTEL_STATE_MAHARASHTRA, GUEST_STATE_MAHARASHTRA);
      expect(gst.gstRate).toBe(0.12);
      expect(gst.totalTax).toBe(864);
      expect(subtotal.taxableAmount + gst.totalTax).toBe(8064);
    });
  });

  describe("4. Folio Balance: Advance, Partial, and Full Settlements", () => {
    it("tracks advance payment reducing the balance due", () => {
      const items: FolioItem[] = [
        {
          id: "item-1",
          folioId: "fol-1",
          itemType: "Room",
          description: "Deluxe Room (1 Night)",
          quantity: 1,
          unitPrice: 5000,
          totalPrice: 5000,
          sacCode: "996311",
          gstRate: 0.12,
          gstAmount: 600,
          isVoided: false,
          postedAt: "2026-10-10T12:00:00Z",
        },
      ];

      // Advance deposit of ₹2,000
      const payments: Payment[] = [
        {
          id: "pay-1",
          paymentNumber: "PAY-001",
          folioId: "fol-1",
          amount: 2000,
          method: "UPI",
          status: "Captured",
          receivedAt: "2026-10-09T10:00:00Z",
          createdAt: "2026-10-09T10:00:00Z",
        },
      ];

      const balance = calculateFolioBalance(items, payments);
      expect(balance.totalDebit).toBe(5600); // 5000 + 600
      expect(balance.totalCredit).toBe(2000);
      expect(balance.balanceDue).toBe(3600);
      expect(balance.isSettled).toBe(false);
    });

    it("handles partial payments and running balance", () => {
      const items: FolioItem[] = [
        {
          id: "item-1",
          folioId: "fol-1",
          itemType: "Room",
          description: "Room",
          quantity: 1,
          unitPrice: 10000,
          totalPrice: 10000,
          sacCode: "996311",
          gstRate: 0.18,
          gstAmount: 1800,
          isVoided: false,
          postedAt: "2026-10-10T12:00:00Z",
        },
      ];

      const payments: Payment[] = [
        {
          id: "pay-1",
          paymentNumber: "PAY-001",
          folioId: "fol-1",
          amount: 5000,
          method: "Card",
          status: "Captured",
          receivedAt: "2026-10-10T10:00:00Z",
          createdAt: "2026-10-10T10:00:00Z",
        },
        {
          id: "pay-2",
          paymentNumber: "PAY-002",
          folioId: "fol-1",
          amount: 3000,
          method: "UPI",
          status: "Captured",
          receivedAt: "2026-10-10T16:00:00Z",
          createdAt: "2026-10-10T16:00:00Z",
        },
      ];

      const balance = calculateFolioBalance(items, payments);
      expect(balance.totalDebit).toBe(11800);
      expect(balance.totalCredit).toBe(8000);
      expect(balance.balanceDue).toBe(3800);
      expect(balance.isSettled).toBe(false);
    });

    it("verifies full payment settlement with zero balance", () => {
      const items: FolioItem[] = [
        {
          id: "item-1",
          folioId: "fol-1",
          itemType: "Room",
          description: "Standard Room",
          quantity: 1,
          unitPrice: 4000,
          totalPrice: 4000,
          sacCode: "996311",
          gstRate: 0.12,
          gstAmount: 480,
          isVoided: false,
          postedAt: "2026-10-10T12:00:00Z",
        },
      ];

      const payments: Payment[] = [
        {
          id: "pay-1",
          paymentNumber: "PAY-001",
          folioId: "fol-1",
          amount: 4480,
          method: "Razorpay",
          status: "Captured",
          receivedAt: "2026-10-10T10:00:00Z",
          createdAt: "2026-10-10T10:00:00Z",
        },
      ];

      const balance = calculateFolioBalance(items, payments);
      expect(balance.totalDebit).toBe(4480);
      expect(balance.totalCredit).toBe(4480);
      expect(balance.balanceDue).toBe(0);
      expect(balance.isSettled).toBe(true);
    });
  });

  describe("5. Loyalty Points Redemption Against Folio", () => {
    const mockSettings: LoyaltyProgramSettings = {
      hotelId: "h-1",
      basePointsPerRupee: 0.05,
      baseRedemptionValuePerPoint: 0.50,
      minPointsForRedemption: 500,
      maxRedemptionPercentPerFolio: 0.50,
      isEarningEnabled: true,
      isRedemptionEnabled: true,
      earnOnPaymentCapture: true,
      eligibleItemTypes: ["Room", "Restaurant"],
      eligibleSacCodes: [],
      isExpiryEnabled: false,
      expiryMonths: 24,
      expiryGracePeriodMonths: 3,
      expiryBasis: "EarnTransactionDate",
      tiers: [
        {
          id: "t-silver",
          hotelId: "h-1",
          tier: "Silver",
          thresholdLifetimeSpendInr: 50000,
          pointsPerRupee: 0.10,
          redemptionValuePerPoint: 0.50,
          monthlyBonusPoints: 0,
          minPointsForRedemption: 500,
          maxRedemptionPercentPerFolio: 0.50,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    it("converts loyalty points into eligible folio credit value (₹)", () => {
      // 1000 points @ ₹0.50/pt = ₹500
      const value = calculateRedemptionValue(1000, mockSettings, "Silver");
      expect(value).toBe(500);

      const cap = calculateRedemptionCap({
        requestedPoints: 1000,
        availablePoints: 2000,
        folioEligibleBalanceInr: 5000,
        settings: mockSettings,
        tier: "Silver",
      });

      expect(cap.cappedPoints).toBe(1000);
      expect(cap.creditInr).toBe(500);
      expect(cap.cappedBy).toBe("NoLimit");
    });

    it("rejects redemption if requested points exceed available balance", () => {
      const cap = calculateRedemptionCap({
        requestedPoints: 1000,
        availablePoints: 0, // no points available
        folioEligibleBalanceInr: 5000,
        settings: mockSettings,
        tier: "Silver",
      });

      expect(cap.cappedPoints).toBe(0);
      expect(cap.cappedBy).toBe("NoPoints");
    });
  });

  describe("6. Multiple Services & Statutory SAC Codes", () => {
    it("calculates correct GST across F&B (5%), Laundry (18%), and Banquet (18%)", () => {
      // Restaurant F&B: SAC 996331 @ 5%
      const food = calculateServiceGST({
        amount: 2000,
        serviceType: "food",
        hotelStateCode: HOTEL_STATE_MAHARASHTRA,
        guestStateCode: GUEST_STATE_MAHARASHTRA,
      });
      expect(food.sacCode).toBe("996331");
      expect(food.gstRate).toBe(0.05);
      expect(food.totalTax).toBe(100);
      expect(food.cgstAmount).toBe(50);
      expect(food.sgstAmount).toBe(50);

      // Laundry: SAC 999799 @ 18%
      const laundry = calculateServiceGST({
        amount: 800,
        serviceType: "laundry",
        hotelStateCode: HOTEL_STATE_MAHARASHTRA,
        guestStateCode: GUEST_STATE_MAHARASHTRA,
      });
      expect(laundry.sacCode).toBe("999799");
      expect(laundry.gstRate).toBe(0.18);
      expect(laundry.totalTax).toBe(144);

      // Banquet: SAC 997212 @ 18%
      const banquet = calculateServiceGST({
        amount: 50000,
        serviceType: "banquet",
        hotelStateCode: HOTEL_STATE_MAHARASHTRA,
        guestStateCode: GUEST_STATE_MAHARASHTRA,
      });
      expect(banquet.sacCode).toBe("997212");
      expect(banquet.gstRate).toBe(0.18);
      expect(banquet.totalTax).toBe(9000);
    });
  });

  describe("7. Split Billing (Corporate vs Personal)", () => {
    it("separates corporate room charges from personal dining charges", () => {
      const items: FolioItem[] = [
        {
          id: "item-1",
          folioId: "fol-1",
          itemType: "Room",
          description: "Room Tariff",
          quantity: 1,
          unitPrice: 10000,
          totalPrice: 10000,
          sacCode: "996311",
          gstRate: 0.18,
          gstAmount: 1800,
          isVoided: false,
          splitTarget: "Corporate",
          postedAt: "2026-10-10T12:00:00Z",
        },
        {
          id: "item-2",
          folioId: "fol-1",
          itemType: "Restaurant",
          description: "Personal Dinner & Drinks",
          quantity: 1,
          unitPrice: 3000,
          totalPrice: 3000,
          sacCode: "996331",
          gstRate: 0.05,
          gstAmount: 150,
          isVoided: false,
          splitTarget: "Personal",
          postedAt: "2026-10-10T20:00:00Z",
        },
      ];

      const breakdown = calculateCentralizedFolio(items, []);
      expect(breakdown.corporate.debit).toBe(11800); // 10000 + 1800
      expect(breakdown.personal.debit).toBe(3150);   // 3000 + 150
      expect(breakdown.totalDebit).toBe(14950);
    });
  });
});
