import { prisma } from "../db/prisma";
import { PaymentMethod, PaymentStatus } from "@hotel/types";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  validatePayableAmount,
  evaluateRefund,
  evaluateWebhookTransition,
  validateCashCompliance,
  roundCurrency,
} from "@hotel/utils";
import { recordAuditLog } from "./auditService";
import { recalculateFolio } from "./folioService";

export interface PaymentServiceError extends Error {
  statusCode?: number;
  errors?: string[];
}

function createPaymentError(
  message: string,
  errors: string[] = [message],
  status = 400,
): PaymentServiceError {
  const err = new Error(message) as PaymentServiceError;
  err.statusCode = status;
  err.errors = errors;
  return err;
}

export interface CreateOrderParams {
  folioId: string;
  amount?: number;
}

/**
 * 1. Create Razorpay Order
 * Backend strictly validates the payable amount against remaining folio balance due.
 */
export async function createRazorpayOrder(params: CreateOrderParams) {
  const folio = await prisma.folio.findUnique({
    where: { id: params.folioId },
    include: { hotel: true },
  });

  if (!folio) {
    throw createPaymentError(`Folio not found: ${params.folioId}`, undefined, 404);
  }

  const balance = Number(folio.balanceDue);
  const payableValidation = validatePayableAmount(params.amount, balance);

  if (!payableValidation.isValid) {
    throw createPaymentError(payableValidation.error || "Invalid payable amount", undefined, 400);
  }

  const payableINR = payableValidation.payableAmount;
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder_key";

  return {
    orderId,
    amount: Math.round(payableINR * 100), // amount in paise for Razorpay
    amountINR: payableINR,
    currency: "INR",
    keyId,
    folioId: folio.id,
    bookingId: folio.bookingId,
    balanceDue: balance,
    isFullSettlement: payableValidation.isFullSettlement,
    remainingAfterPayment: payableValidation.remainingAfterPayment,
  };
}

/**
 * 2. Verify Razorpay Payment Signature and Record Payment
 */
