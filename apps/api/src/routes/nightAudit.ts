import { Router } from "express";
import { runNightAudit, getHotelPerformance } from "../services/nightAuditService";

export const nightAuditRouter = Router();

nightAuditRouter.post("/run", async (req, res, next) => {
  try {
    const { hotelId, businessDate, userId } = req.body;
    const date = businessDate || new Date().toISOString().split("T")[0]!;
    const report = await runNightAudit(hotelId, date, userId);
    res.json({ success: true, data: report, message: "Night Audit executed successfully", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

nightAuditRouter.get("/performance", async (req, res, next) => {
  try {
    const metrics = await getHotelPerformance(req.query.hotelId as string);
    res.json({ success: true, data: metrics, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
