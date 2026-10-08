import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  validatePayableAmount,
  evaluateRefund,
  evaluateWebhookTransition,
} from "../payments/paymentEngine";
import { validateCashCompliance } from "../gst/gstValidators";

describe("MODULE 8 — Payment & Razorpay Engine", () => {
  const TEST_KEY_SECRET = "secret_key_test_1234567890abcdef";
  const TEST_WEBHOOK_SECRET = "webhook_secret_9876543210fedcba";

  describe("Razorpay Signature Verification", () => {
    it("successfully verifies authentic Razorpay payment signature (Successful payment)", () => {
      const orderId = "order_Oq7K9xX1234567";
      const paymentId = "pay_Pq8L0yY7654321";
      const payload = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac("sha256", TEST_KEY_SECRET)
        .update(payload)
        .digest("hex");

      const isValid = verifyRazorpayPaymentSignature(
        orderId,
        paymentId,
        validSignature,
        TEST_KEY_SECRET,
      );

      expect(isValid).toBe(true);
    });

    it("rejects tampered or invalid signature (Invalid signature)", () => {
      const orderId = "order_Oq7K9xX1234567";
      const paymentId = "pay_Pq8L0yY7654321";
      const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      const isValid = verifyRazorpayPaymentSignature(
        orderId,
        paymentId,
        forgedSignature,
        TEST_KEY_SECRET,
      );

      expect(isValid).toBe(false);
    });

    it("rejects when secret, orderId, or paymentId are missing", () => {
      expect(verifyRazorpayPaymentSignature("", "pay_1", "sig", TEST_KEY_SECRET)).toBe(false);
      expect(verifyRazorpayPaymentSignature("ord_1", "", "sig", TEST_KEY_SECRET)).toBe(false);
      expect(verifyRazorpayPaymentSignature("ord_1", "pay_1", "", TEST_KEY_SECRET)).toBe(false);
      expect(verifyRazorpayPaymentSignature("ord_1", "pay_1", "sig", "")).toBe(false);
    });
  });

  describe("Razorpay Webhook Verification & Idempotency", () => {
    it("authenticates valid webhook signature (Authenticated/verified)", () => {
      const payloadString = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_test_100", amount: 500000 } } },
      });

      const signature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(payloadString)
        .digest("hex");

      const isValid = verifyRazorpayWebhookSignature(
        payloadString,
        signature,
        TEST_WEBHOOK_SECRET,
      );

      expect(isValid).toBe(true);
    });

    it("rejects unauthenticated/tampered webhook payloads", () => {
      const payloadString = JSON.stringify({ event: "payment.captured" });
      const badSig = "deadbeef12345678deadbeef12345678deadbeef12345678deadbeef12345678";

      const isValid = verifyRazorpayWebhookSignature(
        payloadString,
        badSig,
        TEST_WEBHOOK_SECRET,
      );

      expect(isValid).toBe(false);
    });

    it("handles Duplicate Webhook by ignoring already captured payment (Duplicate webhook)", () => {
      const eventPayload = {
        payment: {
          entity: {
            id: "pay_captured_already_1",
            order_id: "order_123",
            amount: 750000, // ₹7,500
          },
        },
      };

      const existingPayment = {
        id: "p-uuid-1",
        status: "Captured" as const,
        amount: 7500,
        razorpayPaymentId: "pay_captured_already_1",
      };

      const result = evaluateWebhookTransition("payment.captured", eventPayload, existingPayment);

      expect(result.isDuplicate).toBe(true);
      expect(result.action).toBe("IGNORE");
      expect(result.reason).toContain("Duplicate webhook ignored");
    });

    it("processes first-time payment.captured event safely", () => {
      const eventPayload = {
        payment: {
          entity: {
            id: "pay_new_first_time",
            order_id: "order_abc",
            amount: 420000, // ₹4,200
          },
        },
      };

      const result = evaluateWebhookTransition("payment.captured", eventPayload, null);

      expect(result.isDuplicate).toBe(false);
      expect(result.action).toBe("RECORD_CAPTURED");
      expect(result.targetStatus).toBe("Captured");
      expect(result.amountINR).toBe(4200);
      expect(result.paymentId).toBe("pay_new_first_time");
    });

    it("processes payment.failed webhook event (Failed payment)", () => {
      const eventPayload = {
        payment: {
          entity: {
            id: "pay_failed_xyz",
            order_id: "order_fail_1",
            amount: 300000,
          },
        },
      };

      const result = evaluateWebhookTransition("payment.failed", eventPayload, null);

      expect(result.isDuplicate).toBe(false);
      expect(result.action).toBe("RECORD_FAILED");
      expect(result.targetStatus).toBe("Failed");
      expect(result.paymentId).toBe("pay_failed_xyz");
    });
  });

  describe("Backend Payable Amount Calculation & Settlement", () => {
    it("processes Partial Payment accurately (Partial payment)", () => {
      const currentBalanceDue = 15000;
      const requestedPayment = 6000; // partial ₹6,000 against ₹15,000

      const result = validatePayableAmount(requestedPayment, currentBalanceDue);

      expect(result.isValid).toBe(true);
      expect(result.payableAmount).toBe(6000);
      expect(result.isFullSettlement).toBe(false);
      expect(result.remainingAfterPayment).toBe(9000);
    });

    it("processes Full Payment and settles folio balance (Full payment)", () => {
      const currentBalanceDue = 18500;
      const requestedPayment = 18500;

      const result = validatePayableAmount(requestedPayment, currentBalanceDue);

      expect(result.isValid).toBe(true);
      expect(result.payableAmount).toBe(18500);
      expect(result.isFullSettlement).toBe(true);
      expect(result.remainingAfterPayment).toBe(0);
    });

    it("defaults to full remaining balance if amount is omitted by frontend", () => {
      const currentBalanceDue = 12400;

      const result = validatePayableAmount(undefined, currentBalanceDue);

      expect(result.isValid).toBe(true);
      expect(result.payableAmount).toBe(12400);
      expect(result.isFullSettlement).toBe(true);
      expect(result.remainingAfterPayment).toBe(0);
    });

    it("rejects when requested payment exceeds remaining balance due (Never trust frontend amount)", () => {
      const currentBalanceDue = 5000;
      const requestedPayment = 10000; // Trying to pay ₹10,000 when only ₹5,000 is due

      const result = validatePayableAmount(requestedPayment, currentBalanceDue);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("exceeds the remaining balance due");
    });

    it("rejects payment if folio is already fully settled", () => {
      const currentBalanceDue = 0;

      const result = validatePayableAmount(1000, currentBalanceDue);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("already fully settled");
    });
  });

  describe("Refund Processing & Status Transitions", () => {
    it("handles partial refund and transitions payment to PartiallyRefunded (Refund)", () => {
      const originalAmount = 10000;
      const alreadyRefunded = 0;
      const requestedRefund = 3000;

      const result = evaluateRefund(originalAmount, alreadyRefunded, requestedRefund);

      expect(result.isValid).toBe(true);
      expect(result.newRefundedTotal).toBe(3000);
      expect(result.maxRefundable).toBe(10000);
      expect(result.newStatus).toBe("PartiallyRefunded");
      expect(result.isFullRefund).toBe(false);
    });

    it("handles full refund and transitions payment to Refunded", () => {
      const originalAmount = 10000;
      const alreadyRefunded = 3000;
      const requestedRefund = 7000;

      const result = evaluateRefund(originalAmount, alreadyRefunded, requestedRefund);

      expect(result.isValid).toBe(true);
      expect(result.newRefundedTotal).toBe(10000);
      expect(result.newStatus).toBe("Refunded");
      expect(result.isFullRefund).toBe(true);
    });

    it("rejects refund when requested amount exceeds unrefunded principal", () => {
      const originalAmount = 5000;
      const alreadyRefunded = 2000; // Remaining refundable is ₹3,000
      const requestedRefund = 4000; // Trying to refund ₹4,000

      const result = evaluateRefund(originalAmount, alreadyRefunded, requestedRefund);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("exceeds maximum refundable balance");
    });

    it("rejects negative or zero refund requests", () => {
      const result = evaluateRefund(5000, 0, 0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("greater than zero");
    });
  });

  describe("Cash Payment Compliance & Safeguards (Section 269ST)", () => {
    it("permits standard compliant cash payment below ₹50,000 without PAN", () => {
      const compliance = validateCashCompliance(25000);
      expect(compliance.isValid).toBe(true);
      expect(compliance.requiresPan).toBe(false);
      expect(compliance.exceedsCashLimit).toBe(false);
    });

    it("mandates valid PAN for cash payment exceeding ₹50,000 (Rule 114B)", () => {
      const complianceWithoutPan = validateCashCompliance(75000);
      expect(complianceWithoutPan.isValid).toBe(false);
      expect(complianceWithoutPan.requiresPan).toBe(true);
      expect(complianceWithoutPan.errors[0]).toContain("PAN is legally mandatory");

      const complianceWithValidPan = validateCashCompliance(75000, "ABCDE1234F");
      expect(complianceWithValidPan.isValid).toBe(true);
    });

    it("strictly rejects cash payment >= ₹2,00,000 under Section 269ST", () => {
      const compliance = validateCashCompliance(200000, "ABCDE1234F");
      expect(compliance.isValid).toBe(false);
      expect(compliance.exceedsCashLimit).toBe(true);
      expect(compliance.errors[0]).toContain("Section 269ST (Limit: ₹2,00,000)");
    });
  });
});