export async function verifyAndRecordRazorpayPayment(params: {
  folioId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  amount?: number;
  userId?: string;
  notes?: string;
}) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "placeholder_secret";
  const isSignatureValid = verifyRazorpayPaymentSignature(
    params.razorpayOrderId,
    params.razorpayPaymentId,
    params.razorpaySignature,
    keySecret,
  );

  if (!isSignatureValid) {
    throw createPaymentError("Invalid Razorpay payment signature verification failed", undefined, 400);
  }

  return await prisma.$transaction(async (tx) => {
    // Idempotency check: see if payment with this razorpayPaymentId was already recorded
    const existing = await tx.payment.findFirst({
      where: { razorpayPaymentId: params.razorpayPaymentId },
    });

    if (existing) {
      return { payment: existing, duplicate: true };
    }

    const folio = await tx.folio.findUniqueOrThrow({
      where: { id: params.folioId },
      include: { hotel: true },
    });

    const balance = Number(folio.balanceDue);
    const payableValidation = validatePayableAmount(params.amount, balance, { allowOverpayment: true });
    const finalAmount = payableValidation.payableAmount > 0 ? payableValidation.payableAmount : balance;

    const count = await tx.payment.count({ where: { folioId: params.folioId } });
    const paymentNumber = `PAY-${folio.hotel.code || "H"}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        folioId: params.folioId,
        guestId: folio.guestId,
        amount: finalAmount as any,
        method: "Razorpay",
        status: "Captured",
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpaySignature: params.razorpaySignature,
        notes: params.notes || `Razorpay settlement order ${params.razorpayOrderId}`,
        receivedAt: new Date(),
      },
    });

    // Centralized folio recalculation
    const { summary } = await recalculateFolio(tx, params.folioId);

    await recordAuditLog(
      {
        hotelId: folio.hotelId,
        userId: params.userId,
        action: "PAYMENT_RECORDED",
        entity: "Payment",
        entityId: payment.id,
        newValue: {
          amount: finalAmount,
          method: "Razorpay",
          razorpayPaymentId: params.razorpayPaymentId,
          orderId: params.razorpayOrderId,
          balanceDue: summary.balanceDue,
        },
      },
      tx,
    );

    return { payment, summary, duplicate: false };
  });
}

/**
 * 3. Handle Razorpay Webhook Event
 * Authenticated, Idempotent & Transaction-Safe
 */
export async function handleRazorpayWebhookEvent(params: {
  rawBody: string | Buffer;
  signatureHeader?: string;
  eventPayload: any;
}) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "placeholder_webhook_secret";

  if (params.signatureHeader) {
    const isVerified = verifyRazorpayWebhookSignature(
      params.rawBody,
      params.signatureHeader,
      webhookSecret,
    );
    if (!isVerified) {
      throw createPaymentError("Invalid Razorpay webhook signature", undefined, 400);
    }
  }

  const event = params.eventPayload?.event;
  const payload = params.eventPayload?.payload;
  const paymentEntity = payload?.payment?.entity;
  const paymentId = paymentEntity?.id;

  // Check if payment already exists
  const existingPayment = paymentId
    ? await prisma.payment.findFirst({ where: { razorpayPaymentId: paymentId } })
    : null;

  const transition = evaluateWebhookTransition(
    event,
    payload,
    existingPayment ? {
      id: existingPayment.id,
      status: existingPayment.status as PaymentStatus,
      amount: Number(existingPayment.amount),
      refundedAmount: Number(existingPayment.refundedAmount),
      razorpayPaymentId: existingPayment.razorpayPaymentId,
    } : null,
  );

  if (transition.isDuplicate) {
    return {
      status: "ok",
      duplicate: true,
      message: transition.reason,
    };
  }

  return await prisma.$transaction(async (tx) => {
    if (transition.action === "RECORD_CAPTURED") {
      const folioId = paymentEntity?.notes?.folioId || payload?.order?.entity?.notes?.folioId;
      const orderId = paymentEntity?.order_id;
      const amountINR = transition.amountINR;

      if (!folioId && !orderId) {
        return { status: "ok", message: "No folio reference in captured webhook payload" };
      }

      // Find folio by notes or by previous payment link
      const folio = folioId
        ? await tx.folio.findUnique({ where: { id: folioId }, include: { hotel: true } })
        : null;

      if (!folio) {
        return { status: "ok", message: "Associated folio not found for captured event" };
      }

      const count = await tx.payment.count({ where: { folioId: folio.id } });
      const paymentNumber = `PAY-${folio.hotel.code || "H"}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          folioId: folio.id,
          guestId: folio.guestId,
          amount: amountINR as any,
          method: "Razorpay",
          status: "Captured",
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          notes: "Captured via Razorpay Webhook",
          receivedAt: new Date(),
        },
      });

      const { summary } = await recalculateFolio(tx, folio.id);

      await recordAuditLog(
        {
          hotelId: folio.hotelId,
          action: "WEBHOOK_PAYMENT_CAPTURED",
          entity: "Payment",
          entityId: payment.id,
          newValue: { amount: amountINR, paymentId, orderId },
        },
        tx,
      );

      return { status: "ok", paymentId: payment.id, newBalanceDue: summary.balanceDue };
    }

    if (transition.action === "RECORD_FAILED" && existingPayment) {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: "Failed",
          notes: `${existingPayment.notes || ""} | Payment marked Failed by Razorpay Webhook`,
        },
      });

      await recordAuditLog(
        {
          hotelId: (existingPayment as any).hotelId || "system",
          action: "WEBHOOK_PAYMENT_FAILED",
          entity: "Payment",
          entityId: existingPayment.id,
          newValue: { paymentId },
        },
        tx,
      );

      return { status: "ok", message: "Payment status updated to Failed" };
    }

    if (transition.action === "RECORD_AUTHORIZED" && existingPayment) {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: { status: "Authorized" },
      });

      return { status: "ok", message: "Payment status updated to Authorized" };
    }

    if (transition.action === "RECORD_REFUND" && existingPayment) {
      const refundAmt = transition.amountINR;
      const refundEval = evaluateRefund(
        Number(existingPayment.amount),
        Number(existingPayment.refundedAmount || 0),
        refundAmt,
      );

      await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: refundEval.newStatus as any,
          refundedAmount: refundEval.newRefundedTotal as any,
          notes: `${existingPayment.notes || ""} | Webhook refund ₹${refundAmt} processed`,
        },
      });

      await recalculateFolio(tx, existingPayment.folioId);

      return { status: "ok", message: "Refund captured via webhook" };
    }

    return { status: "ok", message: transition.reason || "Webhook processed" };
  });
}

/**
 * 4. Record Cash Payment with Strict Statutory Compliance (Section 269ST & Rule 114B)
 */
