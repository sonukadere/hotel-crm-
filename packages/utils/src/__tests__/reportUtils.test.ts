import { describe, it, expect } from "vitest";
import {
  resolveReportDateRange,
  generateReportCSV,
  generateReportExcelXML,
  formatISODateOnly,
} from "../reports/reportUtils";
import type { HotelReportResponse } from "@hotel/types";

describe("Module 15 — Report Utilities & Exporters", () => {
  const mockNow = new Date("2026-10-15T14:30:00.000Z"); // Thursday Oct 15, 2026

  it("resolves 'today' correctly", () => {
    expect(formatISODateOnly(mockNow)).toBe("2026-10-15");
    const range = resolveReportDateRange("today", undefined, undefined, mockNow);
    expect(range.startDate).toBe("2026-10-15");
    expect(range.endDate).toBe("2026-10-15");
    expect(range.startDateTime.getHours()).toBe(0);
    expect(range.endDateTime.getHours()).toBe(23);
  });

  it("resolves 'yesterday' correctly", () => {
    const range = resolveReportDateRange("yesterday", undefined, undefined, mockNow);
    expect(range.startDate).toBe("2026-10-14");
    expect(range.endDate).toBe("2026-10-14");
  });

  it("resolves 'current-week' starting on Monday", () => {
    const range = resolveReportDateRange("current-week", undefined, undefined, mockNow);
    // Oct 15, 2026 is Thursday -> Monday is Oct 12
    expect(range.startDate).toBe("2026-10-12");
    expect(range.endDate).toBe("2026-10-15");
  });

  it("resolves 'current-month' starting on 1st of month", () => {
    const range = resolveReportDateRange("current-month", undefined, undefined, mockNow);
    expect(range.startDate).toBe("2026-10-01");
    expect(range.endDate).toBe("2026-10-15");
  });

  it("resolves 'custom' date range and swaps if start > end", () => {
    const range1 = resolveReportDateRange("custom", "2026-10-01", "2026-10-10", mockNow);
    expect(range1.startDate).toBe("2026-10-01");
    expect(range1.endDate).toBe("2026-10-10");

    const rangeSwapped = resolveReportDateRange("custom", "2026-10-20", "2026-10-05", mockNow);
    expect(rangeSwapped.startDate).toBe("2026-10-05");
    expect(rangeSwapped.endDate).toBe("2026-10-20");
  });

  const mockReport: HotelReportResponse = {
    reportType: "daily-revenue",
    title: "Daily Revenue & Earnings Report",
    description: "Daily revenue breakdown",
    filter: {
      preset: "today",
      startDate: "2026-10-15",
      endDate: "2026-10-15",
    },
    columns: [
      { key: "date", label: "Date", format: "text", align: "left" },
      { key: "roomRevenue", label: "Room Revenue (₹)", format: "currency", align: "right" },
      { key: "serviceRevenue", label: "Service / F&B (₹)", format: "currency", align: "right" },
      { key: "grossBilled", label: "Gross Billed (₹)", format: "currency", align: "right" },
    ],
    summary: [
      { label: "Total Room Revenue", value: "₹45,000", format: "text" },
      { label: "Total Services & F&B", value: "₹12,500", format: "text" },
    ],
    rows: [
      {
        date: "2026-10-15",
        roomRevenue: 45000,
        serviceRevenue: 12500,
        grossBilled: 57500,
      },
    ],
    totals: {
      date: "TOTAL",
      roomRevenue: 45000,
      serviceRevenue: 12500,
      grossBilled: 57500,
    },
    generatedAt: "2026-10-15T15:00:00.000Z",
  };

  it("generates valid RFC 4180 CSV export", () => {
    const csv = generateReportCSV(mockReport);
    expect(csv).toContain('"Daily Revenue & Earnings Report"');
    expect(csv).toContain('"Date Range: 2026-10-15 to 2026-10-15 (today)"');
    expect(csv).toContain('"Total Room Revenue","₹45,000"');
    expect(csv).toContain('"Date","Room Revenue (₹)","Service / F&B (₹)","Gross Billed (₹)"');
    expect(csv).toContain('"2026-10-15","45000","12500","57500"');
    expect(csv).toContain('"TOTAL","45000","12500","57500"');
  });

  it("generates valid Excel-compatible XML Spreadsheet export", () => {
    const xml = generateReportExcelXML(mockReport);
    expect(xml).toContain('<?xml version="1.0"?>');
    expect(xml).toContain('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
    expect(xml).toContain('<Data ss:Type="String">Daily Revenue &amp; Earnings Report</Data>');
    expect(xml).toContain('<Cell ss:StyleID="Header"><Data ss:Type="String">Room Revenue (₹)</Data></Cell>');
    expect(xml).toContain('<Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">45000</Data></Cell>');
    expect(xml).toContain('<Cell ss:StyleID="Total"><Data ss:Type="String">TOTAL</Data></Cell>');
    expect(xml).toContain('</Workbook>');
  });
});
