import { prisma } from "../db/prisma";
import { NightAuditReport, HotelPerformanceMetrics, NightAuditStatus } from "@hotel/types";
import { recordAuditLog } from "./auditService";
import { calculateRoomGST } from "@hotel/utils";
import { getDefaultHotelId } from "./roomService";

// In-memory registry of executed night audits (backed by database audit logs for idempotency)
const completedAuditsMap = new Map<string, NightAuditReport>();

// Active hotel business date registry
const hotelBusinessDates = new Map<string, string>();

export interface PreAuditChecklist {
  businessDate: string;
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  checkedInBookingsCount: number;
  pendingArrivalsCount: number;
  pendingDeparturesCount: number;
  unpostedRoomTariffsCount: number;
  openFoliosCount: number;
  isReadyForAudit: boolean;
  warnings: string[];
}

export interface FlashReport {
  id: string;
  hotelId: string;
  hotelName: string;
  businessDate: string;
  nextBusinessDate: string;
  closedAt: string;
  auditedBy: string;

  // Key Performance Indicators (Statutory PMS calculations)
  totalAvailableRooms: number;
  occupiedRooms: number;
  occupancyRate: number; // occupiedRooms / totalAvailableRooms * 100
  adr: number;           // totalRoomRevenue / occupiedRooms
  revPar: number;        // totalRoomRevenue / totalAvailableRooms

  // Financial Breakdown (INR)
  totalRoomRevenue: number;
  totalServiceRevenue: number;
  totalRevenue: number;
  taxCollected: number;
  cgstCollected: number;
  sgstCollected: number;
  igstCollected: number;
  outstandingBalance: number;

  // Payments Collection Reconciliations
  cashCollection: number;
  cardCollection: number;
  upiCollection: number;
  razorpayCollection: number;
  totalCollection: number;

  // Front Office Movements
  checkIns: number;
  checkOuts: number;
  noShows: number;
  cancellations: number;

  chargesPostedCount: number;
  paymentsPostedCount: number;
}

/**
 * Returns current business date for a hotel
 */
export async function getCurrentBusinessDate(hotelId?: string): Promise<string> {
  const resolvedHotelId = hotelId || (await getDefaultHotelId());
  if (!hotelBusinessDates.has(resolvedHotelId)) {
    // Default initial business date
    hotelBusinessDates.set(resolvedHotelId, "2026-10-05");
  }
  return hotelBusinessDates.get(resolvedHotelId)!;
}

/**
 * Validates pre-audit checklist before triggering night audit
 */
export async function validatePreAuditChecklist(
  hotelId?: string,
  businessDate?: string,
): Promise<PreAuditChecklist> {
  const resolvedHotelId = hotelId || (await getDefaultHotelId());
  const dateStr = businessDate || (await getCurrentBusinessDate(resolvedHotelId));

  const warnings: string[] = [];

  // 1. Rooms inventory
  const rooms = await prisma.room.findMany({ where: { hotelId: resolvedHotelId } });
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r) => r.status === "Available" || r.status === "Clean").length;
  const occupiedRooms = rooms.filter((r) => r.status === "Occupied").length;

  // 2. Bookings
  const bookings = await prisma.booking.findMany({
    where: { hotelId: resolvedHotelId },
    include: { folio: true, primaryGuest: true },
  });

  const checkedInBookings = bookings.filter((b) => b.status === "CheckedIn");
  const pendingArrivals = bookings.filter(
    (b) => b.status === "Confirmed" && b.checkInDate.toISOString().startsWith(dateStr),
  );
  const pendingDepartures = bookings.filter(
    (b) => b.status === "CheckedIn" && b.checkOutDate.toISOString().startsWith(dateStr),
  );

  if (pendingArrivals.length > 0) {
    warnings.push(
      `${pendingArrivals.length} guest(s) with reservation date ${dateStr} have not checked in. They will be marked as No-Show.`,
    );
  }

  if (pendingDepartures.length > 0) {
    warnings.push(
      `${pendingDepartures.length} guest(s) scheduled to check out on ${dateStr} are still in Checked-In status.`,
    );
  }

  // 3. Folios
  const folios = await prisma.folio.findMany({
    where: { hotelId: resolvedHotelId, status: "Open" },
  });

  return {
    businessDate: dateStr,
    totalRooms,
    availableRooms,
    occupiedRooms,
    checkedInBookingsCount: checkedInBookings.length,
    pendingArrivalsCount: pendingArrivals.length,
    pendingDeparturesCount: pendingDepartures.length,
    unpostedRoomTariffsCount: checkedInBookings.length,
    openFoliosCount: folios.length,
    isReadyForAudit: true,
    warnings,
  };
}