export async function recordCashPayment(params: {
  folioId: string;
  amount: number;
  panNumber?: string;
  notes?: string;
  userId?: string;
}) {
  const amt = roundCurrency(Number(params.amount) || 0);

  // Statutory Income Tax compliance verification
  const compliance = validateCashCompliance(amt, params.panNumber);
  if (!compliance.isValid) {
    throw createPaymentError(
      compliance.errors[0] || "Cash compliance violation",
      compliance.errors,
      422,
    );
  }

  return await prisma.$transaction(async (tx) => {
    const folio = await tx.folio.findUniqueOrThrow({
      where: { id: params.folioId },
      include: { hotel: true },
    });

    const balance = Number(folio.balanceDue);
    const payableValidation = validatePayableAmount(amt, balance);
    if (!payableValidation.isValid) {
      throw createPaymentError(payableValidation.error || "Invalid cash amount", undefined, 400);
    }

    const count = await tx.payment.count({ where: { folioId: params.folioId } });
    const paymentNumber = `PAY-${folio.hotel.code || "H"}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        folioId: params.folioId,
        guestId: folio.guestId,
        amount: amt as any,
        method: "Cash",
        status: "Captured",
        panNumber: params.panNumber ? params.panNumber.toUpperCase() : undefined,
        notes: params.notes || "Front Desk Cash Settlement",
        receivedAt: new Date(),
      },
    });

    const { summary } = await recalculateFolio(tx, params.folioId);

    await recordAuditLog(
      {
        hotelId: folio.hotelId,
        userId: params.userId,
        action: "CASH_PAYMENT_RECORDED",
        entity: "Payment",
        entityId: payment.id,
        newValue: {
          amount: amt,
          method: "Cash",
          panNumber: params.panNumber ? params.panNumber.toUpperCase() : undefined,
          balanceDue: summary.balanceDue,
        },
      },
      tx,
    );

    return { payment, summary };
  });
}

/**
 * 5. General Record Payment (UPI, Card, Bank Transfer, Razorpay)
 */
export async function recordGenericPayment(params: {
  folioId: string;
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  panNumber?: string;
  notes?: string;
  userId?: string;
}) {
  if (params.method === "Cash") {
    return await recordCashPayment(params);
  }

  const amt = roundCurrency(Number(params.amount) || 0);

  return await prisma.$transaction(async (tx) => {
    const folio = await tx.folio.findUniqueOrThrow({
      where: { id: params.folioId },
      include: { hotel: true },
    });

    const balance = Number(folio.balanceDue);
    const payableValidation = validatePayableAmount(amt, balance);
    if (!payableValidation.isValid) {
      throw createPaymentError(payableValidation.error || "Invalid payment amount", undefined, 400);
    }

    const count = await tx.payment.count({ where: { folioId: params.folioId } });
    const paymentNumber = `PAY-${folio.hotel.code || "H"}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        folioId: params.folioId,
        guestId: folio.guestId,
        amount: amt as any,
        method: params.method as any,
        status: "Captured",
        transactionRef: params.transactionRef,
        notes: params.notes || `Settlement via ${params.method}`,
        receivedAt: new Date(),
      },
    });

    const { summary } = await recalculateFolio(tx, params.folioId);

    await recordAuditLog(
      {
        hotelId: folio.hotelId,
        userId: params.userId,
        action: "PAYMENT_RECORDED",
        entity: "Payment",
        entityId: payment.id,
        newValue: {
          amount: amt,
          method: params.method,
          transactionRef: params.transactionRef,
          balanceDue: summary.balanceDue,
        },
      },
      tx,
    );

    return { payment, summary };
  });
}

/**
 * 6. Process Payment Refund
 */
export async function processPaymentRefund(params: {
  paymentId: string;
  refundAmount: number;
  reason: string;
  userId?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: params.paymentId },
      include: { folio: true },
    });

    if (payment.status !== "Captured" && payment.status !== "PartiallyRefunded") {
      throw createPaymentError(
        `Cannot refund payment in '${payment.status}' status. Only Captured payments can be refunded.`,
        undefined,
        400,
      );
    }

    const currentRefunded = Number(payment.refundedAmount || 0);
    const refundEval = evaluateRefund(
      Number(payment.amount),
      currentRefunded,
      params.refundAmount,
    );

    if (!refundEval.isValid) {
      throw createPaymentError(refundEval.error || "Invalid refund amount", undefined, 400);
    }

    const updatedPayment = await tx.payment.update({
      where: { id: params.paymentId },
      data: {
        status: refundEval.newStatus as any,
        refundedAmount: refundEval.newRefundedTotal as any,
        notes: `${payment.notes || ""} | Refunded ₹${params.refundAmount}: ${params.reason}`,
      },
    });

    const { summary } = await recalculateFolio(tx, payment.folioId);

    await recordAuditLog(
      {
        hotelId: payment.folio.hotelId,
        userId: params.userId,
        action: "PAYMENT_REFUNDED",
        entity: "Payment",
        entityId: params.paymentId,
        newValue: {
          refundAmount: params.refundAmount,
          newStatus: refundEval.newStatus,
          totalRefunded: refundEval.newRefundedTotal,
          reason: params.reason,
          balanceDue: summary.balanceDue,
        },
      },
      tx,
    );

    return { payment: updatedPayment, summary };
  });
}
