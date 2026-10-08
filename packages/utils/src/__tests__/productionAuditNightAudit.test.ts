import { describe, it, expect } from "vitest";
import {
  calculateHotelPerformanceKPIs,
  checkNightAuditIdempotency,
  advanceBusinessDate,
  createNightAuditLogRecord,
  compileFlashReport,
} from "../index";

describe("Module 16 — Production Audit: Night Audit Lifecycle & KPIs", () => {
  it("executes Night Audit: Booking -> Daily Charge -> GST -> Payments -> Rollover -> KPIs", () => {
    const businessDate = "2026-10-15";

    // 9 active usable rooms, 4 occupied
    const totalAvailableRooms = 9; // 1 room in maintenance
    const occupiedRooms = 4;

    // 4 occupied rooms revenue: 5000 + 5000 + 8000 + 8000 = 26,000
    const totalRoomRevenue = 26000;
    const totalServiceRevenue = 4000;
    const totalTax = 4600; // room tax 4080 + service tax 520

    // Payment tender collections
    const payments = {
      cash: 5000,
      card: 6000,
      upi: 8000,
      razorpay: 11000,
    };

    // 1. Idempotency Check on virgin date
    const priorAudits = [
      { businessDate: "2026-10-14", status: "Completed" as const },
    ];
    const initialGate = checkNightAuditIdempotency(businessDate, priorAudits);
    expect(initialGate.isAllowed).toBe(true);

    // 2. Performance KPIs Engine
    const kpis = calculateHotelPerformanceKPIs({
      totalAvailableRooms,
      occupiedRooms,
      totalRoomRevenueINR: totalRoomRevenue,
      totalServiceRevenueINR: totalServiceRevenue,
      taxCollectedINR: totalTax,
    });

    // Occupancy: 4 / 9 * 100 = 44.44%
    expect(kpis.occupancyRate).toBe(44.44);
    // ADR: 26000 / 4 = 6500
    expect(kpis.adr).toBe(6500);
    // RevPAR: 26000 / 9 = 2888.89
    expect(kpis.revPar).toBe(2888.89);
    expect(kpis.totalRevenue).toBe(30000);

    // 3. Roll Forward Business Date
    const nextBusinessDate = advanceBusinessDate(businessDate);
    expect(nextBusinessDate).toBe("2026-10-16");

    // 4. Compile Executive Flash Report
    const flashReport = compileFlashReport({
      id: "flash-2026-10-15",
      hotelId: "h-01",
      hotelName: "Heritage Haveli Palace",
      businessDate,
      nextBusinessDate,
      auditedBy: "Auditor Sharma",
      closedAt: new Date().toISOString(),
      totalAvailableRooms,
      occupiedRooms,
      roomRevenue: totalRoomRevenue,
      serviceRevenue: totalServiceRevenue,
      taxCollected: totalTax,
      cgstCollected: 2040,
      sgstCollected: 2040,
      igstCollected: 0,
      outstandingBalance: 0,
      cashCollection: payments.cash,
      cardCollection: payments.card,
      upiCollection: payments.upi,
      razorpayCollection: payments.razorpay,
      checkIns: 4,
      checkOuts: 0,
      noShows: 0,
      cancellations: 0,
      chargesPostedCount: 8,
      paymentsPostedCount: 4,
    });

    expect(flashReport.businessDate).toBe("2026-10-15");
    expect(flashReport.nextBusinessDate).toBe("2026-10-16");
    expect(flashReport.occupancyRate).toBe(44.44);
    expect(flashReport.adr).toBe(6500);
    expect(flashReport.revPar).toBe(2888.89);
    expect(flashReport.totalRoomRevenue).toBe(26000);
    expect(flashReport.cashCollection).toBe(5000);
    expect(flashReport.razorpayCollection).toBe(11000);

    // 5. Create Immutable Night Audit Log Record
    const auditLog = createNightAuditLogRecord({
      id: "na-log-2026-10-15",
      businessDate,
      startedAt: "2026-10-15T23:30:00Z",
      completedAt: "2026-10-15T23:45:00Z",
      user: "Auditor Sharma",
      chargesPosted: 8,
      paymentsPosted: 4,
      finalStatus: "Completed",
      metrics: {
        occupancyRate: kpis.occupancyRate,
        adr: kpis.adr,
        revPar: kpis.revPar,
        totalRevenue: kpis.totalRevenue,
        taxCollected: totalTax,
      },
    });

    expect(auditLog.finalStatus).toBe("Completed");
    expect(auditLog.businessDate).toBe("2026-10-15");

    // 6. Idempotency Check: Running audit again on same business date MUST be blocked
    const updatedAudits = [
      ...priorAudits,
      { businessDate: "2026-10-15", status: "Completed" as const },
    ];
    const duplicateGate = checkNightAuditIdempotency(businessDate, updatedAudits);
    expect(duplicateGate.isAllowed).toBe(false);
    expect(duplicateGate.error).toContain("already been closed and audited");
  });
});