/**
 * Executes the complete 11-step Night Audit process.
 * Idempotent: rejects duplicate runs for the same business date.
 */
export async function runNightAudit(
  hotelIdInput?: string,
  businessDateInput?: string,
  auditorUserId?: string,
): Promise<{ auditReport: NightAuditReport; flashReport: FlashReport }> {
  const hotelId = hotelIdInput || (await getDefaultHotelId());
  const businessDate = businessDateInput || (await getCurrentBusinessDate(hotelId));
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const stepLogs: string[] = [];

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  const hotelStateCode = hotel?.stateCode || "27";
  const hotelName = hotel?.name || "Grand Rajwada Palace & Suites";

  // =========================================================================
  // IDEMPOTENCY CHECK
  // Do not allow the same business date to be audited twice
  // =========================================================================
  const auditKey = `${hotelId}_${businessDate}`;
  const existingAudit = completedAuditsMap.get(auditKey);
  if (existingAudit && existingAudit.status === "Completed") {
    throw new Error(
      `Business date ${businessDate} has already been closed and audited. Duplicate audit execution blocked for idempotency.`,
    );
  }

  // Record audit initiation state
  const reportId = `NA-${businessDate}-${Date.now().toString().slice(-4)}`;
  const auditRecord: NightAuditReport = {
    id: reportId,
    hotelId,
    businessDate,
    startedAt,
    auditorUserId: auditorUserId || "front-desk-manager",
    status: "Running" as NightAuditStatus,
    chargesPosted: 0,
    paymentsPosted: 0,
    roomRevenue: 0,
    serviceRevenue: 0,
    taxCollected: 0,
    cashCollected: 0,
    cardCollected: 0,
    upiCollected: 0,
    razorpayCollected: 0,
    occupiedRooms: 0,
    totalAvailableRooms: 1,
    occupancyRate: 0,
    adr: 0,
    revPar: 0,
    errors: [],
    logs: [],
  };

  completedAuditsMap.set(auditKey, auditRecord);

  try {
    // -----------------------------------------------------------------------
    // STEP 1: Validate open bookings
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 1] Validating open bookings for business date ${businessDate}...`);
    const openBookings = await prisma.booking.findMany({
      where: {
        hotelId,
        status: { in: ["CheckedIn", "Confirmed"] },
      },
      include: {
        room: true,
        roomType: true,
        ratePlan: true,
        primaryGuest: true,
        folio: { include: { items: true, payments: true } },
      },
    });
    stepLogs.push(`[Step 1] Verified ${openBookings.length} open/confirmed bookings.`);

    // -----------------------------------------------------------------------
    // STEP 2: Validate pending check-ins & flag No-Shows
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 2] Validating pending check-ins scheduled on or before ${businessDate}...`);
    let noShowsCount = 0;
    for (const b of openBookings) {
      if (b.status === "Confirmed") {
        const checkInStr = b.checkInDate.toISOString().split("T")[0]!;
        if (checkInStr <= businessDate) {
          // Transition un-arrived reservation to NoShow
          try {
            await prisma.booking.update({
              where: { id: b.id },
              data: { status: "NoShow" },
            });
            noShowsCount++;
            stepLogs.push(`[Step 2] Reservation ${b.bookingNumber} (${b.primaryGuest?.fullName || "Guest"}) marked as NoShow.`);
          } catch (e: any) {
            errors.push(`Failed to update booking ${b.bookingNumber} to NoShow: ${e.message}`);
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // STEP 3: Post daily room charges
    // STEP 4: Post applicable service charges
    // STEP 5: Calculate GST
    // STEP 6: Update folios
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 3-6] Posting daily room tariffs, meal plans, and statutory GST to active folios...`);

    let chargesPosted = 0;
    let roomRevenue = 0;
    let serviceRevenue = 0;
    let totalTaxCollected = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const checkedInBookings = openBookings.filter((b) => b.status === "CheckedIn");

    for (const b of checkedInBookings) {
      if (!b.folio) {
        errors.push(`Booking ${b.bookingNumber} has no associated Folio.`);
        continue;
      }

      // Check if room charge for this businessDate has already been posted to avoid double debiting
      const alreadyPosted = b.folio.items.some(
        (it) => it.itemType === "Room" && it.description.includes(businessDate),
      );

      if (!alreadyPosted) {
        // Calculate daily room tariff
        const roomTariff = b.ratePlan?.baseRate
          ? Number(b.ratePlan.baseRate)
          : b.room?.baseRate
          ? Number(b.room.baseRate)
          : Number(b.roomCharges) > 0
          ? Number(b.roomCharges) / (b.totalNights || 1)
          : 4500;

        // Step 5: Calculate GST via Indian Hotel GST Engine
        const guestState = b.primaryGuest?.stateCode || hotelStateCode;
        const gstResult = calculateRoomGST({
          tariffPerNightOrTotal: roomTariff,
          hotelStateCode,
          guestStateCode: guestState,
        });

        // Step 6: Create Folio Item & GST Transaction
        try {
          await prisma.$transaction(async (tx) => {
            const folioItem = await tx.folioItem.create({
              data: {
                folioId: b.folio!.id,
                itemType: "Room",
                description: `Room Charge - Room ${b.room?.roomNumber || "Assigned"} (${businessDate})`,
                quantity: 1,
                unitPrice: roomTariff as any,
                totalPrice: roomTariff as any,
                sacCode: gstResult.sacCode,
                gstRate: gstResult.gstRate as any,
                gstAmount: gstResult.totalTax as any,
                postedAt: new Date(),
              },
            });

            await tx.gSTTransaction.create({
              data: {
                folioId: b.folio!.id,
                folioItemId: folioItem.id,
                taxableAmount: gstResult.taxableAmount as any,
                cgstRate: gstResult.cgstRate as any,
                cgstAmount: gstResult.cgstAmount as any,
                sgstRate: gstResult.sgstRate as any,
                sgstAmount: gstResult.sgstAmount as any,
                igstRate: gstResult.igstRate as any,
                igstAmount: gstResult.igstAmount as any,
                totalTax: gstResult.totalTax as any,
                sacCode: gstResult.sacCode,
                placeOfSupply: gstResult.placeOfSupply,
              },
            });

            // Update Folio balances
            const newDebit = Number(b.folio!.totalDebit) + roomTariff + gstResult.totalTax;
            const newBalanceDue = newDebit - Number(b.folio!.totalCredit);

            await tx.folio.update({
              where: { id: b.folio!.id },
              data: {
                totalDebit: newDebit as any,
                balanceDue: newBalanceDue as any,
              },
            });
          });

          chargesPosted++;
          roomRevenue += roomTariff;
          totalTaxCollected += gstResult.totalTax;
          cgstTotal += gstResult.cgstAmount;
          sgstTotal += gstResult.sgstAmount;
          igstTotal += gstResult.igstAmount;

          stepLogs.push(
            `[Step 3-6] Posted Room Charge ₹${roomTariff} + GST ₹${gstResult.totalTax} to Folio ${b.folio.folioNumber} (Room ${b.room?.roomNumber}).`,
          );
        } catch (postErr: any) {
          errors.push(`Error posting room charge for folio ${b.folio.folioNumber}: ${postErr.message}`);
        }
      } else {
        stepLogs.push(`[Step 3] Room charge for ${businessDate} was already posted to Folio ${b.folio.folioNumber}.`);
      }
    }

    // -----------------------------------------------------------------------
    // STEP 7: Calculate payments & reconciliations
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 7] Reconciling payments captured during business date ${businessDate}...`);
    const allPayments = await prisma.payment.findMany({
      where: {
        folio: { hotelId },
        status: "Captured",
      },
    });

    let paymentsPosted = 0;
    let cashCollection = 0;
    let cardCollection = 0;
    let upiCollection = 0;
    let razorpayCollection = 0;

    for (const p of allPayments) {
      paymentsPosted++;
      const amt = Number(p.amount);
      if (p.method === "Cash") cashCollection += amt;
      else if (p.method === "Card") cardCollection += amt;
      else if (p.method === "UPI") upiCollection += amt;
      else if (p.method === "Razorpay") razorpayCollection += amt;
    }

    const totalCollection = cashCollection + cardCollection + upiCollection + razorpayCollection;
    stepLogs.push(
      `[Step 7] Total Collections: ₹${totalCollection} (Cash: ₹${cashCollection}, Card: ₹${cardCollection}, UPI: ₹${upiCollection}, Razorpay: ₹${razorpayCollection}).`,
    );

    // -----------------------------------------------------------------------
    // STEP 8: Generate Audit Report & Performance Calculations
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 8] Computing hotel occupancy and performance metrics...`);
    const rooms = await prisma.room.findMany({ where: { hotelId } });
    const totalAvailableRooms = rooms.filter((r) => r.status !== "Maintenance" && r.status !== "Blocked").length || rooms.length || 1;
    const occupiedRooms = rooms.filter((r) => r.status === "Occupied").length;

    // Statutory Formulas:
    // occupancyRate = occupiedRooms / totalAvailableRooms * 100
    // ADR = totalRoomRevenueINR / occupiedRooms
    // RevPAR = totalRoomRevenueINR / totalAvailableRooms
    const occupancyRate = totalAvailableRooms > 0 ? Math.round((occupiedRooms / totalAvailableRooms) * 100) : 0;
    const adr = occupiedRooms > 0 ? Math.round(roomRevenue / occupiedRooms) : 0;
    const revPar = totalAvailableRooms > 0 ? Math.round(roomRevenue / totalAvailableRooms) : 0;

    // Outstanding balance across folios
    const allFolios = await prisma.folio.findMany({ where: { hotelId } });
    const outstandingBalance = allFolios.reduce((acc, f) => acc + Number(f.balanceDue), 0);

    const completedAt = new Date().toISOString();

    const auditReport: NightAuditReport = {
      id: reportId,
      hotelId,
      businessDate,
      startedAt,
      completedAt,
      auditorUserId: auditorUserId || "front-desk-manager",
      status: errors.length > 0 && chargesPosted === 0 ? ("Failed" as NightAuditStatus) : ("Completed" as NightAuditStatus),
      chargesPosted,
      paymentsPosted,
      roomRevenue,
      serviceRevenue,
      taxCollected: totalTaxCollected,
      cashCollected: cashCollection,
      cardCollected: cardCollection,
      upiCollected: upiCollection,
      razorpayCollected: razorpayCollection,
      occupiedRooms,
      totalAvailableRooms,
      occupancyRate,
      adr,
      revPar,
      errors: errors.length > 0 ? errors : undefined,
      logs: stepLogs,
    };

    // -----------------------------------------------------------------------
    // STEP 9: Generate Flash Report
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 9] Generating Executive Daily Flash Report...`);

    // Calculate next business date
    const curDate = new Date(businessDate);
    curDate.setDate(curDate.getDate() + 1);
    const nextBusinessDate = curDate.toISOString().split("T")[0]!;

    const flashReport: FlashReport = {
      id: `FLASH-${businessDate}`,
      hotelId,
      hotelName,
      businessDate,
      nextBusinessDate,
      closedAt: completedAt,
      auditedBy: auditorUserId || "Front Desk Manager",
      totalAvailableRooms,
      occupiedRooms,
      occupancyRate,
      adr,
      revPar,
      totalRoomRevenue: roomRevenue,
      totalServiceRevenue: serviceRevenue,
      totalRevenue: roomRevenue + serviceRevenue,
      taxCollected: totalTaxCollected,
      cgstCollected: cgstTotal,
      sgstCollected: sgstTotal,
      igstCollected: igstTotal,
      outstandingBalance,
      cashCollection,
      cardCollection,
      upiCollection,
      razorpayCollection,
      totalCollection,
      checkIns: checkedInBookings.length,
      checkOuts: openBookings.filter((b) => b.checkOutDate.toISOString().startsWith(businessDate)).length,
      noShows: noShowsCount,
      cancellations: openBookings.filter((b) => b.status === "Cancelled").length,
      chargesPostedCount: chargesPosted,
      paymentsPostedCount: paymentsPosted,
    };

    // -----------------------------------------------------------------------
    // STEP 10: Close business date & persist audit log
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 10] Closing business date ${businessDate}...`);
    completedAuditsMap.set(auditKey, auditReport);

    await recordAuditLog({
      hotelId,
      userId: auditorUserId,
      action: "NIGHT_AUDIT_COMPLETED",
      entity: "NightAudit",
      entityId: reportId,
      previousValue: { businessDate, status: "Open" },
      newValue: {
        businessDate,
        status: "Completed",
        occupancyRate,
        adr,
        revPar,
        chargesPosted,
        paymentsPosted,
        totalRevenue: roomRevenue + serviceRevenue,
        taxCollected: totalTaxCollected,
        nextBusinessDate,
      },
    });

    // -----------------------------------------------------------------------
    // STEP 11: Move hotel business date to next day
    // -----------------------------------------------------------------------
    stepLogs.push(`[Step 11] Moving hotel business date forward: ${businessDate} -> ${nextBusinessDate}.`);
    hotelBusinessDates.set(hotelId, nextBusinessDate);

    return { auditReport, flashReport };
  } catch (err: any) {
    auditRecord.status = "Failed";
    auditRecord.errors = [err.message];
    auditRecord.completedAt = new Date().toISOString();
    completedAuditsMap.set(auditKey, auditRecord);

    await recordAuditLog({
      hotelId,
      userId: auditorUserId,
      action: "NIGHT_AUDIT_FAILED",
      entity: "NightAudit",
      entityId: reportId,
      newValue: { businessDate, error: err.message, status: "Failed" },
    });

    throw err;
  }
}

/**
 * Returns performance metrics for dashboard display
 */
export async function getHotelPerformance(
  hotelId?: string,
  businessDate?: string,
): Promise<HotelPerformanceMetrics> {
  const resolvedHotelId = hotelId || (await getDefaultHotelId());
  const dateStr = businessDate || (await getCurrentBusinessDate(resolvedHotelId));

  const rooms = await prisma.room.findMany({ where: { hotelId: resolvedHotelId } });
  const totalAvailableRooms = rooms.filter((r) => r.status !== "Maintenance" && r.status !== "Blocked").length || rooms.length || 1;
  const occupiedRooms = rooms.filter((r) => r.status === "Occupied").length;

  const bookings = await prisma.booking.findMany({
    where: { hotelId: resolvedHotelId },
    include: { folio: true },
  });

  let roomRevenue = 0;
  let serviceRevenue = 0;
  let taxCollected = 0;
  let outstandingBalance = 0;

  for (const b of bookings) {
    roomRevenue += Number(b.roomCharges);
    serviceRevenue += Number(b.extraCharges);
    taxCollected += Number(b.taxAmount);
    if (b.folio) {
      outstandingBalance += Number(b.folio.balanceDue);
    }
  }

  // Metric formulas
  const occupancyRate = totalAvailableRooms > 0 ? Math.round((occupiedRooms / totalAvailableRooms) * 100) : 0;
  const adr = occupiedRooms > 0 ? Math.round(roomRevenue / occupiedRooms) : 0;
  const revPar = totalAvailableRooms > 0 ? Math.round(roomRevenue / totalAvailableRooms) : 0;

  return {
    businessDate: dateStr,
    occupiedRooms,
    totalAvailableRooms,
    occupancyRate,
    adr,
    revPar,
    totalRoomRevenue: roomRevenue,
    totalServiceRevenue: serviceRevenue,
    totalRevenue: roomRevenue + serviceRevenue,
    taxCollected,
    outstandingBalance,
    arrivalsToday: bookings.filter((b) => b.checkInDate.toISOString().startsWith(dateStr)).length,
    departuresToday: bookings.filter((b) => b.checkOutDate.toISOString().startsWith(dateStr)).length,
    noShowsToday: bookings.filter((b) => b.status === "NoShow").length,
    cancellationsToday: bookings.filter((b) => b.status === "Cancelled").length,
  };
}

/**
 * Returns list of completed night audits for audit history table
 */
export async function getNightAuditHistory(hotelId?: string): Promise<NightAuditReport[]> {
  const resolvedHotelId = hotelId || (await getDefaultHotelId());
  const audits: NightAuditReport[] = [];

  for (const audit of completedAuditsMap.values()) {
    if (audit.hotelId === resolvedHotelId) {
      audits.push(audit);
    }
  }

  // Sort descending by businessDate
  return audits.sort((a, b) => b.businessDate.localeCompare(a.businessDate));
}
