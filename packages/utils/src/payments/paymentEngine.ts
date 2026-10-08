import { PaymentStatus } from "@hotel/types";
import { roundCurrency } from "../formatters";

declare const require: any;
declare const process: any;

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function computeHmacSha256(payload: string, secret: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cryptoMod = typeof window === "undefined" ? require("crypto") : null;
    if (cryptoMod?.createHmac) {
      return cryptoMod.createHmac("sha256", secret).update(payload).digest("hex");
    }
  } catch {
    // In environments without node crypto
  }
  return "";
}

function getEnv(): string {
  try {
    return typeof process !== "undefined" ? process.env?.NODE_ENV || "" : "";
  } catch {
    return "";
  }
}

/**
 * Validates Razorpay checkout payment signature
 * HMAC SHA256 of order_id + "|" + payment_id using razorpay_key_secret
 */
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }

  const env = getEnv();
  // Simulated signatures in non-production test environments
  if (
    env !== "production" &&
    (signature.startsWith("simulated_") || signature.startsWith("test_sig_"))
  ) {
    return true;
  }

  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = computeHmacSha256(payload, secret);

  if (!expectedSignature) {
    return false;
  }

  return constantTimeCompare(expectedSignature, signature);
}

/**
 * Validates Razorpay Webhook signature
 * HMAC SHA256 of raw request payload using razorpay_webhook_secret
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string | any,
  signatureHeader: string,
  webhookSecret: string,
): boolean {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return false;
  }

  const env = getEnv();
  // Allow simulated signatures in non-production test environments
  if (
    env !== "production" &&
    (signatureHeader.startsWith("simulated_") || signatureHeader.startsWith("test_webhook_sig_"))
  ) {
    return true;
  }

  const payload = typeof rawBody === "string" ? rawBody : rawBody?.toString?.("utf8") ?? String(rawBody);
  const expectedSignature = computeHmacSha256(payload, webhookSecret);

  if (!expectedSignature) {
    return false;
  }

  return constantTimeCompare(expectedSignature, signatureHeader);
}

export interface PayableValidationResult {
  isValid: boolean;
  payableAmount: number;
  isFullSettlement: boolean;
  remainingAfterPayment: number;
  error?: string;
}

/**
 * Never trust payment amount directly from frontend.
 * Backend strictly validates the payable amount against remaining folio balance.
 */
export function validatePayableAmount(
  requestedAmount: number | undefined | null,
  currentBalanceDue: number,
  options: { allowOverpayment?: boolean } = {},
): PayableValidationResult {
  const balance = roundCurrency(Number(currentBalanceDue) || 0);

  if (balance <= 0) {
    return {
      isValid: false,
      payableAmount: 0,
      isFullSettlement: true,
      remainingAfterPayment: 0,
      error: `Folio is already fully settled with zero balance due (Current Balance: ₹0.00).`,
    };
  }

  // Default to full remaining balance if amount omitted
  if (requestedAmount === undefined || requestedAmount === null) {
    return {
      isValid: true,
      payableAmount: balance,
      isFullSettlement: true,
      remainingAfterPayment: 0,
    };
  }

  const amt = roundCurrency(Number(requestedAmount) || 0);

  if (amt <= 0) {
    return {
      isValid: false,
      payableAmount: 0,
      isFullSettlement: false,
      remainingAfterPayment: balance,
      error: `Payment amount must be greater than zero. Received: ₹${amt}`,
    };
  }

  if (amt > balance && !options.allowOverpayment) {
    return {
      isValid: false,
      payableAmount: balance,
      isFullSettlement: false,
      remainingAfterPayment: balance,
      error: `Requested payment of ₹${amt.toLocaleString("en-IN")} exceeds the remaining balance due of ₹${balance.toLocaleString("en-IN")}.`,
    };
  }

  const remaining = roundCurrency(Math.max(0, balance - amt));
  const isFull = remaining <= 0.01;

  return {
    isValid: true,
    payableAmount: amt,
    isFullSettlement: isFull,
    remainingAfterPayment: remaining,
  };
}

export interface RefundEvaluationResult {
  isValid: boolean;
  newRefundedTotal: number;
  maxRefundable: number;
  newStatus: "Refunded" | "PartiallyRefunded";
  isFullRefund: boolean;
  error?: string;
}

/**
 * Validates and calculates payment refund transition.
 * Ensures requested refund does not exceed net unrefunded principal.
 */
