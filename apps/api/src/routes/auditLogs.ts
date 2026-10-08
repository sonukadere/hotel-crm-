import { Router } from "express";
import { prisma } from "../db/prisma";
import { requirePermission } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { auditLogQuerySchema } from "../validation/schemas";

export const auditLogsRouter = Router();

auditLogsRouter.get("/", requirePermission("audit:read"), validateQuery(auditLogQuerySchema), async (req, res, next) => {
  try {
    const { entity, action, limit = 50 } = req.query;
    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Number(limit),
      include: { user: true },
    });

    res.json({ success: true, data: logs, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
