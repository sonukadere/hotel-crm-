import { Router } from "express";
import {
  getRevenueReport,
  getGSTReport,
  getOutstandingFolios,
} from "../services/reportService";
import { generateHotelReport } from "../services/hotelReportsService";
import { requirePermission } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { reportQuerySchema } from "../validation/schemas";
import type { HotelReportType, ReportFilterPreset } from "@hotel/types";
import { generateReportCSV, generateReportExcelXML } from "@hotel/utils";

export const reportsRouter = Router();

const VALID_REPORT_TYPES: HotelReportType[] = [
  "daily-revenue",
  "occupancy",
  "adr",
  "revpar",
  "gst",
  "payment-collection",
  "outstanding-folio",
  "check-in",
  "check-out",
  "cancellation",
  "no-show",
  "room-status",
  "service-revenue",
  "loyalty",
];

// GET /api/reports/:reportType (Comprehensive reporting endpoint)
reportsRouter.get("/type/:reportType", requirePermission("report:read"), async (req, res, next) => {
  try {
    const rawType = req.params.reportType as HotelReportType;
    if (!VALID_REPORT_TYPES.includes(rawType)) {
      res.status(400).json({
        success: false,
        error: `Invalid report type: ${rawType}. Valid types are: ${VALID_REPORT_TYPES.join(", ")}`,
      });
      return;
    }

    const preset = (req.query.preset as ReportFilterPreset) || "today";
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const hotelId = req.query.hotelId as string | undefined;
    const format = req.query.format as string | undefined;

    const report = await generateHotelReport(rawType, preset, startDate, endDate, hotelId);

    if (format === "csv") {
      const csv = generateReportCSV(report);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${rawType}-${report.filter.startDate}-to-${report.filter.endDate}.csv"`,
      );
      res.send(csv);
      return;
    }

    if (format === "excel") {
      const xml = generateReportExcelXML(report);
      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${rawType}-${report.filter.startDate}-to-${report.filter.endDate}.xls"`,
      );
      res.send(xml);
      return;
    }

    res.json({ success: true, data: report, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// Legacy backward-compatible endpoints
reportsRouter.get("/revenue", requirePermission("report:read"), validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await getRevenueReport(startDate as string, endDate as string);
    res.json({ success: true, data: report, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/gst", requirePermission("report:read"), validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await getGSTReport(startDate as string, endDate as string);
    res.json({ success: true, data: report, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/outstanding-folios", requirePermission("report:read"), async (_req, res, next) => {
  try {
    const folios = await getOutstandingFolios();
    res.json({ success: true, data: folios, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