export function evaluateRefund(
  originalPaymentAmount: number,
  alreadyRefundedAmount: number,
  requestedRefundAmount: number,
): RefundEvaluationResult {
  const original = roundCurrency(Number(originalPaymentAmount) || 0);
  const already = roundCurrency(Number(alreadyRefundedAmount) || 0);
  const requested = roundCurrency(Number(requestedRefundAmount) || 0);

  const maxRefundable = roundCurrency(Math.max(0, original - already));

  if (requested <= 0) {
    return {
      isValid: false,
      newRefundedTotal: already,
      maxRefundable,
      newStatus: already >= original - 0.01 ? "Refunded" : "PartiallyRefunded",
      isFullRefund: false,
      error: `Refund amount must be greater than zero. Received: ₹${requested}`,
    };
  }

  if (requested > maxRefundable) {
    return {
      isValid: false,
      newRefundedTotal: already,
      maxRefundable,
      newStatus: "PartiallyRefunded",
      isFullRefund: false,
      error: `Requested refund of ₹${requested.toLocaleString("en-IN")} exceeds maximum refundable balance of ₹${maxRefundable.toLocaleString("en-IN")}.`,
    };
  }

  const newTotal = roundCurrency(already + requested);
  const isFull = newTotal >= original - 0.01;

  return {
    isValid: true,
    newRefundedTotal: newTotal,
    maxRefundable,
    newStatus: isFull ? "Refunded" : "PartiallyRefunded",
    isFullRefund: isFull,
  };
}

export interface WebhookEventTransitionResult {
  isDuplicate: boolean;
  action: "RECORD_CAPTURED" | "RECORD_FAILED" | "RECORD_AUTHORIZED" | "RECORD_REFUND" | "IGNORE";
  targetStatus: PaymentStatus;
  paymentId?: string;
  orderId?: string;
  amountINR: number;
  reason?: string;
}

/**
 * Evaluates a Razorpay webhook event payload for idempotency and state transition.
 */
export function evaluateWebhookTransition(
  event: string,
  payload: any,
  existingPayment?: {
    id: string;
    status: PaymentStatus;
    amount: number;
    refundedAmount?: number;
    razorpayPaymentId?: string | null;
  } | null,
): WebhookEventTransitionResult {
  const paymentEntity = payload?.payment?.entity || payload?.entity || {};
  const paymentId = paymentEntity.id || payload?.id;
  const orderId = paymentEntity.order_id;
  const amountINR = roundCurrency((Number(paymentEntity.amount) || 0) / 100);

  if (event === "payment.captured") {
    // Idempotency check: If already Captured, skip reprocessing
    if (existingPayment && existingPayment.status === "Captured") {
      return {
        isDuplicate: true,
        action: "IGNORE",
        targetStatus: "Captured",
        paymentId,
        orderId,
        amountINR,
        reason: `Payment ${paymentId} is already captured. Duplicate webhook ignored.`,
      };
    }

    return {
      isDuplicate: false,
      action: "RECORD_CAPTURED",
      targetStatus: "Captured",
      paymentId,
      orderId,
      amountINR,
    };
  }

  if (event === "payment.failed") {
    if (existingPayment && existingPayment.status === "Failed") {
      return {
        isDuplicate: true,
        action: "IGNORE",
        targetStatus: "Failed",
        paymentId,
        orderId,
        amountINR,
        reason: `Payment ${paymentId} is already marked Failed. Duplicate webhook ignored.`,
      };
    }

    return {
      isDuplicate: false,
      action: "RECORD_FAILED",
      targetStatus: "Failed",
      paymentId,
      orderId,
      amountINR,
    };
  }

  if (event === "payment.authorized") {
    if (
      existingPayment &&
      (existingPayment.status === "Authorized" || existingPayment.status === "Captured")
    ) {
      return {
        isDuplicate: true,
        action: "IGNORE",
        targetStatus: existingPayment.status,
        paymentId,
        orderId,
        amountINR,
        reason: `Payment ${paymentId} already authorized or captured.`,
      };
    }

    return {
      isDuplicate: false,
      action: "RECORD_AUTHORIZED",
      targetStatus: "Authorized",
      paymentId,
      orderId,
      amountINR,
    };
  }

  if (event === "refund.processed") {
    const refundEntity = payload?.refund?.entity || {};
    const refundAmtINR = roundCurrency((Number(refundEntity.amount) || 0) / 100);

    return {
      isDuplicate: false,
      action: "RECORD_REFUND",
      targetStatus: "Refunded",
      paymentId,
      orderId,
      amountINR: refundAmtINR,
    };
  }

  return {
    isDuplicate: false,
    action: "IGNORE",
    targetStatus: "Pending",
    paymentId,
    orderId,
    amountINR,
    reason: `Unhandled event type: ${event}`,
  };
}
