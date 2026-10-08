import { describe, it, expect } from "vitest";
import {
  calculateOccupancyRate,
  calculateADR,
  calculateRevPAR,
  calculateHotelPerformanceKPIs,
  checkNightAuditIdempotency,
  advanceBusinessDate,
  createNightAuditLogRecord,
  compileFlashReport,
  NIGHT_AUDIT_STEPS,
} from "../nightAudit";

describe("MODULE 11 — NIGHT AUDIT & HOTEL PERFORMANCE ENGINE", () => {
  describe("Performance Metrics: Occupancy, ADR and RevPAR", () => {
    it("calculates occupancyRate = occupiedRooms / totalAvailableRooms * 100", () => {
      // 18 occupied out of 20 available = 90%
      expect(calculateOccupancyRate(18, 20)).toBe(90);

      // 10 occupied out of 25 available = 40%
      expect(calculateOccupancyRate(10, 25)).toBe(40);

      // Full house: 20 out of 20 = 100%
      expect(calculateOccupancyRate(20, 20)).toBe(100);

      // Safe guards against 0 available rooms
      expect(calculateOccupancyRate(0, 0)).toBe(0);
      expect(calculateOccupancyRate(5, 0)).toBe(0);

      // 0 occupied rooms
      expect(calculateOccupancyRate(0, 20)).toBe(0);
    });

    it("calculates ADR = totalRoomRevenueINR / occupiedRooms", () => {
      // ₹90,000 revenue across 18 occupied rooms = ₹5,000 ADR
      expect(calculateADR(90000, 18)).toBe(5000);

      // ₹1,45,000 across 20 rooms = ₹7,250 ADR
      expect(calculateADR(145000, 20)).toBe(7250);

      // Safe guard against 0 occupied rooms (no division by zero)
      expect(calculateADR(90000, 0)).toBe(0);
      expect(calculateADR(0, 0)).toBe(0);

      // Rounds to 2 decimal places properly
      expect(calculateADR(100000, 17)).toBe(5882.35);
    });

    it("calculates RevPAR = totalRoomRevenueINR / totalAvailableRooms", () => {
      // ₹90,000 room revenue across 20 available rooms = ₹4,500 RevPAR
      expect(calculateRevPAR(90000, 20)).toBe(4500);

      // Safe guard against 0 available rooms
      expect(calculateRevPAR(90000, 0)).toBe(0);
      expect(calculateRevPAR(0, 20)).toBe(0);

      // Decimals precision
      expect(calculateRevPAR(125000, 24)).toBe(5208.33);
    });

    it("verifies mathematical identity: RevPAR = ADR * (occupancyRate / 100)", () => {
      const totalAvailable = 25;
      const occupied = 20;
      const roomRevenue = 150000;

      const occupancyRate = calculateOccupancyRate(occupied, totalAvailable); // 80%
      const adr = calculateADR(roomRevenue, occupied); // 7500
      const revPar = calculateRevPAR(roomRevenue, totalAvailable); // 6000

      expect(occupancyRate).toBe(80);
      expect(adr).toBe(7500);
      expect(revPar).toBe(6000);

      // RevPAR === ADR * 80% => 7500 * 0.8 = 6000
      const derivedRevPar = adr * (occupancyRate / 100);
      expect(derivedRevPar).toBe(revPar);
    });

    it("calculates full hotel KPI bundle correctly", () => {
      const kpis = calculateHotelPerformanceKPIs({
        occupiedRooms: 15,
        totalAvailableRooms: 20,
        totalRoomRevenueINR: 105000,
        totalServiceRevenueINR: 22000,
        taxCollectedINR: 15240,
        outstandingBalanceINR: 18500,
        arrivalsToday: 6,
        departuresToday: 4,
        noShowsToday: 1,
        cancellationsToday: 0,
      });

      expect(kpis.occupancyRate).toBe(75);
      expect(kpis.adr).toBe(7000);
      expect(kpis.revPar).toBe(5250);
      expect(kpis.totalRoomRevenue).toBe(105000);
      expect(kpis.totalServiceRevenue).toBe(22000);
      expect(kpis.totalRevenue).toBe(127000);
      expect(kpis.taxCollected).toBe(15240);
      expect(kpis.outstandingBalance).toBe(18500);
      expect(kpis.arrivalsToday).toBe(6);
      expect(kpis.departuresToday).toBe(4);
      expect(kpis.noShowsToday).toBe(1);
    });
  });

  describe("Night Audit Idempotency & Process Integrity", () => {
    it("allows audit for a new business date that has not yet been audited", () => {
      const history = [
        { businessDate: "2026-10-04", status: "Completed" as const },
      ];

      const check = checkNightAuditIdempotency("2026-10-05", history);
      expect(check.isAllowed).toBe(true);
      expect(check.error).toBeUndefined();
    });

    it("strictly blocks duplicate night audit execution for the same business date (idempotency)", () => {
      const history = [
        { businessDate: "2026-10-04", status: "Completed" as const },
        { businessDate: "2026-10-05", status: "Completed" as const },
      ];

      const check = checkNightAuditIdempotency("2026-10-05", history);
      expect(check.isAllowed).toBe(false);
      expect(check.error).toContain("already been closed and audited");
      expect(check.error).toContain("Duplicate audit execution blocked for idempotency");
    });

    it("blocks audit if another session is already currently Running", () => {
      const history = [
        { businessDate: "2026-10-05", status: "Running" as const },
      ];

      const check = checkNightAuditIdempotency("2026-10-05", history);
      expect(check.isAllowed).toBe(false);
      expect(check.error).toContain("already in progress");
    });

    it("allows re-running if a previous audit run Failed", () => {
      const history = [
        { businessDate: "2026-10-05", status: "Failed" as const },
      ];

      const check = checkNightAuditIdempotency("2026-10-05", history);
      expect(check.isAllowed).toBe(true);
    });
  });

  describe("Business Date Advancement (Step 11)", () => {
    it("advances standard calendar days accurately", () => {
      expect(advanceBusinessDate("2026-10-05")).toBe("2026-10-06");
      expect(advanceBusinessDate("2026-10-15")).toBe("2026-10-16");
    });

    it("advances across month-end boundary accurately", () => {
      expect(advanceBusinessDate("2026-10-31")).toBe("2026-11-01");
      expect(advanceBusinessDate("2026-02-28")).toBe("2026-03-01");
    });

    it("advances across year-end boundary accurately", () => {
      expect(advanceBusinessDate("2026-12-31")).toBe("2027-01-01");
    });
  });

  describe("Audit Log & Flash Report Generation", () => {
    it("creates an audit log containing all required audit session fields", () => {
      const auditLog = createNightAuditLogRecord({
        id: "NA-2026-10-05-001",
        businessDate: "2026-10-05",
        startedAt: "2026-10-05T23:55:00.000Z",
        completedAt: "2026-10-05T23:58:30.000Z",
        user: "admin-audit-user",
        chargesPosted: 18,
        paymentsPosted: 12,
        errors: [],
        finalStatus: "Completed",
        metrics: {
          occupancyRate: 85,
          adr: 6500,
          revPar: 5525,
          totalRevenue: 135000,
          taxCollected: 16200,
        },
      });

      expect(auditLog.businessDate).toBe("2026-10-05");
      expect(auditLog.startedAt).toBe("2026-10-05T23:55:00.000Z");
      expect(auditLog.completedAt).toBe("2026-10-05T23:58:30.000Z");
      expect(auditLog.user).toBe("admin-audit-user");
      expect(auditLog.chargesPosted).toBe(18);
      expect(auditLog.paymentsPosted).toBe(12);
      expect(auditLog.finalStatus).toBe("Completed");
      expect(auditLog.metrics?.occupancyRate).toBe(85);
      expect(auditLog.metrics?.adr).toBe(6500);
    });

    it("records failed status and errors when an audit step fails", () => {
      const failedLog = createNightAuditLogRecord({
        id: "NA-2026-10-05-ERR",
        businessDate: "2026-10-05",
        startedAt: "2026-10-05T23:55:00.000Z",
        user: "night-auditor",
        chargesPosted: 0,
        paymentsPosted: 0,
        errors: ["Database transaction deadlock while updating folio debit balance"],
        finalStatus: "Failed",
      });

      expect(failedLog.finalStatus).toBe("Failed");
      expect(failedLog.errors).toHaveLength(1);
      expect(failedLog.errors?.[0]).toContain("deadlock");
    });

    it("verifies the defined 11-step Night Audit process sequence", () => {
      expect(NIGHT_AUDIT_STEPS).toHaveLength(11);
      expect(NIGHT_AUDIT_STEPS[0]!.title).toBe("Validate open bookings");
      expect(NIGHT_AUDIT_STEPS[1]!.title).toBe("Validate pending check-ins");
      expect(NIGHT_AUDIT_STEPS[2]!.title).toBe("Post daily room charges");
      expect(NIGHT_AUDIT_STEPS[3]!.title).toBe("Post applicable service charges");
      expect(NIGHT_AUDIT_STEPS[4]!.title).toBe("Calculate GST");
      expect(NIGHT_AUDIT_STEPS[5]!.title).toBe("Update folios");
      expect(NIGHT_AUDIT_STEPS[6]!.title).toBe("Calculate payments");
      expect(NIGHT_AUDIT_STEPS[7]!.title).toBe("Generate audit report");
      expect(NIGHT_AUDIT_STEPS[8]!.title).toBe("Generate Flash Report");
      expect(NIGHT_AUDIT_STEPS[9]!.title).toBe("Close business date");
      expect(NIGHT_AUDIT_STEPS[10]!.title).toBe("Move hotel business date to next day");
    });

    it("synthesizes Flash Report with collection breakdowns and FO movements", () => {
      const flash = compileFlashReport({
        id: "FLASH-2026-10-05",
        hotelId: "hotel-01",
        hotelName: "Grand Rajwada Palace",
        businessDate: "2026-10-05",
        nextBusinessDate: "2026-10-06",
        auditedBy: "Auditor John",
        closedAt: "2026-10-06T00:02:00.000Z",
        totalAvailableRooms: 30,
        occupiedRooms: 24,
        roomRevenue: 168000,
        serviceRevenue: 32000,
        taxCollected: 24000,
        cgstCollected: 12000,
        sgstCollected: 12000,
        igstCollected: 0,
        outstandingBalance: 14500,
        cashCollection: 25000,
        cardCollection: 65000,
        upiCollection: 30000,
        razorpayCollection: 80000,
        checkIns: 8,
        checkOuts: 5,
        noShows: 2,
        cancellations: 1,
        chargesPostedCount: 24,
        paymentsPostedCount: 16,
      });

      expect(flash.occupancyRate).toBe(80);
      expect(flash.adr).toBe(7000);
      expect(flash.revPar).toBe(5600);
      expect(flash.totalRevenue).toBe(200000);
      expect(flash.totalCollection).toBe(200000);
      expect(flash.cashCollection).toBe(25000);
      expect(flash.cardCollection).toBe(65000);
      expect(flash.upiCollection).toBe(30000);
      expect(flash.razorpayCollection).toBe(80000);
      expect(flash.noShows).toBe(2);
      expect(flash.checkIns).toBe(8);
      expect(flash.nextBusinessDate).toBe("2026-10-06");
    });
  });
});
