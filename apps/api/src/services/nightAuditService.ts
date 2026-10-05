import { prisma } from "../db/prisma";
import { NightAuditReport, HotelPerformanceMetrics } from "@hotel/types";
import { recordAuditLog } from "./auditService";

export async function runNightAudit(hotelId: string, businessDate: string, auditorUserId?: string): Promise<NightAuditReport> {
  const startedAt = new Date().toISOString();

  // 1. Fetch hotel rooms to compute inventory
  const rooms = await prisma.room.findMany({ where: { hotelId } });
  const totalAvailableRooms = rooms.filter((r) => r.status !== "Maintenance" && r.status !== "Blocked").length || rooms.length || 1;
  const occupiedRooms = rooms.filter((r) => r.status === "Occupied").length;

  // 2. Fetch today's folio charges and payments
  const folios = await prisma.folio.findMany({
    where: { hotelId },
    include: {
      items: { where: { isVoided: false } },
      payments: { where: { status: "Captured" } },
    },
  });

  let roomRevenue = 0;
  let serviceRevenue = 0;
  let taxCollected = 0;
  let cashCollected = 0;
  let cardCollected = 0;
  let upiCollected = 0;
  let razorpayCollected = 0;
  let chargesPosted = 0;
  let paymentsPosted = 0;

  for (const f of folios) {
    for (const it of f.items) {
      chargesPosted++;
      const price = Number(it.totalPrice);
      const tax = Number(it.gstAmount);
      taxCollected += tax;
      if (it.itemType === "Room") {
        roomRevenue += price;
      } else {
        serviceRevenue += price;
      }
    }

    for (const p of f.payments) {
      paymentsPosted++;
      const amt = Number(p.amount);
      if (p.method === "Cash") cashCollected += amt;
      else if (p.method === "Card") cardCollected += amt;
      else if (p.method === "UPI") upiCollected += amt;
      else if (p.method === "Razorpay") razorpayCollected += amt;
    }
  }

  // 3. Compute KPI Metrics
  const occupancyRate = Math.round((occupiedRooms / totalAvailableRooms) * 100);
  const adr = occupiedRooms > 0 ? Math.round(roomRevenue / occupiedRooms) : 0;
  const revPar = Math.round(roomRevenue / totalAvailableRooms);

  const completedAt = new Date().toISOString();

  const report: NightAuditReport = {
    id: `NA-${businessDate}-${Math.floor(1000 + Math.random() * 9000)}`,
    hotelId,
    businessDate,
    startedAt,
    completedAt,
    auditorUserId: auditorUserId || "system",
    status: "Completed",
    chargesPosted,
    paymentsPosted,
    roomRevenue,
    serviceRevenue,
    taxCollected,
    cashCollected,
    cardCollected,
    upiCollected,
    razorpayCollected,
    occupiedRooms,
    totalAvailableRooms,
    occupancyRate,
    adr,
    revPar,
  };

  await recordAuditLog({
    hotelId,
    userId: auditorUserId,
    action: "NIGHT_AUDIT_COMPLETED",
    entity: "NightAudit",
    entityId: report.id,
    newValue: report as any,
  });

  return report;
}

export async function getHotelPerformance(hotelId?: string): Promise<HotelPerformanceMetrics> {
  const rooms = await prisma.room.findMany({ where: hotelId ? { hotelId } : {} });
  const totalAvailableRooms = rooms.filter((r) => r.status !== "Maintenance" && r.status !== "Blocked").length || rooms.length || 1;
  const occupiedRooms = rooms.filter((r) => r.status === "Occupied").length;

  const bookings = await prisma.booking.findMany({
    where: hotelId ? { hotelId } : {},
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

  const occupancyRate = Math.round((occupiedRooms / totalAvailableRooms) * 100);
  const adr = occupiedRooms > 0 ? Math.round(roomRevenue / occupiedRooms) : 0;
  const revPar = Math.round(roomRevenue / totalAvailableRooms);

  const todayStr = new Date().toISOString().split("T")[0]!;

  return {
    businessDate: todayStr,
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
    arrivalsToday: bookings.filter((b) => b.checkInDate.toISOString().startsWith(todayStr)).length,
    departuresToday: bookings.filter((b) => b.checkOutDate.toISOString().startsWith(todayStr)).length,
    noShowsToday: bookings.filter((b) => b.status === "NoShow").length,
    cancellationsToday: bookings.filter((b) => b.status === "Cancelled").length,
  };
}
