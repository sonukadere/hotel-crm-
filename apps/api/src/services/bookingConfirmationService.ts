import { recordAuditLog } from "./auditService";

export interface ConfirmationPricing {
  roomSubtotal: number;
  services: number;
  discount: number;
  gst: number;
  finalAmount: number;
  amountInWords: string;
}

export interface BookingConfirmationPayload {
  bookingNumbers: string[];
  primaryBookingNumber: string;
  status: string;
  hotel: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    gstin: string;
    stateCode: string;
    checkInTime: string;
    checkOutTime: string;
  };
  guest: {
    fullName: string;
    mobile: string;
    email?: string | null;
    state?: string | null;
    stateCode?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  stay: {
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    rooms: number;
    mealPlan: string;
    roomType: { code: string; name: string };
    ratePlan: { code: string; name: string };
    roomNumbers: string[];
  };
  pricing: ConfirmationPricing;
  payment: {
    amount: number;
    method: string;
    transactionRef?: string | null;
    paidAt: string;
  };
  confirmation: {
    sent: boolean;
    channel: string;
    sentAt: string;
    error?: string;
  };
  createdAt: string;
}

export interface SendConfirmationResult {
  sent: boolean;
  channel: string;
  error?: string;
}

function renderConfirmationText(payload: BookingConfirmationPayload): string {
  const { stay, pricing, guest, hotel, payment } = payload;
  return [
    `Dear ${guest.fullName},`,
    ``,
    `Your stay at ${hotel.name} is confirmed.`,
    ``,
    `Booking: ${payload.primaryBookingNumber}`,
    `Room type: ${stay.roomType.name} (${stay.roomType.code})`,
    `Meal plan: ${stay.mealPlan}`,
    `Check-in: ${stay.checkInDate} from ${hotel.checkInTime}`,
    `Check-out: ${stay.checkOutDate} by ${hotel.checkOutTime}`,
    `Nights: ${stay.nights} | Rooms: ${stay.rooms} | Adults: ${stay.adults} | Children: ${stay.children}`,
    `Guests: ${stay.roomNumbers.length > 0 ? `Room(s) ${stay.roomNumbers.join(", ")}` : "To be assigned"}`,
    ``,
    `Room subtotal: INR ${pricing.roomSubtotal.toFixed(2)}`,
    `Services: INR ${pricing.services.toFixed(2)}`,
    `GST: INR ${pricing.gst.toFixed(2)}`,
    `Discount: INR ${pricing.discount.toFixed(2)}`,
    `Amount paid: INR ${pricing.finalAmount.toFixed(2)}`,
    `(${pricing.amountInWords})`,
    ``,
    `Payment reference: ${payment.transactionRef ?? payment.method}`,
    ``,
    `${hotel.name}, ${hotel.address}, ${hotel.city} - ${hotel.pincode}`,
    `Phone: ${hotel.phone} | Email: ${hotel.email}`,
    `GSTIN: ${hotel.gstin}`,
  ].join("\n");
}

function renderConfirmationHtml(payload: BookingConfirmationPayload): string {
  const { stay, pricing, guest, hotel, payment } = payload;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 10px;color:#64748b;border-bottom:1px solid #e2e8f0">${label}</td><td style="padding:6px 10px;text-align:right;color:#0f172a;border-bottom:1px solid #e2e8f0;font-weight:600">${value}</td></tr>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <h2 style="margin:0 0 4px;color:#0f172a">${hotel.name}</h2>
      <p style="margin:0 0 18px;color:#64748b">Booking confirmation — <strong>${payload.primaryBookingNumber}</strong></p>
      <p style="margin:0 0 18px;color:#334155">Dear ${guest.fullName}, your reservation is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row("Room type", `${stay.roomType.name} (${stay.roomType.code})`)}
        ${row("Meal plan", stay.mealPlan)}
        ${row("Check-in", `${stay.checkInDate} from ${hotel.checkInTime}`)}
        ${row("Check-out", `${stay.checkOutDate} by ${hotel.checkOutTime}`)}
        ${row("Nights / Rooms", `${stay.nights} / ${stay.rooms}`)}
        ${row("Adults / Children", `${stay.adults} / ${stay.children}`)}
        ${row("Room subtotal", `INR ${pricing.roomSubtotal.toFixed(2)}`)}
        ${row("Services", `INR ${pricing.services.toFixed(2)}`)}
        ${row("GST", `INR ${pricing.gst.toFixed(2)}`)}
        ${row("Discount", `INR ${pricing.discount.toFixed(2)}`)}
        ${row("Amount paid", `INR ${pricing.finalAmount.toFixed(2)}`)}
        ${row("Payment reference", payment.transactionRef ?? payment.method)}
      </table>
      <p style="margin:18px 0 0;color:#64748b;font-size:13px">${hotel.address}, ${hotel.city} - ${hotel.pincode} • ${hotel.phone} • GSTIN ${hotel.gstin}</p>
    </div>
  </div>`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends the booking confirmation after a successful online payment.
 *
 * There is no mail provider wired into this monorepo, so the channel is
 * pluggable: `RESEND_API_KEY` posts to the Resend HTTP API, otherwise a
 * generic `BOOKING_CONFIRMATION_WEBHOOK` receives the JSON payload, otherwise
 * the confirmation is logged. Whatever happens, the dispatch is written to the
 * immutable audit log so an outbound confirmation can never silently vanish.
 */
export async function sendBookingConfirmation(
  payload: BookingConfirmationPayload,
  hotelId?: string,
): Promise<SendConfirmationResult> {
  const subject = `Booking Confirmed — ${payload.primaryBookingNumber}`;
  let result: SendConfirmationResult;

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM || "reservations@example.com";
  const webhookUrl = process.env.BOOKING_CONFIRMATION_WEBHOOK;

  if (resendApiKey && guestEmail(payload)) {
    try {
      const response = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [guestEmail(payload)!],
          subject,
          text: renderConfirmationText(payload),
          html: renderConfirmationHtml(payload),
        }),
      });
      result = response.ok
        ? { sent: true, channel: "email" }
        : { sent: false, channel: "email", error: `Resend responded ${response.status}` };
    } catch (error) {
      result = { sent: false, channel: "email", error: (error as Error).message };
    }
  } else if (webhookUrl) {
    try {
      const response = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, payload }),
      });
      result = response.ok
        ? { sent: true, channel: "webhook" }
        : { sent: false, channel: "webhook", error: `Webhook responded ${response.status}` };
    } catch (error) {
      result = { sent: false, channel: "webhook", error: (error as Error).message };
    }
  } else {
    console.log(`\n=== BOOKING CONFIRMATION ===\n${renderConfirmationText(payload)}\n===========================\n`);
    result = { sent: true, channel: "log" };
  }

  payload.confirmation = {
    sent: result.sent,
    channel: result.channel,
    sentAt: new Date().toISOString(),
    error: result.error,
  };

  await recordAuditLog({
    hotelId,
    action: "BOOKING_CONFIRMATION_SENT",
    entity: "Booking",
    entityId: payload.primaryBookingNumber,
    newValue: {
      bookingNumbers: payload.bookingNumbers,
      guest: payload.guest.fullName,
      mobile: payload.guest.mobile,
      email: guestEmail(payload),
      channel: result.channel,
      sent: result.sent,
      error: result.error,
      amount: payload.pricing.finalAmount,
    },
  });

  return result;
}

function guestEmail(payload: BookingConfirmationPayload): string | undefined {
  return payload.guest.email?.trim() || undefined;
}
