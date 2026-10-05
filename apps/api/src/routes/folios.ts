import { Router } from "express";
import {
  getFolioById,
  addFolioItem,
  voidFolioItem,
  generateInvoiceData,
} from "../services/folioService";

export const foliosRouter = Router();

foliosRouter.get("/:id", async (req, res, next) => {
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

foliosRouter.post("/:id/items", async (req, res, next) => {
  try {
    const item = await addFolioItem({
      folioId: req.params.id,
      ...req.body,
    });
    res.status(201).json({ success: true, data: item, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

foliosRouter.post("/items/:itemId/void", async (req, res, next) => {
  try {
    const { reason, userId } = req.body;
    const voided = await voidFolioItem({
      folioItemId: req.params.itemId,
      reason,
      userId,
    });
    res.json({ success: true, data: voided, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

foliosRouter.get("/:id/invoice", async (req, res, next) => {
  try {
    const invoice = await generateInvoiceData(req.params.id);
    res.json({ success: true, data: invoice, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
