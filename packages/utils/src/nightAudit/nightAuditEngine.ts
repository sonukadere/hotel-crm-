import type { NightAuditStatus, FlashReport } from "@hotel/types";
import {
  calculateOccupancyRate,
  calculateADR,
  calculateRevPAR,
} from "./performanceMetrics";

export interface NightAuditLogRecord {
  id: string;
  businessDate: string;
  startedAt: string;
  completedAt?: string;
  user: string;
  chargesPosted: number;
  paymentsPosted: number;
  errors?: string[];
  finalStatus: NightAuditStatus;
  metrics?: {
    occupancyRate: number;
    adr: number;
    revPar: number;
    totalRevenue: number;
    taxCollected: number;
  };
}

export interface NightAuditProcessStep {
  step: number;
  title: string;
  description: string;
}

export const NIGHT_AUDIT_STEPS: NightAuditProcessStep[] = [
  { step: 1, title: "Validate open bookings", description: "Verifying active in-house reservations & room allocations" },
  { step: 2, title: "Validate pending check-ins", description: "Auditing arrivals scheduled for today; flagging No-Shows" },
  { step: 3, title: "Post daily room charges", description: "Computing tariffs per rate plan & posting to guest folios" },
  { step: 4, title: "Post applicable service charges", description: "Posting meals, minibar, housekeeping & dining charges" },
  { step: 5, title: "Calculate GST", description: "Applying CGST, SGST, IGST per statutory threshold slabs (12% / 18%)" },
  { step: 6, title: "Update folios", description: "Updating debit, credit, balance due & posting GST entries" },
  { step: 7, title: "Calculate payments", description: "Aggregating tender collections: Cash, Card, UPI, Razorpay" },
  { step: 8, title: "Generate audit report", description: "Compiling financial & inventory audit logs with auditor signature" },
  { step: 9, title: "Generate Flash Report", description: "Synthesizing executive KPI performance metrics" },
  { step: 10, title: "Close business date", description: "Locking ledger for the business date to prevent duplicate debiting" },
  { step: 11, title: "Move hotel business date to next day", description: "Advancing operational PMS clock forward by 1 calendar day" },
];

/**
 * Validates whether a business date is eligible for Night Audit.
 * Idempotency check: strictly blocks duplicate audits for the same business date.
 */
export function checkNightAuditIdempotency(
  businessDate: string,
  completedAudits: Array<{ businessDate: string; status: NightAuditStatus }>,
): { isAllowed: boolean; error?: string } {
  const normalizedDate = businessDate.trim();
  const alreadyCompleted = completedAudits.some(
    (a) => a.businessDate === normalizedDate && a.status === "Completed",
  );

  if (alreadyCompleted) {
    return {
      isAllowed: false,
      error: `Business date ${normalizedDate} has already been closed and audited. Duplicate audit execution blocked for idempotency.`,
    };
  }

  const isRunning = completedAudits.some(
    (a) => a.businessDate === normalizedDate && a.status === "Running",
  );

  if (isRunning) {
    return {
      isAllowed: false,
      error: `Night audit is already in progress for business date ${normalizedDate}. Please wait for completion.`,
    };
  }

  return { isAllowed: true };
}

/**
 * Calculates next calendar business date string in YYYY-MM-DD format.
 */
export function advanceBusinessDate(currentBusinessDate: string): string {
  const parts = currentBusinessDate.split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    const d = new Date(currentBusinessDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0]!;
  }

  const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dateObj.setUTCDate(dateObj.getUTCDate() + 1);
  return dateObj.toISOString().split("T")[0]!;
}

/**
 * Creates an immutable Audit Log record for night audit execution.
 */
export function createNightAuditLogRecord(params: {
  id: string;
  businessDate: string;
  startedAt: string;
  completedAt?: string;
  user: string;
  chargesPosted: number;
  paymentsPosted: number;
  errors?: string[];
  finalStatus: NightAuditStatus;
  metrics?: {
    occupancyRate: number;
    adr: number;
    revPar: number;
    totalRevenue: number;
    taxCollected: number;
  };
}): NightAuditLogRecord {
  return {
    id: params.id,
    businessDate: params.businessDate,
    startedAt: params.startedAt,
    completedAt: params.completedAt || new Date().toISOString(),
    user: params.user,
    chargesPosted: params.chargesPosted,
    paymentsPosted: params.paymentsPosted,
    errors: params.errors && params.errors.length > 0 ? params.errors : undefined,
    finalStatus: params.finalStatus,
    metrics: params.metrics,
  };
}

/**
 * Compiles Flash Report KPIs and financial aggregates.
 */
export function compileFlashReport(params: {
  id: string;
  hotelId: string;
  hotelName: string;
  businessDate: string;
  nextBusinessDate: string;
  auditedBy: string;
  closedAt: string;
  totalAvailableRooms: number;
  occupiedRooms: number;
  roomRevenue: number;
  serviceRevenue: number;
  taxCollected: number;
  cgstCollected: number;
  sgstCollected: number;
  igstCollected: number;
  outstandingBalance: number;
  cashCollection: number;
  cardCollection: number;
  upiCollection: number;
  razorpayCollection: number;
  checkIns: number;
  checkOuts: number;
  noShows: number;
  cancellations: number;
  chargesPostedCount: number;
  paymentsPostedCount: number;
}): FlashReport {
  const occupancyRate = calculateOccupancyRate(params.occupiedRooms, params.totalAvailableRooms);
  const adr = calculateADR(params.roomRevenue, params.occupiedRooms);
  const revPar = calculateRevPAR(params.roomRevenue, params.totalAvailableRooms);

  return {
    id: params.id,
    hotelId: params.hotelId,
    hotelName: params.hotelName,
    businessDate: params.businessDate,
    nextBusinessDate: params.nextBusinessDate,
    closedAt: params.closedAt,
    auditedBy: params.auditedBy,
    totalAvailableRooms: params.totalAvailableRooms,
    occupiedRooms: params.occupiedRooms,
    occupancyRate,
    adr,
    revPar,
    totalRoomRevenue: params.roomRevenue,
    totalServiceRevenue: params.serviceRevenue,
    totalRevenue: params.roomRevenue + params.serviceRevenue,
    taxCollected: params.taxCollected,
    cgstCollected: params.cgstCollected,
    sgstCollected: params.sgstCollected,
    igstCollected: params.igstCollected,
    outstandingBalance: params.outstandingBalance,
    cashCollection: params.cashCollection,
    cardCollection: params.cardCollection,
    upiCollection: params.upiCollection,
    razorpayCollection: params.razorpayCollection,
    totalCollection:
      params.cashCollection + params.cardCollection + params.upiCollection + params.razorpayCollection,
    checkIns: params.checkIns,
    checkOuts: params.checkOuts,
    noShows: params.noShows,
    cancellations: params.cancellations,
    chargesPostedCount: params.chargesPostedCount,
    paymentsPostedCount: params.paymentsPostedCount,
  };
}
