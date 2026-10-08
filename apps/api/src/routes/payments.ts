import { Router } from "express";
import {
  createRazorpayOrder,
  verifyAndRecordRazorpayPayment,
  handleRazorpayWebhookEvent,
  recordCashPayment,
  recordGenericPayment,
  processPaymentRefund,
} from "../services/paymentService";
import { actorId, requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { paymentSchema, razorpayOrderSchema, razorpayVerifySchema, refundSchema } from "../validation/schemas";

export const paymentsRouter = Router();

/**
 * POST /payments/webhook
 * PUBLIC (mounted before the auth gate): Razorpay calls this directly.
 * Authenticated by the X-Razorpay-Signature header + HMAC using the
 * configured webhook secret, never by a bearer token.
 */
export const paymentsWebhookRouter = Router();
paymentsWebhookRouter.post("/", async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const result = await handleRazorpayWebhookEvent({
      rawBody,
      signatureHeader: signature,
      eventPayload: req.body,
    });

    res.status(200).json(result);
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /payments/create-order
 * Creates Razorpay order after backend validates payable amount against folio balance
 */
paymentsRouter.post("/create-order", requirePermission("folio:read"), validateBody(razorpayOrderSchema), async (req, res, next) => {
  try {
    const { folioId, amount } = req.body;
    const order = await createRazorpayOrder({ folioId, amount: amount ? Number(amount) : undefined });
    res.json({ success: true, data: order, timestamp: new Date().toISOString() });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /payments/verify
 * Verifies Razorpay payment signature, captures payment, recalculates folio credit
 */
paymentsRouter.post("/verify", requirePermission("payment:capture"), validateBody(razorpayVerifySchema), async (req, res, next) => {
  try {
    const {
      folioId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount,
      notes,
    } = req.body;

    const result = await verifyAndRecordRazorpayPayment({
      folioId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amount: amount ? Number(amount) : undefined,
      userId: actorId(req),
      notes,
    });

    res.json({
      success: true,
      data: result,
      message: result.duplicate
        ? "Payment was already recorded"
        : "Razorpay payment successfully verified, captured, and credited to folio",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /payments/cash
 * Enforces Section 269ST & Rule 114B PAN checks before accepting front desk cash
 */
paymentsRouter.post("/cash", requirePermission("payment:capture"), validateBody(paymentSchema), async (req, res, next) => {
  try {
    const { amount, panNumber, notes } = req.body;
    const result = await recordCashPayment({
      folioId: req.body.folioId as string,
      amount,
      panNumber,
      notes,
      userId: actorId(req),
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Cash payment of ${amount.toLocaleString("en-IN")} recorded under Section 269ST compliance`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /payments/refund
 * Processes payment refund and recomputes folio credit
 */
paymentsRouter.post("/refund", requirePermission("payment:refund"), validateBody(refundSchema), async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    const paymentId = req.body.paymentId as string;

    const result = await processPaymentRefund({
      paymentId,
      refundAmount: Number(amount),
      reason,
      userId: actorId(req),
    });

    res.json({
      success: true,
      data: result,
      message: `Payment refund of ${Number(amount).toLocaleString("en-IN")} processed`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /payments/record
 * Generic payment recording (UPI, Card, Bank Transfer)
 */
paymentsRouter.post("/record", requirePermission("payment:capture"), validateBody(paymentSchema), async (req, res, next) => {
  try {
    const { amount, method, transactionRef, panNumber, notes } = req.body;
    const result = await recordGenericPayment({
      folioId: req.body.folioId as string,
      amount,
      method,
      transactionRef,
      panNumber,
      notes,
      userId: actorId(req),
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Payment of ${amount.toLocaleString("en-IN")} recorded via ${method}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    next(err);
  }
});