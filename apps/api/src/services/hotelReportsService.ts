import { prisma } from "../db/prisma";
import type {
  HotelReportType,
  ReportFilterPreset,
  HotelReportResponse,
  ReportColumn,
  ReportSummaryItem,
} from "@hotel/types";
import {
  resolveReportDateRange,
  formatINR,
  roundCurrency,
} from "@hotel/utils";
import { getDefaultHotelId } from "./roomService";
import { getCurrentBusinessDate } from "./nightAuditService";

const SAC_DESCRIPTIONS: Record<string, string> = {
  "996311": "Hotel Accommodation / Room Tariff",
  "996331": "Restaurant & In-Room Dining",
  "999799": "Laundry & Housekeeping Add-ons",
  "997212": "Banquet Hall & Event Spaces",
  "999722": "Spa & Wellness Services",
  "998599": "Other Hospitality Services",
};

export async function generateHotelReport(
  reportType: HotelReportType,
  preset: ReportFilterPreset = "today",
  customStart?: string,
  customEnd?: string,
  hotelIdInput?: string,
): Promise<HotelReportResponse> {
  const hotelId = hotelIdInput || (await getDefaultHotelId());
  const businessDate = await getCurrentBusinessDate(hotelId);
  const now = new Date(`${businessDate}T12:00:00.000Z`);

  const { startDate, endDate, startDateTime, endDateTime } = resolveReportDateRange(
    preset,
    customStart,
    customEnd,
    now,
  );

  switch (reportType) {
    case "daily-revenue":
      return await getDailyRevenueReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "occupancy":
      return await getOccupancyReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "adr":
      return await getADRReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "revpar":
      return await getRevPARReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "gst":
      return await getGSTReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "payment-collection":
      return await getPaymentCollectionReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "outstanding-folio":
      return await getOutstandingFolioReport(hotelId, preset, startDate, endDate);
    case "check-in":
      return await getCheckInReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "check-out":
      return await getCheckOutReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "cancellation":
      return await getCancellationReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "no-show":
      return await getNoShowReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "room-status":
      return await getRoomStatusReport(hotelId, preset, startDate, endDate);
    case "service-revenue":
      return await getServiceRevenueReport(hotelId, preset, startDate, endDate, startDateTime, endDateTime);
    case "loyalty":
      return await getLoyaltyReport(hotelId, preset, startDate, endDate);
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

// ---------------------------------------------------------------------------
// 1. DAILY REVENUE REPORT
// ---------------------------------------------------------------------------
async function getDailyRevenueReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const [items, payments] = await Promise.all([
    prisma.folioItem.findMany({
      where: {
        folio: { hotelId },
        isVoided: false,
        postedAt: { gte: startDateTime, lte: endDateTime },
      },
      select: { itemType: true, totalPrice: true, gstAmount: true, postedAt: true },
    }),
    prisma.payment.findMany({
      where: {
        folio: { hotelId },
        status: "Captured",
        receivedAt: { gte: startDateTime, lte: endDateTime },
      },
      select: { amount: true, receivedAt: true },
    }),
  ]);

  // Aggregate by date (YYYY-MM-DD)
  const daysMap = new Map<string, {
    date: string;
    roomRevenue: number;
    serviceRevenue: number;
    totalTax: number;
    grossBilled: number;
    netCollected: number;
  }>();

  for (const item of items) {
    const d = item.postedAt.toISOString().slice(0, 10);
    const existing = daysMap.get(d) || {
      date: d,
      roomRevenue: 0,
      serviceRevenue: 0,
      totalTax: 0,
      grossBilled: 0,
      netCollected: 0,
    };

    const price = Number(item.totalPrice);
    const tax = Number(item.gstAmount);

    if (item.itemType === "Room") {
      existing.roomRevenue += price;
    } else {
      existing.serviceRevenue += price;
    }
    existing.totalTax += tax;
    existing.grossBilled += price + tax;
    daysMap.set(d, existing);
  }

  for (const p of payments) {
    const d = p.receivedAt.toISOString().slice(0, 10);
    const existing = daysMap.get(d) || {
      date: d,
      roomRevenue: 0,
      serviceRevenue: 0,
      totalTax: 0,
      grossBilled: 0,
      netCollected: 0,
    };
    existing.netCollected += Number(p.amount);
    daysMap.set(d, existing);
  }

  const rows = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // If no items yet, ensure at least one row for the filter date
  if (rows.length === 0) {
    rows.push({
      date: startDate,
      roomRevenue: 0,
      serviceRevenue: 0,
      totalTax: 0,
      grossBilled: 0,
      netCollected: 0,
    });
  }

  let totalRoom = 0;
  let totalService = 0;
  let totalTax = 0;
  let totalGross = 0;
  let totalCollected = 0;

  for (const r of rows) {
    r.roomRevenue = roundCurrency(r.roomRevenue);
    r.serviceRevenue = roundCurrency(r.serviceRevenue);
    r.totalTax = roundCurrency(r.totalTax);
    r.grossBilled = roundCurrency(r.grossBilled);
    r.netCollected = roundCurrency(r.netCollected);

    totalRoom += r.roomRevenue;
    totalService += r.serviceRevenue;
    totalTax += r.totalTax;
    totalGross += r.grossBilled;
    totalCollected += r.netCollected;
  }

  const columns: ReportColumn[] = [
    { key: "date", label: "Date", format: "text", align: "left" },
    { key: "roomRevenue", label: "Room Revenue (₹)", format: "currency", align: "right" },
    { key: "serviceRevenue", label: "Service / F&B (₹)", format: "currency", align: "right" },
    { key: "totalTax", label: "GST Tax (₹)", format: "currency", align: "right" },
    { key: "grossBilled", label: "Gross Billed (₹)", format: "currency", align: "right" },
    { key: "netCollected", label: "Payments Collected (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Room Revenue", value: formatINR(totalRoom), format: "text" },
    { label: "Total Services & F&B", value: formatINR(totalService), format: "text" },
    { label: "Total GST Tax", value: formatINR(totalTax), format: "text" },
    { label: "Total Gross Billed", value: formatINR(totalGross), format: "text" },
    { label: "Net Cash/Gateway Collected", value: formatINR(totalCollected), format: "text" },
  ];

  return {
    reportType: "daily-revenue",
    title: "Daily Revenue & Earnings Report",
    description: "Detailed daily breakdown of room charges, ancillary services, GST distribution, and net receipts.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      date: "TOTAL",
      roomRevenue: roundCurrency(totalRoom),
      serviceRevenue: roundCurrency(totalService),
      totalTax: roundCurrency(totalTax),
      grossBilled: roundCurrency(totalGross),
      netCollected: roundCurrency(totalCollected),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 2. OCCUPANCY REPORT
// ---------------------------------------------------------------------------
async function getOccupancyReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const [totalRoomsCount, bookings] = await Promise.all([
    prisma.room.count({ where: { hotelId, isActive: true } }),
    prisma.booking.findMany({
      where: {
        hotelId,
        status: { in: ["Confirmed", "CheckedIn", "CheckedOut"] },
        checkInDate: { lte: endDateTime },
        checkOutDate: { gte: startDateTime },
      },
      select: { checkInDate: true, checkOutDate: true },
    }),
  ]);

  const totalUsableRooms = totalRoomsCount > 0 ? totalRoomsCount : 25; // default fallback

  // Generate day-by-day dates
  const cur = new Date(startDateTime);
  const rows: Array<{
    date: string;
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyRate: number;
  }> = [];

  let sumOccupancy = 0;
  let totalOccupiedNights = 0;

  while (cur <= endDateTime) {
    const dayStr = cur.toISOString().slice(0, 10);
    const nextDay = new Date(cur);
    nextDay.setDate(nextDay.getDate() + 1);

    const occupiedOnDay = bookings.filter((b) => {
      return b.checkInDate < nextDay && b.checkOutDate > cur;
    }).length;

    const available = Math.max(0, totalUsableRooms - occupiedOnDay);
    const occRate = Math.round((occupiedOnDay / totalUsableRooms) * 100);

    rows.push({
      date: dayStr,
      totalRooms: totalUsableRooms,
      occupiedRooms: occupiedOnDay,
      availableRooms: available,
      occupancyRate: occRate,
    });

    sumOccupancy += occRate;
    totalOccupiedNights += occupiedOnDay;

    cur.setDate(cur.getDate() + 1);
  }

  const avgOccupancy = rows.length > 0 ? Math.round(sumOccupancy / rows.length) : 0;
  const peakOccupancy = rows.length > 0 ? Math.max(...rows.map((r) => r.occupancyRate)) : 0;

  const columns: ReportColumn[] = [
    { key: "date", label: "Date", format: "text", align: "left" },
    { key: "totalRooms", label: "Total Inventory", format: "number", align: "center" },
    { key: "occupiedRooms", label: "Occupied Rooms", format: "number", align: "center" },
    { key: "availableRooms", label: "Available / Vacant", format: "number", align: "center" },
    { key: "occupancyRate", label: "Occupancy %", format: "percent", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Active Room Inventory", value: totalUsableRooms, format: "number" },
    { label: "Average Occupancy Rate", value: `${avgOccupancy}%`, format: "text" },
    { label: "Peak Occupancy Rate", value: `${peakOccupancy}%`, format: "text" },
    { label: "Total Room Nights Sold", value: totalOccupiedNights, format: "number" },
  ];

  return {
    reportType: "occupancy",
    title: "Hotel Room Occupancy Report",
    description: "Daily room capacity utilization, vacant inventory count, and percentage occupancy.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      date: "AVERAGE / SUM",
      totalRooms: totalUsableRooms,
      occupiedRooms: totalOccupiedNights,
      availableRooms: Math.max(0, totalUsableRooms * rows.length - totalOccupiedNights),
      occupancyRate: `${avgOccupancy}%`,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 3. ADR (AVERAGE DAILY RATE) REPORT
// ---------------------------------------------------------------------------
async function getADRReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const [bookings, roomItems] = await Promise.all([
    prisma.booking.findMany({
      where: {
        hotelId,
        status: { in: ["Confirmed", "CheckedIn", "CheckedOut"] },
        checkInDate: { lte: endDateTime },
        checkOutDate: { gte: startDateTime },
      },
      select: { checkInDate: true, checkOutDate: true, roomCharges: true, totalNights: true },
    }),
    prisma.folioItem.findMany({
      where: {
        folio: { hotelId },
        itemType: "Room",
        isVoided: false,
        postedAt: { gte: startDateTime, lte: endDateTime },
      },
      select: { totalPrice: true, postedAt: true },
    }),
  ]);

  const cur = new Date(startDateTime);
  const rows: Array<{
    date: string;
    occupiedRooms: number;
    roomRevenue: number;
    adr: number;
  }> = [];

  let totalRev = 0;
  let totalRoomsOcc = 0;

  while (cur <= endDateTime) {
    const dayStr = cur.toISOString().slice(0, 10);
    const nextDay = new Date(cur);
    nextDay.setDate(nextDay.getDate() + 1);

    // Active bookings
    const active = bookings.filter((b) => b.checkInDate < nextDay && b.checkOutDate > cur);
    const occupied = active.length;

    // Daily revenue from items posted on this date, or pro-rated booking daily charges
    let dailyRev = roomItems
      .filter((i) => i.postedAt.toISOString().slice(0, 10) === dayStr)
      .reduce((sum, i) => sum + Number(i.totalPrice), 0);

    if (dailyRev === 0 && occupied > 0) {
      dailyRev = active.reduce((sum, b) => {
        const nightly = Number(b.roomCharges) / Math.max(1, b.totalNights);
        return sum + nightly;
      }, 0);
    }

    dailyRev = roundCurrency(dailyRev);
    const adr = occupied > 0 ? roundCurrency(dailyRev / occupied) : 0;

    rows.push({
      date: dayStr,
      occupiedRooms: occupied,
      roomRevenue: dailyRev,
      adr,
    });

    totalRev += dailyRev;
    totalRoomsOcc += occupied;
    cur.setDate(cur.getDate() + 1);
  }

  const overallADR = totalRoomsOcc > 0 ? roundCurrency(totalRev / totalRoomsOcc) : 0;
  const peakADR = rows.length > 0 ? Math.max(...rows.map((r) => r.adr)) : 0;

  const columns: ReportColumn[] = [
    { key: "date", label: "Date", format: "text", align: "left" },
    { key: "occupiedRooms", label: "Occupied Rooms", format: "number", align: "center" },
    { key: "roomRevenue", label: "Room Revenue (₹)", format: "currency", align: "right" },
    { key: "adr", label: "ADR (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Overall Weighted ADR", value: formatINR(overallADR), format: "text" },
    { label: "Peak Single-Day ADR", value: formatINR(peakADR), format: "text" },
    { label: "Total Room Revenue", value: formatINR(totalRev), format: "text" },
    { label: "Total Occupied Room Nights", value: totalRoomsOcc, format: "number" },
  ];

  return {
    reportType: "adr",
    title: "Average Daily Rate (ADR) Report",
    description: "Average realized rental revenue per occupied room calculated daily across the property.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      date: "OVERALL",
      occupiedRooms: totalRoomsOcc,
      roomRevenue: roundCurrency(totalRev),
      adr: overallADR,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 4. REVPAR (REVENUE PER AVAILABLE ROOM) REPORT
// ---------------------------------------------------------------------------
async function getRevPARReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const [totalRoomsCount, bookings, roomItems] = await Promise.all([
    prisma.room.count({ where: { hotelId, isActive: true } }),
    prisma.booking.findMany({
      where: {
        hotelId,
        status: { in: ["Confirmed", "CheckedIn", "CheckedOut"] },
        checkInDate: { lte: endDateTime },
        checkOutDate: { gte: startDateTime },
      },
      select: { checkInDate: true, checkOutDate: true, roomCharges: true, totalNights: true },
    }),
    prisma.folioItem.findMany({
      where: {
        folio: { hotelId },
        itemType: "Room",
        isVoided: false,
        postedAt: { gte: startDateTime, lte: endDateTime },
      },
      select: { totalPrice: true, postedAt: true },
    }),
  ]);

  const totalUsableRooms = totalRoomsCount > 0 ? totalRoomsCount : 25;

  const cur = new Date(startDateTime);
  const rows: Array<{
    date: string;
    totalRooms: number;
    occupiedRooms: number;
    occupancyRate: number;
    roomRevenue: number;
    adr: number;
    revPar: number;
  }> = [];

  let totalRev = 0;
  let totalRoomsOcc = 0;

  while (cur <= endDateTime) {
    const dayStr = cur.toISOString().slice(0, 10);
    const nextDay = new Date(cur);
    nextDay.setDate(nextDay.getDate() + 1);

    const active = bookings.filter((b) => b.checkInDate < nextDay && b.checkOutDate > cur);
    const occupied = active.length;
    const occRate = Math.round((occupied / totalUsableRooms) * 100);

    let dailyRev = roomItems
      .filter((i) => i.postedAt.toISOString().slice(0, 10) === dayStr)
      .reduce((sum, i) => sum + Number(i.totalPrice), 0);

    if (dailyRev === 0 && occupied > 0) {
      dailyRev = active.reduce((sum, b) => {
        const nightly = Number(b.roomCharges) / Math.max(1, b.totalNights);
        return sum + nightly;
      }, 0);
    }

    dailyRev = roundCurrency(dailyRev);
    const adr = occupied > 0 ? roundCurrency(dailyRev / occupied) : 0;
    const revPar = totalUsableRooms > 0 ? roundCurrency(dailyRev / totalUsableRooms) : 0;

    rows.push({
      date: dayStr,
      totalRooms: totalUsableRooms,
      occupiedRooms: occupied,
      occupancyRate: occRate,
      roomRevenue: dailyRev,
      adr,
      revPar,
    });

    totalRev += dailyRev;
    totalRoomsOcc += occupied;
    cur.setDate(cur.getDate() + 1);
  }

  const overallRevPar =
    rows.length > 0 ? roundCurrency(totalRev / (totalUsableRooms * rows.length)) : 0;
  const overallADR = totalRoomsOcc > 0 ? roundCurrency(totalRev / totalRoomsOcc) : 0;
  const avgOcc = rows.length > 0 ? Math.round((totalRoomsOcc / (totalUsableRooms * rows.length)) * 100) : 0;

  const columns: ReportColumn[] = [
    { key: "date", label: "Date", format: "text", align: "left" },
    { key: "totalRooms", label: "Available Rooms", format: "number", align: "center" },
    { key: "occupiedRooms", label: "Occupied Rooms", format: "number", align: "center" },
    { key: "occupancyRate", label: "Occupancy %", format: "percent", align: "right" },
    { key: "roomRevenue", label: "Room Revenue (₹)", format: "currency", align: "right" },
    { key: "adr", label: "ADR (₹)", format: "currency", align: "right" },
    { key: "revPar", label: "RevPAR (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Overall RevPAR", value: formatINR(overallRevPar), format: "text" },
    { label: "Overall ADR", value: formatINR(overallADR), format: "text" },
    { label: "Average Occupancy", value: `${avgOcc}%`, format: "text" },
    { label: "Total Room Revenue", value: formatINR(totalRev), format: "text" },
  ];

  return {
    reportType: "revpar",
    title: "RevPAR (Revenue Per Available Room) Report",
    description: "Statutory hospitality performance metric combining average daily rate and property inventory occupancy.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      date: "OVERALL",
      totalRooms: totalUsableRooms,
      occupiedRooms: totalRoomsOcc,
      occupancyRate: `${avgOcc}%`,
      roomRevenue: roundCurrency(totalRev),
      adr: overallADR,
      revPar: overallRevPar,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 5. GST REPORT
// ---------------------------------------------------------------------------
async function getGSTReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const txns = await prisma.gSTTransaction.findMany({
    where: {
      folio: { hotelId },
      createdAt: { gte: startDateTime, lte: endDateTime },
    },
    select: {
      sacCode: true,
      taxableAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      totalTax: true,
    },
  });

  const sacMap = new Map<string, {
    sacCode: string;
    description: string;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
  }>();

  for (const t of txns) {
    const sac = t.sacCode;
    const existing = sacMap.get(sac) || {
      sacCode: sac,
      description: SAC_DESCRIPTIONS[sac] || "Hospitality Supply Add-on",
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
    };

    existing.taxableAmount += Number(t.taxableAmount);
    existing.cgstAmount += Number(t.cgstAmount);
    existing.sgstAmount += Number(t.sgstAmount);
    existing.igstAmount += Number(t.igstAmount);
    existing.totalTax += Number(t.totalTax);
    sacMap.set(sac, existing);
  }

  // Ensure default room SAC is shown even if empty
  if (sacMap.size === 0) {
    sacMap.set("996311", {
      sacCode: "996311",
      description: SAC_DESCRIPTIONS["996311"]!,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
    });
  }

  const rows = Array.from(sacMap.values());
  let totalTaxable = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalTax = 0;

  for (const r of rows) {
    r.taxableAmount = roundCurrency(r.taxableAmount);
    r.cgstAmount = roundCurrency(r.cgstAmount);
    r.sgstAmount = roundCurrency(r.sgstAmount);
    r.igstAmount = roundCurrency(r.igstAmount);
    r.totalTax = roundCurrency(r.totalTax);

    totalTaxable += r.taxableAmount;
    totalCGST += r.cgstAmount;
    totalSGST += r.sgstAmount;
    totalIGST += r.igstAmount;
    totalTax += r.totalTax;
  }

  const columns: ReportColumn[] = [
    { key: "sacCode", label: "SAC Code", format: "text", align: "left" },
    { key: "description", label: "Description", format: "text", align: "left" },
    { key: "taxableAmount", label: "Taxable Value (₹)", format: "currency", align: "right" },
    { key: "cgstAmount", label: "CGST (₹)", format: "currency", align: "right" },
    { key: "sgstAmount", label: "SGST (₹)", format: "currency", align: "right" },
    { key: "igstAmount", label: "IGST (₹)", format: "currency", align: "right" },
    { key: "totalTax", label: "Total Tax (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Taxable Turnover", value: formatINR(totalTaxable), format: "text" },
    { label: "CGST Amount", value: formatINR(totalCGST), format: "text" },
    { label: "SGST Amount", value: formatINR(totalSGST), format: "text" },
    { label: "IGST Amount", value: formatINR(totalIGST), format: "text" },
    { label: "Total GST Tax", value: formatINR(totalTax), format: "text" },
  ];

  return {
    reportType: "gst",
    title: "Statutory Indian GST & SAC Summary Report",
    description: "Ministry of Finance compliant tax breakdown grouped by SAC code with CGST, SGST, and IGST components.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      sacCode: "TOTAL",
      description: "All SAC Headings",
      taxableAmount: roundCurrency(totalTaxable),
      cgstAmount: roundCurrency(totalCGST),
      sgstAmount: roundCurrency(totalSGST),
      igstAmount: roundCurrency(totalIGST),
      totalTax: roundCurrency(totalTax),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 6. PAYMENT COLLECTION REPORT
// ---------------------------------------------------------------------------
async function getPaymentCollectionReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const payments = await prisma.payment.findMany({
    where: {
      folio: { hotelId },
      receivedAt: { gte: startDateTime, lte: endDateTime },
    },
    include: {
      guest: { select: { fullName: true, mobile: true } },
      folio: { select: { folioNumber: true } },
    },
    orderBy: { receivedAt: "desc" },
  });

  let totalCollected = 0;
  let cashTotal = 0;
  let upiTotal = 0;
  let cardTotal = 0;
  let razorpayTotal = 0;

  const rows = payments.map((p) => {
    const amt = Number(p.amount);
    if (p.status === "Captured") {
      totalCollected += amt;
      if (p.method === "Cash") cashTotal += amt;
      else if (p.method === "UPI") upiTotal += amt;
      else if (p.method === "Card") cardTotal += amt;
      else if (p.method === "Razorpay") razorpayTotal += amt;
    }

    return {
      paymentNumber: p.paymentNumber,
      receivedAt: p.receivedAt.toISOString().replace("T", " ").slice(0, 16),
      guestName: p.guest?.fullName || "Walk-in Guest",
      mobile: p.guest?.mobile || "-",
      folioNumber: p.folio?.folioNumber || "-",
      method: p.method,
      amount: roundCurrency(amt),
      status: p.status,
      transactionRef: p.transactionRef || p.razorpayPaymentId || "-",
      panNumber: p.panNumber || "-",
    };
  });

  const columns: ReportColumn[] = [
    { key: "paymentNumber", label: "Receipt #", format: "text", align: "left" },
    { key: "receivedAt", label: "Date & Time", format: "text", align: "left" },
    { key: "guestName", label: "Guest Name", format: "text", align: "left" },
    { key: "folioNumber", label: "Folio #", format: "text", align: "left" },
    { key: "method", label: "Method", format: "badge", align: "center" },
    { key: "status", label: "Status", format: "badge", align: "center" },
    { key: "amount", label: "Amount (₹)", format: "currency", align: "right" },
    { key: "transactionRef", label: "Ref / Txn ID", format: "text", align: "left" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Captured Receipts", value: formatINR(totalCollected), format: "text" },
    { label: "UPI Payments", value: formatINR(upiTotal), format: "text" },
    { label: "Card Payments", value: formatINR(cardTotal), format: "text" },
    { label: "Cash Collected", value: formatINR(cashTotal), format: "text" },
    { label: "Razorpay Gateway", value: formatINR(razorpayTotal), format: "text" },
  ];

  return {
    reportType: "payment-collection",
    title: "Payment Collection & Receipts Ledger",
    description: "Chronological log of all transactions received across cash desk, POS cards, UPI, and Razorpay.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      paymentNumber: "TOTAL",
      receivedAt: `${rows.length} receipts`,
      guestName: "",
      folioNumber: "",
      method: "",
      status: "Captured",
      amount: roundCurrency(totalCollected),
      transactionRef: "",
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 7. OUTSTANDING FOLIO REPORT
// ---------------------------------------------------------------------------
async function getOutstandingFolioReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
): Promise<HotelReportResponse> {
  const folios = await prisma.folio.findMany({
    where: {
      hotelId,
      status: { not: "Settled" },
      balanceDue: { gt: 0.01 },
    },
    include: {
      guest: { select: { fullName: true, mobile: true } },
      booking: {
        include: { room: { select: { roomNumber: true } } },
      },
    },
    orderBy: { balanceDue: "desc" },
  });

  let sumDebit = 0;
  let sumCredit = 0;
  let sumBalance = 0;

  const rows = folios.map((f) => {
    const debit = Number(f.totalDebit);
    const credit = Number(f.totalCredit);
    const balance = Number(f.balanceDue);

    sumDebit += debit;
    sumCredit += credit;
    sumBalance += balance;

    return {
      folioNumber: f.folioNumber,
      guestName: f.guest?.fullName || "Guest",
      mobile: f.guest?.mobile || "-",
      roomNumber: f.booking?.room?.roomNumber || "Unassigned",
      totalDebit: roundCurrency(debit),
      totalCredit: roundCurrency(credit),
      balanceDue: roundCurrency(balance),
      status: f.status,
      openedAt: f.createdAt.toISOString().slice(0, 10),
    };
  });

  const columns: ReportColumn[] = [
    { key: "folioNumber", label: "Folio #", format: "text", align: "left" },
    { key: "guestName", label: "Guest Name", format: "text", align: "left" },
    { key: "mobile", label: "Mobile", format: "text", align: "left" },
    { key: "roomNumber", label: "Room", format: "badge", align: "center" },
    { key: "status", label: "Status", format: "badge", align: "center" },
    { key: "totalDebit", label: "Total Debit (₹)", format: "currency", align: "right" },
    { key: "totalCredit", label: "Total Credit (₹)", format: "currency", align: "right" },
    { key: "balanceDue", label: "Balance Due (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Unsettled Dues", value: formatINR(sumBalance), format: "text" },
    { label: "Unsettled Accounts Count", value: rows.length, format: "number" },
    { label: "Cumulative Charges (Debits)", value: formatINR(sumDebit), format: "text" },
    { label: "Cumulative Credits Collected", value: formatINR(sumCredit), format: "text" },
  ];

  return {
    reportType: "outstanding-folio",
    title: "Outstanding Guest Folios Report",
    description: "Active guest accounts with uncollected balances requiring checkout settlement or corporate billing recovery.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      folioNumber: "TOTAL",
      guestName: `${rows.length} folios`,
      mobile: "",
      roomNumber: "",
      status: "Unsettled",
      totalDebit: roundCurrency(sumDebit),
      totalCredit: roundCurrency(sumCredit),
      balanceDue: roundCurrency(sumBalance),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 8. CHECK-IN REPORT
// ---------------------------------------------------------------------------
async function getCheckInReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      status: { in: ["CheckedIn", "CheckedOut"] },
      OR: [
        { actualCheckIn: { gte: startDateTime, lte: endDateTime } },
        { actualCheckIn: null, checkInDate: { gte: startDateTime, lte: endDateTime } },
      ],
    },
    include: {
      primaryGuest: { select: { fullName: true, mobile: true } },
      room: { select: { roomNumber: true } },
      roomType: { select: { name: true } },
    },
    orderBy: { actualCheckIn: "desc" },
  });

  let totalAdvance = 0;
  let totalGuests = 0;

  const rows = bookings.map((b) => {
    const advance = Number(b.paidAmount);
    totalAdvance += advance;
    totalGuests += b.adults + b.children;

    return {
      bookingNumber: b.bookingNumber,
      guestName: b.primaryGuest.fullName,
      mobile: b.primaryGuest.mobile,
      roomNumber: b.room?.roomNumber || "Unassigned",
      roomType: b.roomType.name,
      checkInTime: b.actualCheckIn
        ? b.actualCheckIn.toISOString().replace("T", " ").slice(0, 16)
        : b.checkInDate.toISOString().slice(0, 10),
      pax: `${b.adults}A + ${b.children}C`,
      source: b.bookingSource,
      paidAdvance: roundCurrency(advance),
      status: b.status,
    };
  });

  const columns: ReportColumn[] = [
    { key: "bookingNumber", label: "Booking #", format: "text", align: "left" },
    { key: "checkInTime", label: "Check-in Time", format: "text", align: "left" },
    { key: "guestName", label: "Guest Name", format: "text", align: "left" },
    { key: "roomNumber", label: "Room", format: "badge", align: "center" },
    { key: "roomType", label: "Room Type", format: "text", align: "left" },
    { key: "pax", label: "Guests", format: "text", align: "center" },
    { key: "source", label: "Source", format: "text", align: "left" },
    { key: "paidAdvance", label: "Advance Paid (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Check-ins Completed", value: rows.length, format: "number" },
    { label: "Total Guest Headcount", value: totalGuests, format: "number" },
    { label: "Advance Deposits Held", value: formatINR(totalAdvance), format: "text" },
  ];

  return {
    reportType: "check-in",
    title: "Guest Check-in Operational Report",
    description: "Audit trail of guest registrations, room assignments, and identity checks completed at the front desk.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      bookingNumber: "TOTAL",
      checkInTime: `${rows.length} arrivals`,
      guestName: "",
      roomNumber: "",
      roomType: "",
      pax: `${totalGuests} guests`,
      source: "",
      paidAdvance: roundCurrency(totalAdvance),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 9. CHECK-OUT REPORT
// ---------------------------------------------------------------------------
async function getCheckOutReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      status: "CheckedOut",
      OR: [
        { actualCheckOut: { gte: startDateTime, lte: endDateTime } },
        { actualCheckOut: null, checkOutDate: { gte: startDateTime, lte: endDateTime } },
      ],
    },
    include: {
      primaryGuest: { select: { fullName: true, mobile: true } },
      room: { select: { roomNumber: true } },
      folio: { select: { totalDebit: true, totalCredit: true, balanceDue: true } },
    },
    orderBy: { actualCheckOut: "desc" },
  });

  let sumGrand = 0;
  let sumSettled = 0;
  let sumDue = 0;

  const rows = bookings.map((b) => {
    const totalBilled = b.folio ? Number(b.folio.totalDebit) : Number(b.grandTotal);
    const settled = b.folio ? Number(b.folio.totalCredit) : Number(b.paidAmount);
    const balance = b.folio ? Number(b.folio.balanceDue) : Number(b.balanceAmount);

    sumGrand += totalBilled;
    sumSettled += settled;
    sumDue += balance;

    return {
      bookingNumber: b.bookingNumber,
      guestName: b.primaryGuest.fullName,
      roomNumber: b.room?.roomNumber || "Checked Out",
      checkOutTime: b.actualCheckOut
        ? b.actualCheckOut.toISOString().replace("T", " ").slice(0, 16)
        : b.checkOutDate.toISOString().slice(0, 10),
      totalBilled: roundCurrency(totalBilled),
      settledAmount: roundCurrency(settled),
      balanceDue: roundCurrency(balance),
    };
  });

  const columns: ReportColumn[] = [
    { key: "bookingNumber", label: "Booking #", format: "text", align: "left" },
    { key: "checkOutTime", label: "Check-out Date & Time", format: "text", align: "left" },
    { key: "guestName", label: "Guest Name", format: "text", align: "left" },
    { key: "roomNumber", label: "Room", format: "badge", align: "center" },
    { key: "totalBilled", label: "Final Folio (₹)", format: "currency", align: "right" },
    { key: "settledAmount", label: "Settled / Paid (₹)", format: "currency", align: "right" },
    { key: "balanceDue", label: "Balance (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Departures Processed", value: rows.length, format: "number" },
    { label: "Total Billed on Departure", value: formatINR(sumGrand), format: "text" },
    { label: "Total Payments Settled", value: formatINR(sumSettled), format: "text" },
    { label: "Remaining Pending Balances", value: formatINR(sumDue), format: "text" },
  ];

  return {
    reportType: "check-out",
    title: "Guest Departure & Check-out Report",
    description: "Summary of departure settlements, room turnovers, and final folio billing clearances.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      bookingNumber: "TOTAL",
      checkOutTime: `${rows.length} departures`,
      guestName: "",
      roomNumber: "",
      totalBilled: roundCurrency(sumGrand),
      settledAmount: roundCurrency(sumSettled),
      balanceDue: roundCurrency(sumDue),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 10. CANCELLATION REPORT
// ---------------------------------------------------------------------------
async function getCancellationReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const cancellations = await prisma.booking.findMany({
    where: {
      hotelId,
      status: "Cancelled",
      updatedAt: { gte: startDateTime, lte: endDateTime },
    },
    include: {
      primaryGuest: { select: { fullName: true, mobile: true } },
      roomType: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  let sumLostRev = 0;

  const rows = cancellations.map((b) => {
    const val = Number(b.grandTotal);
    sumLostRev += val;

    return {
      bookingNumber: b.bookingNumber,
      guestName: b.primaryGuest.fullName,
      mobile: b.primaryGuest.mobile,
      roomType: b.roomType.name,
      stayDates: `${b.checkInDate.toISOString().slice(0, 10)} to ${b.checkOutDate.toISOString().slice(0, 10)}`,
      cancelledAt: b.updatedAt.toISOString().replace("T", " ").slice(0, 16),
      source: b.bookingSource,
      lostRevenue: roundCurrency(val),
      specialRequests: b.specialRequests || "Customer Request",
    };
  });

  const columns: ReportColumn[] = [
    { key: "bookingNumber", label: "Booking #", format: "text", align: "left" },
    { key: "cancelledAt", label: "Cancelled On", format: "text", align: "left" },
    { key: "guestName", label: "Guest Name", format: "text", align: "left" },
    { key: "roomType", label: "Room Type", format: "text", align: "left" },
    { key: "stayDates", label: "Scheduled Dates", format: "text", align: "left" },
    { key: "source", label: "Channel", format: "text", align: "center" },
    { key: "lostRevenue", label: "Cancelled Value (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Cancellations Logged", value: rows.length, format: "number" },
    { label: "Unrealized Booking Value", value: formatINR(sumLostRev), format: "text" },
  ];

  return {
    reportType: "cancellation",
    title: "Reservation Cancellation Report",
    description: "Detailed record of voided bookings, cancelled booking dates, and release of room allocations.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      bookingNumber: "TOTAL",
      cancelledAt: `${rows.length} cancellations`,
      guestName: "",
      roomType: "",
      stayDates: "",
      source: "",
      lostRevenue: roundCurrency(sumLostRev),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 11. NO-SHOW REPORT
// ---------------------------------------------------------------------------
async function getNoShowReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const noShows = await prisma.booking.findMany({
    where: {
      hotelId,
      status: "NoShow",
      checkInDate: { gte: startDateTime, lte: endDateTime },
    },
    include: {
      primaryGuest: { select: { fullName: true, mobile: true } },
      roomType: { select: { name: true } },
    },
    orderBy: { checkInDate: "desc" },
  });

  let sumGrand = 0;
  let sumPaid = 0;

  const rows = noShows.map((b) => {
    const total = Number(b.grandTotal);
    const paid = Number(b.paidAmount);
    sumGrand += total;
    sumPaid += paid;

    return {
      bookingNumber: b.bookingNumber,
      guestName: b.primaryGuest.fullName,
      mobile: b.primaryGuest.mobile,
      roomType: b.roomType.name,
      scheduledArrival: b.checkInDate.toISOString().slice(0, 10),
      totalNights: b.totalNights,
      grandTotal: roundCurrency(total),
      retentionRetained: roundCurrency(paid),
    };
  });

  const columns: ReportColumn[] = [
    { key: "bookingNumber", label: "Booking #", format: "text", align: "left" },
    { key: "scheduledArrival", label: "Scheduled Arrival", format: "text", align: "left" },
    { key: "guestName", label: "Guest Name", format: "text", align: "left" },
    { key: "roomType", label: "Room Type", format: "text", align: "left" },
    { key: "totalNights", label: "Nights", format: "number", align: "center" },
    { key: "grandTotal", label: "Booking Total (₹)", format: "currency", align: "right" },
    { key: "retentionRetained", label: "Retention Kept (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total No-Show Incidents", value: rows.length, format: "number" },
    { label: "Lost Booking Revenue", value: formatINR(sumGrand), format: "text" },
    { label: "Retention / Deposit Kept", value: formatINR(sumPaid), format: "text" },
  ];

  return {
    reportType: "no-show",
    title: "Guest No-Show Report",
    description: "Unclaimed confirmed reservations where guests failed to arrive on the scheduled business date.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      bookingNumber: "TOTAL",
      scheduledArrival: `${rows.length} no-shows`,
      guestName: "",
      roomType: "",
      totalNights: "",
      grandTotal: roundCurrency(sumGrand),
      retentionRetained: roundCurrency(sumPaid),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 12. ROOM STATUS REPORT
// ---------------------------------------------------------------------------
async function getRoomStatusReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
): Promise<HotelReportResponse> {
  const rooms = await prisma.room.findMany({
    where: { hotelId },
    include: {
      roomType: { select: { name: true, basePrice: true } },
      floor: { select: { floorNumber: true } },
    },
    orderBy: [{ floor: { floorNumber: "asc" } }, { roomNumber: "asc" }],
  });

  let clean = 0;
  let dirty = 0;
  let occupied = 0;
  let maintenance = 0;
  let blocked = 0;
  let available = 0;

  const rows = rooms.map((r) => {
    if (r.status === "Clean") clean++;
    else if (r.status === "Dirty") dirty++;
    else if (r.status === "Occupied") occupied++;
    else if (r.status === "Maintenance") maintenance++;
    else if (r.status === "Blocked") blocked++;
    else if (r.status === "Available") available++;

    const baseRate = r.baseRate ? Number(r.baseRate) : Number(r.roomType.basePrice);

    return {
      roomNumber: r.roomNumber,
      roomType: r.roomType.name,
      floor: `Floor ${r.floor.floorNumber}`,
      status: r.status,
      baseRate: roundCurrency(baseRate),
      active: r.isActive ? "Active" : "Inactive",
    };
  });

  const columns: ReportColumn[] = [
    { key: "roomNumber", label: "Room #", format: "text", align: "left" },
    { key: "roomType", label: "Room Type", format: "text", align: "left" },
    { key: "floor", label: "Floor", format: "text", align: "center" },
    { key: "status", label: "Housekeeping Status", format: "badge", align: "center" },
    { key: "baseRate", label: "Standard Rate (₹)", format: "currency", align: "right" },
    { key: "active", label: "Operational State", format: "badge", align: "center" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Rooms", value: rooms.length, format: "number" },
    { label: "Available / Clean", value: available + clean, format: "number" },
    { label: "Occupied Rooms", value: occupied, format: "number" },
    { label: "Dirty (Pending Cleaning)", value: dirty, format: "number" },
    { label: "Maintenance / Blocked", value: maintenance + blocked, format: "number" },
  ];

  return {
    reportType: "room-status",
    title: "Room Physical & Housekeeping Status Report",
    description: "Current physical and cleanliness condition of each room inventory unit across all property floors.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      roomNumber: "TOTAL",
      roomType: `${rooms.length} rooms`,
      floor: "",
      status: `${available + clean} ready`,
      baseRate: "",
      active: "",
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 13. SERVICE REVENUE REPORT
// ---------------------------------------------------------------------------
async function getServiceRevenueReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<HotelReportResponse> {
  const items = await prisma.folioItem.findMany({
    where: {
      folio: { hotelId },
      itemType: { not: "Room" },
      isVoided: false,
      postedAt: { gte: startDateTime, lte: endDateTime },
    },
    select: {
      itemType: true,
      description: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      gstAmount: true,
      sacCode: true,
    },
  });

  const categoryMap = new Map<string, {
    category: string;
    description: string;
    sacCode: string;
    unitsSold: number;
    taxableAmount: number;
    gstAmount: number;
    grossTotal: number;
  }>();

  for (const item of items) {
    const key = `${item.itemType}:${item.description}`;
    const existing = categoryMap.get(key) || {
      category: item.itemType,
      description: item.description,
      sacCode: item.sacCode,
      unitsSold: 0,
      taxableAmount: 0,
      gstAmount: 0,
      grossTotal: 0,
    };

    const price = Number(item.totalPrice);
    const tax = Number(item.gstAmount);

    existing.unitsSold += item.quantity;
    existing.taxableAmount += price;
    existing.gstAmount += tax;
    existing.grossTotal += price + tax;

    categoryMap.set(key, existing);
  }

  const rows = Array.from(categoryMap.values()).sort((a, b) => b.grossTotal - a.grossTotal);

  let totalTaxable = 0;
  let totalGST = 0;
  let totalGross = 0;
  let totalUnits = 0;

  for (const r of rows) {
    r.taxableAmount = roundCurrency(r.taxableAmount);
    r.gstAmount = roundCurrency(r.gstAmount);
    r.grossTotal = roundCurrency(r.grossTotal);

    totalTaxable += r.taxableAmount;
    totalGST += r.gstAmount;
    totalGross += r.grossTotal;
    totalUnits += r.unitsSold;
  }

  const columns: ReportColumn[] = [
    { key: "category", label: "Service Category", format: "badge", align: "center" },
    { key: "description", label: "Item / Service", format: "text", align: "left" },
    { key: "sacCode", label: "SAC Code", format: "text", align: "left" },
    { key: "unitsSold", label: "Units Sold", format: "number", align: "center" },
    { key: "taxableAmount", label: "Taxable (₹)", format: "currency", align: "right" },
    { key: "gstAmount", label: "GST (₹)", format: "currency", align: "right" },
    { key: "grossTotal", label: "Gross Revenue (₹)", format: "currency", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Service Revenue", value: formatINR(totalGross), format: "text" },
    { label: "Taxable Service Amount", value: formatINR(totalTaxable), format: "text" },
    { label: "GST Collected on Services", value: formatINR(totalGST), format: "text" },
    { label: "Total Service Line Items Sold", value: totalUnits, format: "number" },
  ];

  return {
    reportType: "service-revenue",
    title: "Ancillary & F&B Service Revenue Report",
    description: "Revenue earned from dining, room service, laundry, spa, and banquet event facilities.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      category: "TOTAL",
      description: `${rows.length} service lines`,
      sacCode: "",
      unitsSold: totalUnits,
      taxableAmount: roundCurrency(totalTaxable),
      gstAmount: roundCurrency(totalGST),
      grossTotal: roundCurrency(totalGross),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 14. LOYALTY REPORT
// ---------------------------------------------------------------------------
async function getLoyaltyReport(
  hotelId: string,
  preset: ReportFilterPreset,
  startDate: string,
  endDate: string,
): Promise<HotelReportResponse> {
  const accounts = await prisma.loyaltyAccount.findMany({
    where: { hotelId },
    include: {
      guest: { select: { fullName: true, mobile: true, email: true } },
    },
    orderBy: { lifetimeSpendInr: "desc" },
  });

  let totalMembers = accounts.length;
  let bronzeCount = 0;
  let silverCount = 0;
  let goldCount = 0;
  let sumAvailable = 0;
  let sumRedeemed = 0;
  let sumLifetimeSpend = 0;

  const rows = accounts.map((a) => {
    if (a.tier === "Bronze") bronzeCount++;
    else if (a.tier === "Silver") silverCount++;
    else if (a.tier === "Gold") goldCount++;

    const spend = Number(a.lifetimeSpendInr);
    sumLifetimeSpend += spend;
    sumAvailable += a.availablePoints;
    sumRedeemed += a.redeemedPoints;

    return {
      guestName: a.guest.fullName,
      mobile: a.guest.mobile,
      tier: a.tier,
      lifetimeSpend: roundCurrency(spend),
      availablePoints: a.availablePoints,
      lifetimePoints: a.lifetimePoints,
      redeemedPoints: a.redeemedPoints,
      expiringPoints: a.pointsExpiringQty,
    };
  });

  const columns: ReportColumn[] = [
    { key: "guestName", label: "Guest Name", format: "text", align: "left" },
    { key: "mobile", label: "Mobile", format: "text", align: "left" },
    { key: "tier", label: "Loyalty Tier", format: "badge", align: "center" },
    { key: "lifetimeSpend", label: "Qualifying Spend (₹)", format: "currency", align: "right" },
    { key: "availablePoints", label: "Available Points", format: "number", align: "right" },
    { key: "lifetimePoints", label: "Lifetime Earned", format: "number", align: "right" },
    { key: "redeemedPoints", label: "Redeemed", format: "number", align: "right" },
    { key: "expiringPoints", label: "Expiring Soon", format: "number", align: "right" },
  ];

  const summary: ReportSummaryItem[] = [
    { label: "Total Loyalty Members", value: totalMembers, format: "number" },
    { label: "Tier Distribution", value: `Gold: ${goldCount} | Silver: ${silverCount} | Bronze: ${bronzeCount}`, format: "text" },
    { label: "Total Available Points", value: sumAvailable, format: "number" },
    { label: "Total Points Redeemed", value: sumRedeemed, format: "number" },
    { label: "Cumulative Member Spend", value: formatINR(sumLifetimeSpend), format: "text" },
  ];

  return {
    reportType: "loyalty",
    title: "Loyalty Program & Rewards Performance Report",
    description: "Guest tier standing, points circulation, redemption volume, and cumulative qualifying spend.",
    filter: { preset, startDate, endDate },
    columns,
    summary,
    rows,
    totals: {
      guestName: "TOTAL",
      mobile: `${totalMembers} members`,
      tier: "",
      lifetimeSpend: roundCurrency(sumLifetimeSpend),
      availablePoints: sumAvailable,
      lifetimePoints: sumAvailable + sumRedeemed,
      redeemedPoints: sumRedeemed,
      expiringPoints: "",
    },
    generatedAt: new Date().toISOString(),
  };
}
