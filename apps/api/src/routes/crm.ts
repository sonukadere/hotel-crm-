import { Router } from "express";
import {
  searchGuests,
  getGuestProfile,
  createCRMLead,
  updateLeadStatus,
  getCRMLeads,
} from "../services/crmService";
import { actorId, requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { leadCreateSchema, leadStatusSchema } from "../validation/schemas";

export const crmRouter = Router();

crmRouter.get("/guests/search", requirePermission("crm:read"), async (req, res, next) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.json({ success: true, data: [], timestamp: new Date().toISOString() });
      return;
    }
    const results = await searchGuests(q);
    res.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

crmRouter.get("/guests/:id", requirePermission("crm:read"), async (req, res, next) => {
  try {
    const guest = await getGuestProfile(req.params.id);
    if (!guest) {
      res.status(404).json({ success: false, message: "Guest profile not found", timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: guest, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

crmRouter.get("/leads", requirePermission("crm:read"), async (req, res, next) => {
  try {
    const leads = await getCRMLeads(req.query.hotelId as string, req.query.status as any);
    res.json({ success: true, data: leads, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

crmRouter.post("/leads", requirePermission("crm:write"), validateBody(leadCreateSchema), async (req, res, next) => {
  try {
    const lead = await createCRMLead(req.body);
    res.status(201).json({ success: true, data: lead, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

crmRouter.patch("/leads/:id/status", requirePermission("crm:write"), validateBody(leadStatusSchema), async (req, res, next) => {
  try {
    const { status } = req.body;
    const updated = await updateLeadStatus(req.params.id, status, actorId(req));
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});