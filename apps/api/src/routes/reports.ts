import { Router } from "express";
import {
  getRevenueReport,
  getGSTReport,
  getOutstandingFolios,
} from "../services/reportService";

export const reportsRouter = Router();

reportsRouter.get("/revenue", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await getRevenueReport(startDate as string, endDate as string);
    res.json({ success: true, data: report, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/gst", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await getGSTReport(startDate as string, endDate as string);
    res.json({ success: true, data: report, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/outstanding-folios", async (_req, res, next) => {
  try {
    const folios = await getOutstandingFolios();
    res.json({ success: true, data: folios, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
