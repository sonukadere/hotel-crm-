import { describe, it, expect } from "vitest";
import {
  calculateCentralizedFolio,
  SAC_BY_ITEM_TYPE,
  DEFAULT_GST_RATE_BY_ITEM_TYPE,
} from "../folio/folioEngine";
import type { FolioItem, Payment, FolioItemType, PaymentMethod } from "@hotel/types";

function mockItem(
  partial: Partial<FolioItem> & { itemType: FolioItemType; totalPrice: number },
): FolioItem {
  return {
    id: partial.id || "item-" + Math.random().toString(36).substring(7),
    folioId: partial.folioId || "folio-1",
    itemType: partial.itemType,
    description: partial.description || "Description",
    quantity: partial.quantity || 1,
    unitPrice: partial.unitPrice ?? partial.totalPrice,
    totalPrice: partial.totalPrice,
    sacCode: partial.sacCode || SAC_BY_ITEM_TYPE[partial.itemType] || "999799",
    gstRate: partial.gstRate || DEFAULT_GST_RATE_BY_ITEM_TYPE[partial.itemType] || 0.18,
    gstAmount: partial.gstAmount || 0,
    isVoided: partial.isVoided ?? false,
    postedAt: partial.postedAt || new Date().toISOString(),
    splitTarget: partial.splitTarget,
    voidReason: partial.voidReason,
  };
}

function mockPayment(
  partial: Partial<Payment> & { amount: number; method: PaymentMethod },
): Payment {
  return {
    id: partial.id || "pay-" + Math.random().toString(36).substring(7),
    paymentNumber: partial.paymentNumber || "PAY-001",
    folioId: partial.folioId || "folio-1",
    amount: partial.amount,
    method: partial.method,
    status: partial.status || "Captured",
    notes: partial.notes,
    receivedAt: partial.receivedAt || new Date().toISOString(),
    createdAt: partial.createdAt || new Date().toISOString(),
    panNumber: partial.panNumber,
    transactionRef: partial.transactionRef,
  };
}

