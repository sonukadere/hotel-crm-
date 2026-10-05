import { Router } from "express";
import { prisma } from "../db/prisma";

export const auditLogsRouter = Router();

auditLogsRouter.get("/", async (req, res, next) => {
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
