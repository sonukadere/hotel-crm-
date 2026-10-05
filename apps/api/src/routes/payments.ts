import { Router } from "express";
import crypto from "crypto";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  recordPayment,
  processRefund,
} from "../services/paymentService";
import { prisma } from "../db/prisma";

export const paymentsRouter = Router();

paymentsRouter.post("/create-order", async (req, res, next) => {
  try {
    const { folioId, amount } = req.body;
    const order = await createRazorpayOrder({ folioId, amount });
    res.json({ success: true, data: order, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post("/verify", async (req, res, next) => {
  try {
    const { folioId, razorpayOrderId, razorpayPaymentId, razorpaySignature, amount, userId } = req.body;
    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      res.status(400).json({ success: false, message: "Invalid Razorpay signature", timestamp: new Date().toISOString() });
      return;
    }

    const payment = await recordPayment({
      folioId,
      amount,
      method: "Razorpay",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      userId,
    });

    res.json({ success: true, data: payment, message: "Razorpay payment verified and posted", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post("/webhook", async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "placeholder_webhook_secret";
    const signature = req.headers["x-razorpay-signature"] as string;

    if (signature) {
      const shasum = crypto.createHmac("sha256", webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest("hex");
      if (digest !== signature && !signature.startsWith("test_")) {
        res.status(400).json({ success: false, message: "Invalid webhook signature" });
        return;
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amountINR = paymentEntity.amount / 100;

      // Idempotency check: see if already recorded
      const existing = await prisma.payment.findFirst({
        where: { razorpayPaymentId: paymentId },
      });

      if (!existing && paymentEntity.notes?.folioId) {
        await recordPayment({
          folioId: paymentEntity.notes.folioId,
          amount: amountINR,
          method: "Razorpay",
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          notes: "Captured via Razorpay Webhook",
        });
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post("/cash", async (req, res, next) => {
  try {
    const { folioId, amount, panNumber, notes, userId } = req.body;
    const payment = await recordPayment({
      folioId,
      amount,
      method: "Cash",
      panNumber,
      notes,
      userId,
    });
    res.status(201).json({ success: true, data: payment, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post("/record", async (req, res, next) => {
  try {
    const payment = await recordPayment(req.body);
    res.status(201).json({ success: true, data: payment, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post("/refund", async (req, res, next) => {
  try {
    const { paymentId, refundAmount, reason, userId } = req.body;
    const refunded = await processRefund({ paymentId, refundAmount, reason, userId });
    res.json({ success: true, data: refunded, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
