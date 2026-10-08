import { describe, it, expect } from "vitest";
import {
  checkRoomStateTransition,
  evaluateRoomAvailability,
  buildCheckInValidation,
  buildCheckoutSummary,
  maskAadhaar,
} from "../index";

describe("MODULE 6 — Front Desk PMS & Reservation Engine", () => {
  describe("Real-Time Room States & Transition Machine", () => {
    it("allows transition from Clean to Dirty or Available", () => {
      const cleanToAvail = checkRoomStateTransition({
        from: "Clean",
        to: "Available",
        isActive: true,
      });
      expect(cleanToAvail.allowed).toBe(true);

      const cleanToDirty = checkRoomStateTransition({
        from: "Clean",
        to: "Dirty",
        isActive: true,
      });
      expect(cleanToDirty.allowed).toBe(true);
    });

    it("prevents direct manual state jump from Available to Occupied without check-in transaction", () => {
      const result = checkRoomStateTransition({
        from: "Available",
        to: "Occupied",
        isActive: true,
        hasInHouseBooking: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Room state cannot move from Available to Occupied");
    });

    it("allows transition from Occupied to Dirty on checkout", () => {
      const result = checkRoomStateTransition({
        from: "Occupied",
        to: "Dirty",
        isActive: true,
        hasInHouseBooking: false,
      });
      expect(result.allowed).toBe(true);
    });

    it("allows transition from Dirty to Clean after housekeeping", () => {
      const result = checkRoomStateTransition({
        from: "Dirty",
        to: "Clean",
        isActive: true,
        hasInHouseBooking: false,
      });
      expect(result.allowed).toBe(true);
    });

    it("prevents state transitions on deactivated rooms", () => {
      const result = checkRoomStateTransition({
        from: "Clean",
        to: "Available",
        isActive: false,
        hasInHouseBooking: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Room is deactivated");
    });

    it("prevents directly marking an occupied room as Available without checkout", () => {
      const result = checkRoomStateTransition({
        from: "Occupied",
        to: "Available",
        isActive: true,
        hasInHouseBooking: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("in-house guest");
    });
  });

  describe("Double-Booking Prevention & Availability Guard", () => {
    const testRoom = {
      id: "room-101",
      roomNumber: "101",
      status: "Available" as const,
      isActive: true,
    };

    it("prevents double-booking when dates overlap with an active booking", () => {
      const bookings = [
        {
          id: "b-1",
          bookingNumber: "BKG-1001",
          status: "CheckedIn" as const,
          checkInDate: "2026-10-10",
          checkOutDate: "2026-10-15",
          guestName: "Ramesh Sharma",
        },
      ];

      const check = evaluateRoomAvailability({
        room: testRoom,
        bookings,
        checkInDate: "2026-10-12",
        checkOutDate: "2026-10-14",
      });

      expect(check.isSellable).toBe(false);
      expect(check.conflicts.length).toBe(1);
      expect(check.reason).toContain("BKG-1001");
    });

    it("allows non-overlapping stays (same-day turnaround)", () => {
      const bookings = [
        {
          id: "b-1",
          bookingNumber: "BKG-1001",
          status: "CheckedIn" as const,
          checkInDate: "2026-10-10",
          checkOutDate: "2026-10-12",
          guestName: "Ramesh Sharma",
        },
      ];

      const check = evaluateRoomAvailability({
        room: testRoom,
        bookings,
        checkInDate: "2026-10-12",
        checkOutDate: "2026-10-15",
      });

      expect(check.isSellable).toBe(true);
      expect(check.conflicts.length).toBe(0);
    });

    it("excludes the same booking during mid-stay room switch evaluation", () => {
      const bookings = [
        {
          id: "b-1",
          bookingNumber: "BKG-1001",
          status: "CheckedIn" as const,
          checkInDate: "2026-10-10",
          checkOutDate: "2026-10-15",
          guestName: "Ramesh Sharma",
        },
      ];

      const check = evaluateRoomAvailability({
        room: testRoom,
        bookings,
        checkInDate: "2026-10-11",
        checkOutDate: "2026-10-15",
        excludeBookingId: "b-1",
      });

      expect(check.isSellable).toBe(true);
    });

    it("marks blocked or maintenance rooms as un-sellable", () => {
      const maintenanceRoom = {
        id: "room-102",
        roomNumber: "102",
        status: "Maintenance" as const,
        isActive: true,
      };

      const check = evaluateRoomAvailability({
        room: maintenanceRoom,
        bookings: [],
        checkInDate: "2026-10-10",
        checkOutDate: "2026-10-12",
      });

      expect(check.isSellable).toBe(false);
      expect(check.reason).toContain("Maintenance");
    });
  });

  describe("Check-In Validation Engine", () => {
    it("fails check-in if mandatory guest ID proof is missing", () => {
      const validation = buildCheckInValidation({
        bookingId: "b-1",
        booking: {
          status: "Confirmed",
          checkInDate: "2026-10-10",
          checkOutDate: "2026-10-12",
          grandTotal: 10000,
          paidAmount: 5000,
        },
        guest: {
          fullName: "Amit Patel",
          mobile: "9820011223",
          guestType: "Domestic",
          identities: [],
        },
        room: {
          id: "room-101",
          roomNumber: "101",
          status: "Clean",
          isActive: true,
        },
        availability: {
          isSellable: true,
        },
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("identity"))).toBe(true);
    });

    it("passes check-in when all prerequisites and ID proof are complete", () => {
      const validation = buildCheckInValidation({
        bookingId: "b-1",
        booking: {
          status: "Confirmed",
          checkInDate: "2026-10-10",
          checkOutDate: "2026-10-12",
          grandTotal: 10000,
          paidAmount: 2000,
        },
        guest: {
          fullName: "Amit Patel",
          mobile: "9820011223",
          address: "123 Nariman Point",
          stateCode: "27",
          guestType: "Domestic",
          identities: [
            { identityType: "Aadhaar", idNumber: "999988881234", maskedIdNumber: "XXXX-XXXX-1234" },
          ],
        },
        room: {
          id: "room-101",
          roomNumber: "101",
          status: "Clean",
          isActive: true,
        },
        availability: {
          isSellable: true,
        },
        depositCollected: 2000,
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe("Check-Out Settlement & Comprehensive Folio Calculation", () => {
    it("accurately computes room charges, service charges, GST, deposits, and balance due", () => {
      const summary = buildCheckoutSummary({
        booking: {
          id: "b-1",
          bookingNumber: "BKG-2001",
          checkInDate: "2026-10-10",
          checkOutDate: "2026-10-12",
          totalNights: 2,
          grandTotal: 11200,
          paidAmount: 3000,
        },
        guest: { fullName: "Sunita Rao", mobile: "9876543210" },
        room: { id: "room-201", roomNumber: "201" },
        folio: {
          id: "fol-1",
          folioNumber: "FOL-2026-001",
          status: "Open",
          items: [
            {
              id: "i-1",
              folioId: "fol-1",
              itemType: "Room",
              description: "Room Tariff 2 nights",
              quantity: 2,
              unitPrice: 4000 as never,
              totalPrice: 8000 as never,
              gstRate: 0.12 as never,
              gstAmount: 960 as never,
              sacCode: "996311",
              isVoided: false,
              postedAt: new Date().toISOString(),
            },
            {
              id: "i-2",
              folioId: "fol-1",
              itemType: "InRoomDining",
              description: "In-Room Dining F&B",
              quantity: 1,
              unitPrice: 1500 as never,
              totalPrice: 1500 as never,
              gstRate: 0.05 as never,
              gstAmount: 75 as never,
              sacCode: "996331",
              isVoided: false,
              postedAt: new Date().toISOString(),
            },
          ],
          payments: [
            {
              id: "p-1",
              paymentNumber: "PAY-001",
              folioId: "fol-1",
              amount: 3000 as never,
              method: "UPI",
              status: "Captured",
              notes: "Advance deposit collected at booking",
              receivedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });

      expect(summary.roomCharges).toBe(8000);
      expect(summary.serviceCharges).toBe(1500);
      expect(summary.taxAmount).toBe(1035); // 960 + 75
      expect(summary.totalDebit).toBe(10535); // 8000 + 1500 + 1035
      expect(summary.totalCredit).toBe(3000);
      expect(summary.advanceDeposit).toBe(3000);
      expect(summary.balanceDue).toBe(7535);
      expect(summary.isSettled).toBe(false);
      expect(summary.paymentStatus).toBe("Partially Paid");
      expect(summary.amountInWords).toContain("Seven Thousand");
    });
  });

  describe("Statutory Aadhaar Masking", () => {
    it("masks the first 8 digits and formats Aadhaar in Indian UIDAI standard format", () => {
      const masked = maskAadhaar("123456789012");
      expect(masked).toBe("XXXX-XXXX-9012");
    });
  });
});