describe("MODULE 7 — Folio, Billing & Invoicing Engine", () => {
  describe("SAC Code & Default GST Rate Mapping", () => {
    it("maps all 9 statutory hospitality item types to correct SAC codes", () => {
      expect(SAC_BY_ITEM_TYPE.Room).toBe("996311");
      expect(SAC_BY_ITEM_TYPE.Food).toBe("996331");
      expect(SAC_BY_ITEM_TYPE.Restaurant).toBe("996331");
      expect(SAC_BY_ITEM_TYPE.InRoomDining).toBe("996331");
      expect(SAC_BY_ITEM_TYPE.Laundry).toBe("999799");
      expect(SAC_BY_ITEM_TYPE.Spa).toBe("999722");
      expect(SAC_BY_ITEM_TYPE.Housekeeping).toBe("999799");
      expect(SAC_BY_ITEM_TYPE.Banquet).toBe("997212");
      expect(SAC_BY_ITEM_TYPE.OtherService).toBe("999799");
    });

    it("assigns expected default tax rates per category", () => {
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.Room).toBe(0.12);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.Food).toBe(0.05);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.Restaurant).toBe(0.05);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.InRoomDining).toBe(0.05);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.Laundry).toBe(0.18);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.Spa).toBe(0.18);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.Housekeeping).toBe(0.18);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.Banquet).toBe(0.18);
      expect(DEFAULT_GST_RATE_BY_ITEM_TYPE.OtherService).toBe(0.18);
    });
  });

  describe("Centralized Folio Calculation Formula", () => {
    it("computes totalDebit = discountedRoomSubtotal + totalRoomGST + totalServicesCharges + totalServicesGST", () => {
      const items: FolioItem[] = [
        mockItem({
          itemType: "Room",
          description: "Deluxe Room (1 Night)",
          sacCode: "996311",
          totalPrice: 5000,
          gstAmount: 600,
          splitTarget: "Corporate",
        }),
        mockItem({
          itemType: "Discount",
          description: "Corporate Rate Adjustment",
          sacCode: "996311",
          totalPrice: -500,
          gstAmount: -60,
          splitTarget: "Corporate",
        }),
        mockItem({
          itemType: "Restaurant",
          description: "Dinner Buffet",
          sacCode: "996331",
          totalPrice: 2000,
          gstAmount: 100,
          splitTarget: "Personal",
        }),
        mockItem({
          itemType: "Laundry",
          description: "Dry Cleaning",
          sacCode: "999799",
          totalPrice: 800,
          gstAmount: 144,
          splitTarget: "Personal",
        }),
      ];

      const payments: Payment[] = [];

      const result = calculateCentralizedFolio(items, payments);

      // Room:
      // roomSubtotal: 5000
      // roomDiscount: 500
      // discountedRoomSubtotal: 4500
      // totalRoomGST: 600 - 60 = 540
      expect(result.roomSubtotal).toBe(5000);
      expect(result.roomDiscount).toBe(500);
      expect(result.discountedRoomSubtotal).toBe(4500);
      expect(result.totalRoomGST).toBe(540);

      // Services:
      // Restaurant: 2000 taxable, 100 GST
      // Laundry: 800 taxable, 144 GST
      // totalServicesCharges: 2800
      // totalServicesGST: 244
      expect(result.totalServicesCharges).toBe(2800);
      expect(result.totalServicesGST).toBe(244);

      // totalDebit = 4500 + 540 + 2800 + 244 = 8084
      expect(result.totalDebit).toBe(8084);
      expect(result.totalCredit).toBe(0);
      expect(result.balanceDue).toBe(8084);
      expect(result.isSettled).toBe(false);
    });

    it("computes totalCredit = advanceDeposit + razorpayPayments + cashCollected + loyaltyRedeemed + otherPayments", () => {
      const items: FolioItem[] = [
        mockItem({
          itemType: "Room",
          description: "Suite Night",
          sacCode: "996311",
          totalPrice: 10000,
          gstAmount: 1800,
        }),
      ];

      const payments: Payment[] = [
        mockPayment({
          method: "UPI",
          amount: 3000,
          notes: "Booking advance deposit",
          status: "Captured",
        }),
        mockPayment({
          method: "Razorpay",
          amount: 4000,
          status: "Captured",
        }),
        mockPayment({
          method: "Cash",
          amount: 2000,
          status: "Captured",
        }),
        mockPayment({
          method: "Other",
          amount: 800,
          status: "Captured",
        }),
      ];

      const result = calculateCentralizedFolio(items, payments);

      expect(result.totalDebit).toBe(11800);
      expect(result.advanceDeposit).toBe(3000);
      expect(result.razorpayPayments).toBe(4000);
      expect(result.cashCollected).toBe(2000);
      expect(result.totalCredit).toBe(9800);
      expect(result.balanceDue).toBe(2000);
      expect(result.isSettled).toBe(false);
    });

    it("settles folio when credits equal or exceed debits", () => {
      const items: FolioItem[] = [
        mockItem({
          itemType: "Room",
          description: "Standard Room",
          sacCode: "996311",
          totalPrice: 3000,
          gstAmount: 360,
        }),
      ];

      const payments: Payment[] = [
        mockPayment({
          method: "Card",
          amount: 3360,
          status: "Captured",
        }),
      ];

      const result = calculateCentralizedFolio(items, payments);
      expect(result.totalDebit).toBe(3360);
      expect(result.totalCredit).toBe(3360);
      expect(result.balanceDue).toBe(0);
      expect(result.isSettled).toBe(true);
    });

    it("ignores voided items completely from debit totals", () => {
      const items: FolioItem[] = [
        mockItem({
          itemType: "Room",
          description: "Standard Room",
          sacCode: "996311",
          totalPrice: 3000,
          gstAmount: 360,
        }),
        mockItem({
          itemType: "Spa",
          description: "Accidental Spa Charge (Voided)",
          sacCode: "999722",
          totalPrice: 4500,
          gstAmount: 810,
          isVoided: true,
          voidReason: "Posted to wrong room",
        }),
      ];

      const result = calculateCentralizedFolio(items, []);
      expect(result.totalDebit).toBe(3360);
      expect(result.totalServicesCharges).toBe(0);
      expect(result.totalServicesGST).toBe(0);
    });

    it("subtracts refunds from payments credits", () => {
      const items: FolioItem[] = [
        mockItem({
          itemType: "Room",
          description: "Room Tariff",
          sacCode: "996311",
          totalPrice: 5000,
          gstAmount: 600,
        }),
      ];

      const payments: Payment[] = [
        mockPayment({
          method: "UPI",
          amount: 5600,
          status: "Captured",
          notes: "Online UPI payment",
        }),
        mockPayment({
          method: "UPI",
          amount: 1600,
          status: "Refunded",
          notes: "Partial rate goodwill refund",
        }),
      ];

      const result = calculateCentralizedFolio(items, payments);
      expect(result.totalRefunded).toBe(1600);
      expect(result.totalCredit).toBe(5600); // 5600 captured
      expect(result.balanceDue).toBe(0);
    });
  });

  describe("Split Billing (Corporate vs Personal)", () => {
    it("accurately splits debits and balances between Company and Personal Guest", () => {
      const items: FolioItem[] = [
        // Company picks up Room + GST
        mockItem({
          itemType: "Room",
          description: "Executive Suite (3 Nights)",
          sacCode: "996311",
          totalPrice: 30000,
          gstAmount: 5400,
          splitTarget: "Corporate",
        }),
        // Personal picks up In-Room Dining & Laundry
        mockItem({
          itemType: "InRoomDining",
          description: "Room Service Dinner",
          sacCode: "996331",
          totalPrice: 2500,
          gstAmount: 125,
          splitTarget: "Personal",
        }),
        mockItem({
          itemType: "Laundry",
          description: "Suit Dry Cleaning",
          sacCode: "999799",
          totalPrice: 1500,
          gstAmount: 270,
          splitTarget: "Personal",
        }),
      ];

      // Corporate pays ₹20,000 via Bank Transfer; Guest pays ₹2,000 via UPI
      const payments: Payment[] = [
        {
          ...mockPayment({
            method: "Bank Transfer",
            amount: 20000,
            status: "Captured",
            notes: "Advance corporate transfer",
          }),
          splitTarget: "Corporate",
        } as any,
        {
          ...mockPayment({
            method: "UPI",
            amount: 2000,
            status: "Captured",
            notes: "Personal UPI scan",
          }),
          splitTarget: "Personal",
        } as any,
      ];

      const result = calculateCentralizedFolio(items, payments);

      // Corporate breakdown:
      // Taxable: 30000, Tax: 5400, Debit: 35400
      // Credit: 20000, BalanceDue: 15400
      expect(result.corporate.taxable).toBe(30000);
      expect(result.corporate.tax).toBe(5400);
      expect(result.corporate.debit).toBe(35400);
      expect(result.corporate.credit).toBe(20000);
      expect(result.corporate.balanceDue).toBe(15400);

      // Personal breakdown:
      // Taxable: 2500 + 1500 = 4000
      // Tax: 125 + 270 = 395
      // Debit: 4395
      // Credit: 2000
      // BalanceDue: 2395
      expect(result.personal.taxable).toBe(4000);
      expect(result.personal.tax).toBe(395);
      expect(result.personal.debit).toBe(4395);
      expect(result.personal.credit).toBe(2000);
      expect(result.personal.balanceDue).toBe(2395);

      // Total balance due: 15400 + 2395 = 17795
      expect(result.balanceDue).toBe(17795);
    });
  });

  describe("All 9 Supported Line Categories Accumulation", () => {
    it("accumulates each category into servicesBreakdownByCategory with statutory SAC codes", () => {
      const items: FolioItem[] = [
        mockItem({ itemType: "Room", description: "Tariff", sacCode: "996311", totalPrice: 4000, gstAmount: 480 }),
        mockItem({ itemType: "Food", description: "Breakfast", sacCode: "996331", totalPrice: 600, gstAmount: 30 }),
        mockItem({ itemType: "Restaurant", description: "Lunch", sacCode: "996331", totalPrice: 1200, gstAmount: 60 }),
        mockItem({ itemType: "InRoomDining", description: "Midnight Snack", sacCode: "996331", totalPrice: 500, gstAmount: 25 }),
        mockItem({ itemType: "Laundry", description: "Ironing", sacCode: "999799", totalPrice: 300, gstAmount: 54 }),
        mockItem({ itemType: "Spa", description: "Ayurvedic Massage", sacCode: "999722", totalPrice: 3500, gstAmount: 630 }),
        mockItem({ itemType: "Housekeeping", description: "Extra Pillows & Quilt", sacCode: "999799", totalPrice: 400, gstAmount: 72 }),
        mockItem({ itemType: "Banquet", description: "Conference Hall", sacCode: "997212", totalPrice: 15000, gstAmount: 2700 }),
        mockItem({ itemType: "OtherService", description: "Airport Transfer", sacCode: "999799", totalPrice: 2000, gstAmount: 360 }),
      ];

      const result = calculateCentralizedFolio(items, []);

      expect(result.roomSubtotal).toBe(4000);
      expect(result.servicesBreakdownByCategory["Food"]?.sacCode).toBe("996331");
      expect(result.servicesBreakdownByCategory["Restaurant"]?.taxable).toBe(1200);
      expect(result.servicesBreakdownByCategory["InRoomDining"]?.taxable).toBe(500);
      expect(result.servicesBreakdownByCategory["Laundry"]?.taxable).toBe(300);
      expect(result.servicesBreakdownByCategory["Spa"]?.sacCode).toBe("999722");
      expect(result.servicesBreakdownByCategory["Housekeeping"]?.taxable).toBe(400);
      expect(result.servicesBreakdownByCategory["Banquet"]?.taxable).toBe(15000);
      expect(result.servicesBreakdownByCategory["OtherService"]?.taxable).toBe(2000);

      // Verify amount in words is generated
      expect(result.amountInWords).toContain("Rupees");
    });
  });
});
