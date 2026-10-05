import crypto from "crypto";
import { prisma } from "../db/prisma";
import { PaymentMethod, PaymentStatus } from "@hotel/types";
import { validateCashCompliance } from "@hotel/utils";
import { recordAuditLog } from "./auditService";

export interface CreateOrderParams {
  folioId: string;
  amount: number;
}

export async function createRazorpayOrder(params: CreateOrderParams) {
  const folio = await prisma.folio.findUniqueOrThrow({
    where: { id: params.folioId },
  });

  // Backend validates amount does not exceed remaining balance
  const balance = Number(folio.balanceDue);
  const payable = Math.min(params.amount, balance > 0 ? balance : params.amount);

  // Simulated Razorpay Order Creation
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder_key";

  return {
    orderId,
    amount: Math.round(payable * 100), // amount in paise
    currency: "INR",
    keyId,
  };
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret?: string,
): boolean {
  const keySecret = secret || process.env.RAZORPAY_KEY_SECRET || "placeholder_secret";
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body.toString())
    .digest("hex");

  // Allow test signature in dev if placeholder
  if (process.env.NODE_ENV !== "production" && signature.startsWith("simulated_")) {
    return true;
  }

  return expectedSignature === signature;
}

export async function recordPayment(params: {
  folioId: string;
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  panNumber?: string;
  notes?: string;
  userId?: string;
}) {
  // If payment method is Cash, enforce legal compliance!
  if (params.method === "Cash") {
    const compliance = validateCashCompliance(params.amount, params.panNumber);
    if (!compliance.isValid) {
      throw new Error(`Cash Compliance Violation: ${compliance.errors.join(", ")}`);
    }
  }

  return await prisma.$transaction(async (tx) => {
    const folio = await tx.folio.findUniqueOrThrow({
      where: { id: params.folioId },
    });

    const paymentNumber = `PAY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        folioId: params.folioId,
        amount: params.amount as any,
        method: params.method as any,
        status: "Captured",
        transactionRef: params.transactionRef,
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpaySignature: params.razorpaySignature,
        panNumber: params.panNumber,
        notes: params.notes,
      },
    });

    // Recalculate Folio credits
    const allCaptured = await tx.payment.findMany({
      where: { folioId: params.folioId, status: "Captured" },
    });
    const totalCredit = allCaptured.reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = Number(folio.totalDebit) - totalCredit;

    await tx.folio.update({
      where: { id: params.folioId },
      data: {
        totalCredit: totalCredit as any,
        balanceDue: balanceDue as any,
        status: balanceDue <= 0.01 ? "Settled" : "Open",
      },
    });

    // Also update booking paid amount
    await tx.booking.update({
      where: { id: folio.bookingId },
      data: {
        paidAmount: totalCredit as any,
        balanceAmount: balanceDue as any,
      },
    });

    await recordAuditLog({
      hotelId: folio.hotelId,
      userId: params.userId,
      action: "PAYMENT_RECORDED",
      entity: "Payment",
      entityId: payment.id,
      newValue: {
        amount: params.amount,
        method: params.method,
        paymentNumber,
      },
    });

    return payment;
  });
}

export async function processRefund(params: {
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

    if (params.refundAmount > Number(payment.amount)) {
      throw new Error("Refund amount cannot exceed original payment amount");
    }

    const isFullRefund = params.refundAmount === Number(payment.amount);
    const newStatus: PaymentStatus = isFullRefund ? "Refunded" : "PartiallyRefunded";

    const updated = await tx.payment.update({
      where: { id: params.paymentId },
      data: {
        status: newStatus as any,
        notes: `${payment.notes || ""} | Refunded ₹${params.refundAmount}: ${params.reason}`,
      },
    });

    // Recompute folio credits
    const allCaptured = await tx.payment.findMany({
      where: { folioId: payment.folioId, status: "Captured" },
    });
    const totalCredit = allCaptured.reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = Number(payment.folio.totalDebit) - totalCredit;

    await tx.folio.update({
      where: { id: payment.folioId },
      data: {
        totalCredit: totalCredit as any,
        balanceDue: balanceDue as any,
        status: "Open",
      },
    });

    await recordAuditLog({
      hotelId: payment.folio.hotelId,
      userId: params.userId,
      action: "PAYMENT_REFUNDED",
      entity: "Payment",
      entityId: params.paymentId,
      newValue: { refundAmount: params.refundAmount, reason: params.reason },
    });

    return updated;
  });
}
