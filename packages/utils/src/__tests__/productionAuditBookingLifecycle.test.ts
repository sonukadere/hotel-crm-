import { describe, it, expect } from "vitest";
import {
  buildReservationQuote,
  buildCheckInValidation,
  buildCheckoutSummary,
  calculateServiceGST,
  calculateFolioBalance,
} from "../index";
import type { FolioItem, Payment } from "@hotel/types";

describe("Module 16 — Production Audit: Full Booking Lifecycle E2E", () => {
  const HOTEL_STATE = "27"; // Maharashtra
  const GUEST_STATE = "27";

  it("completes full lifecycle: Search -> Quote -> Advance -> Check-in -> Service -> Check-out -> Invoice", () => {
    // 1. Search & Rate Quote
    const quote = buildReservationQuote({
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-03", // 2 nights
      adults: 2,
      children: 0,
      mealPlan: "EP",
      hotelStateCode: HOTEL_STATE,
      guestStateCode: GUEST_STATE,
      ratePlan: {
        name: "CP Plan",
        baseRate: 6000,
        seasonalMultiplier: 1.0,
        weekendMultiplier: 1.0,
        extraAdultRate: 1500,
        extraChildRate: 800,
      },
      baseAdults: 2,
      maxAdults: 3,
      maxChildren: 2,
    });

    expect(quote.totalNights).toBe(2);
    expect(quote.roomCharges).toBe(12000); // 6000 * 2
    expect(quote.taxableAmount).toBe(12000);
    // 6000/night <= 7500 -> 12% GST = 1440
    expect(quote.gst.totalTax).toBe(1440);
    expect(quote.grandTotal).toBe(13440);

    // 2. Advance Deposit Collection (50% = ₹6,720)
    const advanceAmount = 6720;
    const initialPayments: Payment[] = [
      {
        id: "pay-advance-01",
        paymentNumber: "PAY-2026-0001",
        folioId: "fol-lifecycle-01",
        amount: advanceAmount,
        method: "Razorpay",
        status: "Captured",
        transactionRef: "rzp_pay_advance_123",
        notes: "50% advance deposit for booking",
        receivedAt: "2026-10-25T10:00:00Z",
        createdAt: "2026-10-25T10:00:00Z",
      },
    ];

    // Initial room folio item
    const initialItems: FolioItem[] = [
      {
        id: "item-room-01",
        folioId: "fol-lifecycle-01",
        itemType: "Room",
        description: "Deluxe Heritage Room (2 Nights CP Plan)",
        quantity: 2,
        unitPrice: 6000,
        totalPrice: 12000,
        sacCode: "996311",
        gstRate: 0.12,
        gstAmount: 1440,
        isVoided: false,
        postedAt: "2026-11-01T14:00:00Z",
      },
    ];

    const midBalance = calculateFolioBalance(initialItems, initialPayments);
    expect(midBalance.totalDebit).toBe(13440);
    expect(midBalance.totalCredit).toBe(6720);
    expect(midBalance.balanceDue).toBe(6720);

    // 3. Front Desk Check-in Validation Gate
    const checkInGate = buildCheckInValidation({
      bookingId: "bkg-lifecycle-01",
      booking: {
        status: "Confirmed",
        checkInDate: "2026-11-01",
        checkOutDate: "2026-11-03",
        grandTotal: 13440,
        paidAmount: advanceAmount,
      },
      guest: {
        fullName: "Vikramaditya Rathore",
        mobile: "9876543210",
        address: "123 Nariman Point, Mumbai",
        state: "Maharashtra",
        guestType: "Domestic",
        identities: [
          {
            identityType: "Aadhaar",
            idNumber: "999988887777",
            maskedIdNumber: "XXXX-XXXX-7777",
          },
        ],
      },
      room: {
        id: "r-201",
        roomNumber: "201",
        status: "Clean",
      },
      depositAmount: advanceAmount,
      roomCharges: 12000,
      taxAmount: 1440,
    });

    expect(checkInGate.isValid).toBe(true);
    expect(checkInGate.errors).toEqual([]);
    expect(checkInGate.checks.find((c) => c.key === "roomAvailable")?.passed).toBe(true);
    expect(checkInGate.checks.find((c) => c.key === "identity")?.passed).toBe(true);

    // 4. In-Stay Add-on Services: In-Room Dining + Laundry
    const diningGst = calculateServiceGST({
      amount: 1500,
      serviceType: "food",
      hotelStateCode: HOTEL_STATE,
      guestStateCode: GUEST_STATE,
    });
    const diningItem: FolioItem = {
      id: "item-service-01",
      folioId: "fol-lifecycle-01",
      itemType: "InRoomDining",
      description: "Rajasthani Thali Dinner for 2",
      quantity: 1,
      unitPrice: 1500,
      totalPrice: 1500,
      sacCode: diningGst.sacCode,
      gstRate: diningGst.gstRate,
      gstAmount: diningGst.totalTax,
      isVoided: false,
      postedAt: "2026-11-01T21:00:00Z",
    };

    const laundryGst = calculateServiceGST({
      amount: 600,
      serviceType: "laundry",
      hotelStateCode: HOTEL_STATE,
      guestStateCode: GUEST_STATE,
    });
    const laundryItem: FolioItem = {
      id: "item-service-02",
      folioId: "fol-lifecycle-01",
      itemType: "Laundry",
      description: "Express Dry Cleaning",
      quantity: 1,
      unitPrice: 600,
      totalPrice: 600,
      sacCode: laundryGst.sacCode,
      gstRate: laundryGst.gstRate,
      gstAmount: laundryGst.totalTax,
      isVoided: false,
      postedAt: "2026-11-02T10:00:00Z",
    };

    const finalItems = [...initialItems, diningItem, laundryItem];
    // New charges: 13440 + (1500+75) + (600+108) = 13440 + 1575 + 708 = 15723
    const preCheckoutBalance = calculateFolioBalance(finalItems, initialPayments);
    expect(preCheckoutBalance.totalDebit).toBe(15723);
    expect(preCheckoutBalance.balanceDue).toBe(15723 - 6720); // 9003

    // 5. Check-out Settlement: Guest clears remaining balance of ₹9,003 via Card
    const checkoutPayment: Payment = {
      id: "pay-checkout-02",
      paymentNumber: "PAY-2026-0002",
      folioId: "fol-lifecycle-01",
      amount: 9003,
      method: "Card",
      status: "Captured",
      transactionRef: "pos_swipe_8899",
      receivedAt: "2026-11-03T11:00:00Z",
      createdAt: "2026-11-03T11:00:00Z",
    };

    const allPayments = [...initialPayments, checkoutPayment];
    const finalBalance = calculateFolioBalance(finalItems, allPayments);

    expect(finalBalance.totalDebit).toBe(15723);
    expect(finalBalance.totalCredit).toBe(15723);
    expect(finalBalance.balanceDue).toBe(0);
    expect(finalBalance.isSettled).toBe(true);

    // 6. Checkout Summary & Final Statutory Invoice
    const summary = buildCheckoutSummary({
      booking: {
        id: "bkg-lifecycle-01",
        bookingNumber: "BKG-2026-0001",
        checkInDate: "2026-11-01",
        checkOutDate: "2026-11-03",
        totalNights: 2,
        grandTotal: 15723,
        paidAmount: 15723,
      },
      guest: {
        fullName: "Vikramaditya Rathore",
        mobile: "9876543210",
      },
      folio: {
        id: "fol-lifecycle-01",
        folioNumber: "FOL-2026-0001",
        status: "Settled",
        items: finalItems,
        payments: allPayments,
        gstTransactions: [
          {
            taxableAmount: 12000,
            cgstRate: 0.06,
            cgstAmount: 720,
            sgstRate: 0.06,
            sgstAmount: 720,
            igstRate: 0,
            igstAmount: 0,
            totalTax: 1440,
            sacCode: "996311",
            placeOfSupply: "27",
          },
          {
            taxableAmount: 1500,
            cgstRate: 0.025,
            cgstAmount: 37.5,
            sgstRate: 0.025,
            sgstAmount: 37.5,
            igstRate: 0,
            igstAmount: 0,
            totalTax: 75,
            sacCode: "996331",
            placeOfSupply: "27",
          },
          {
            taxableAmount: 600,
            cgstRate: 0.09,
            cgstAmount: 54,
            sgstRate: 0.09,
            sgstAmount: 54,
            igstRate: 0,
            igstAmount: 0,
            totalTax: 108,
            sacCode: "999799",
            placeOfSupply: "27",
          },
        ],
      },
      room: {
        id: "r-201",
        roomNumber: "201",
      },
    });

    expect(summary.isSettled).toBe(true);
    expect(summary.balanceDue).toBe(0);
    expect(summary.totalDebit).toBe(15723);
    expect(summary.totalCredit).toBe(15723);
    expect(summary.advanceDeposit).toBe(6720);
    expect(summary.gstLines.length).toBe(3);
    expect(summary.payments.length).toBe(2);
  });
});
