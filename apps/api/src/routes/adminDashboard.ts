import { Router } from "express";
import { getAdminDashboardOverview } from "../services/adminDashboardService";
import { requireActor, requirePermission } from "../middleware/auth";

export const adminDashboardRouter = Router();

/**
 * GET /admin-dashboard/overview
 * Returns live aggregated PMS Admin Dashboard data:
 * - 10 KPI Cards
 * - 8 Operational Sections
 * - Role-Based Permissions (role comes from the authenticated actor, never the client)
 */
adminDashboardRouter.get("/overview", requirePermission("report:read"), async (req, res, next) => {
  try {
    const hotelId = req.query.hotelId as string | undefined;
    const businessDate = req.query.businessDate as string | undefined;
    const actor = requireActor(req);

    const data = await getAdminDashboardOverview(hotelId, businessDate, actor.role);

    res.json({
      success: true,
      data,
      message: "Admin dashboard data fetched successfully from live database",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
