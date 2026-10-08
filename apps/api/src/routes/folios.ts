import { Router } from "express";
import {
  getFolioById,
  listFolios,
  addFolioItem,
  editFolioItem,
  voidFolioItem,
  removeFolioItem,
  applyFolioDiscount,
  recordFolioPayment,
  refundFolioPayment,
  generateInvoiceData,
} from "../services/folioService";
import { actorId, requirePermission } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  discountSchema,
  folioItemEditSchema,
  folioItemSchema,
  invoiceQuerySchema,
  paymentSchema,
  refundSchema,
  voidReasonSchema,
} from "../validation/schemas";

export const foliosRouter = Router();

// GET /api/folios (List folios)
foliosRouter.get("/", requirePermission("folio:read"), async (req, res, next) => {
  try {
    const folios = await listFolios({
      hotelId: req.query.hotelId as string,
      status: req.query.status as string,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json({ success: true, data: folios, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/folios/:id
foliosRouter.get("/:id", requirePermission("folio:read"), async (req, res, next) => {
  try {
    const folio = await getFolioById(req.params.id);
    if (!folio) {
      res.status(404).json({ success: false, message: "Folio not found", timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: folio, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/folios/:id/items (Add Item)
foliosRouter.post("/:id/items", requirePermission("folio:write"), validateBody(folioItemSchema), async (req, res, next) => {
  try {
    const result = await addFolioItem({
      folioId: req.params.id,
      ...req.body,
    } as unknown as Parameters<typeof addFolioItem>[0]);
    res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/folios/items/:itemId (Edit Item)
foliosRouter.put("/items/:itemId", requirePermission("folio:write"), validateBody(folioItemEditSchema), async (req, res, next) => {
  try {
    const result = await editFolioItem({
      folioItemId: req.params.itemId,
      ...req.body,
    } as unknown as Parameters<typeof editFolioItem>[0]);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/folios/items/:itemId/void (Void/Remove Item)
foliosRouter.post("/items/:itemId/void", requirePermission("folio:write"), validateBody(voidReasonSchema), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await voidFolioItem({
      folioItemId: req.params.itemId,
      reason,
      userId: actorId(req),
    });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/folios/items/:itemId (Delete/Remove item alias)
foliosRouter.delete("/items/:itemId", requirePermission("folio:write"), async (req, res, next) => {
  try {
    const reason = (req.body?.reason || req.query?.reason || "Removed by staff") as string;
    const result = await removeFolioItem({
      folioItemId: req.params.itemId,
      reason,
      userId: actorId(req),
    });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/folios/:id/discounts (Apply Discount)
foliosRouter.post("/:id/discounts", requirePermission("folio:write"), validateBody(discountSchema), async (req, res, next) => {
  try {
    const { amount, reason, splitTarget } = req.body;
    const result = await applyFolioDiscount({
      folioId: req.params.id,
      amount: parseFloat(amount),
      reason,
      splitTarget,
      userId: actorId(req),
    });
    res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/folios/:id/payments (Record Payment)
foliosRouter.post("/:id/payments", requirePermission("payment:capture"), validateBody(paymentSchema), async (req, res, next) => {
  try {
    const { amount, method, transactionRef, panNumber, notes, isAdvance } = req.body;
    const result = await recordFolioPayment({
      folioId: req.params.id,
      amount,
      method,
      transactionRef,
      panNumber,
      notes,
      isAdvance: Boolean(isAdvance),
      userId: actorId(req),
    });
    res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/folios/payments/:paymentId/refund (Refund Payment)
foliosRouter.post("/payments/:paymentId/refund", requirePermission("payment:refund"), validateBody(refundSchema), async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    const result = await refundFolioPayment({
      paymentId: req.params.paymentId,
      amount: amount !== undefined && amount !== null ? amount : undefined,
      reason,
      userId: actorId(req),
    });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/folios/:id/invoice (Generate GST Tax Invoice)
foliosRouter.get(
  "/:id/invoice",
  requirePermission("invoice:generate"),
  validateQuery(invoiceQuerySchema),
  async (req, res, next) => {
    try {
      const invoiceType = ((req.query.invoiceType as "Consolidated" | "Corporate" | "Personal") || "Consolidated");
      const invoice = await generateInvoiceData(req.params.id, {
        invoiceType,
        userId: actorId(req),
      });
      res.json({ success: true, data: invoice, timestamp: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  },
);