import { Router } from "express";
import {
  runNightAudit,
  getHotelPerformance,
  getNightAuditHistory,
  getCurrentBusinessDate,
  validatePreAuditChecklist,
} from "../services/nightAuditService";
import { actorId, requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { nightAuditRunSchema } from "../validation/schemas";

export const nightAuditRouter = Router();

// POST /api/night-audit/run - Execute 11-step Night Audit
nightAuditRouter.post("/run", requirePermission("night-audit:run"), validateBody(nightAuditRunSchema), async (req, res, next) => {
  try {
    const { hotelId, businessDate } = req.body;
    const result = await runNightAudit(hotelId, businessDate, actorId(req));
    res.json({
      success: true,
      data: result,
      message: `Night Audit completed successfully for business date ${result.auditReport.businessDate}. Business date rolled forward to ${result.flashReport.nextBusinessDate}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.message && err.message.includes("already been closed")) {
      res.status(409).json({
        success: false,
        error: err.message,
        code: "AUDIT_ALREADY_COMPLETED",
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
});

// GET /api/night-audit/performance - Hotel Performance Dashboard Metrics (Occupancy %, ADR, RevPAR, etc.)
nightAuditRouter.get("/performance", requirePermission("night-audit:run"), async (req, res, next) => {
  try {
    const hotelId = req.query.hotelId as string;
    const businessDate = req.query.businessDate as string;
    const metrics = await getHotelPerformance(hotelId, businessDate);
    res.json({ success: true, data: metrics, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/night-audit/status - Current Business Date & Operational Readiness
nightAuditRouter.get("/status", requirePermission("night-audit:run"), async (req, res, next) => {
  try {
    const hotelId = req.query.hotelId as string;
    const currentBusinessDate = await getCurrentBusinessDate(hotelId);
    res.json({
      success: true,
      data: {
        hotelId: hotelId || "default",
        currentBusinessDate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/night-audit/pre-check - Pre-Audit Checklist Validation
nightAuditRouter.get("/pre-check", requirePermission("night-audit:run"), async (req, res, next) => {
  try {
    const hotelId = req.query.hotelId as string;
    const businessDate = req.query.businessDate as string;
    const checklist = await validatePreAuditChecklist(hotelId, businessDate);
    res.json({ success: true, data: checklist, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/night-audit/history - List of previous Night Audit executions
nightAuditRouter.get("/history", requirePermission("night-audit:run"), async (req, res, next) => {
  try {
    const hotelId = req.query.hotelId as string;
    const history = await getNightAuditHistory(hotelId);
    res.json({ success: true, data: history, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});