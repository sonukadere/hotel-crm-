export const BOOKING_SESSION_KEY = "grandrajwada.booking.session";

export interface BookingSession {
  bookingNumber: string;
  mobile: string;
  savedAt: number;
}

export function saveBookingSession(session: BookingSession): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BOOKING_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage may be disabled - the guest can still look the booking up manually.
  }
}

export function readBookingSession(): BookingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BOOKING_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingSession;
    if (!parsed || typeof parsed.bookingNumber !== "string") return null;
    if (typeof parsed.mobile !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
