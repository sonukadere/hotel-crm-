import { authFetch } from "./http";
import type {
  TapeChartResponse,
  CheckInValidationResult,
  CheckoutSummary,
  RoomSwitchResult,
  ReservationQuote,
  ReservationQuoteInput,
  BookingStatus,
  RoomStatus,
} from "@hotel/types";

const API_BASE = "http://localhost:4000/api";

export interface FrontDeskGuest {
  id: string;
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  country?: string;
  guestType?: string;
  corporateGstin?: string;
  corporateName?: string;
  identities?: Array<{
    id: string;
    identityType: string;
    idNumber: string;
    maskedIdNumber: string;
  }>;
  internationalDetails?: {
    passportNumber?: string;
    visaNumber?: string;
    visaExpiry?: string;
    nationality?: string;
    arrivalDate?: string;
    departureDate?: string;
    arrivalPort?: string;
  };
}

export async function fetchTapeChartApi(params: {
  from?: string;
  days?: number;
  floorId?: string;
  roomTypeId?: string;
  search?: string;
} = {}): Promise<TapeChartResponse | null> {
  try {
    const query = new URLSearchParams();
    if (params.from) query.set("from", params.from);
    if (params.days) query.set("days", String(params.days));
    if (params.floorId) query.set("floorId", params.floorId);
    if (params.roomTypeId) query.set("roomTypeId", params.roomTypeId);
    if (params.search) query.set("search", params.search);

    const res = await authFetch(`${API_BASE}/front-desk/tape-chart?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function searchGuestByMobileApi(mobile: string): Promise<FrontDeskGuest | null> {
  try {
    const res = await authFetch(`${API_BASE}/front-desk/guest-search?mobile=${encodeURIComponent(mobile)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function upsertQuickCheckInGuestApi(guestData: any): Promise<FrontDeskGuest | null> {
  try {
    const res = await authFetch(`${API_BASE}/front-desk/quick-check-in-guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(guestData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function quoteReservationApi(input: ReservationQuoteInput & { ratePlanId?: string }): Promise<ReservationQuote | null> {
  try {
    const res = await authFetch(`${API_BASE}/front-desk/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function createReservationApi(bookingData: any): Promise<any> {
  const res = await authFetch(`${API_BASE}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Failed to create reservation"));
  }
  return data.data;
}

export async function validateCheckInApi(bookingId: string, roomId?: string): Promise<CheckInValidationResult | null> {
  try {
    const url = roomId
      ? `${API_BASE}/front-desk/validate-check-in/${bookingId}?roomId=${roomId}`
      : `${API_BASE}/front-desk/validate-check-in/${bookingId}`;
    const res = await authFetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function checkInGuestApi(params: {
  bookingId: string;
  roomId?: string;
  guest?: any;
  additionalPayment?: { amount: number; method?: string; panNumber?: string; transactionRef?: string };
}): Promise<any> {
  const res = await authFetch(`${API_BASE}/front-desk/check-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Check-in failed"));
  }
  return data.data;
}

export async function getCheckoutSummaryApi(bookingId: string): Promise<CheckoutSummary> {
  const res = await authFetch(`${API_BASE}/front-desk/checkout-summary/${bookingId}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to load checkout summary");
  }
  return data.data;
}

export async function checkOutGuestApi(params: {
  bookingId: string;
  settlement?: { amount: number; method?: string; transactionRef?: string; panNumber?: string };
  roomStatus?: RoomStatus;
}): Promise<any> {
  const res = await authFetch(`${API_BASE}/front-desk/check-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Check-out failed"));
  }
  return data.data;
}

export async function switchRoomApi(params: {
  bookingId: string;
  newRoomId: string;
  reason: string;
  recalculateRate?: boolean;
}): Promise<RoomSwitchResult> {
  const res = await authFetch(`${API_BASE}/front-desk/room-switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Room switch failed"));
  }
  return data.data;
}

export async function fetchReservationsApi(status?: BookingStatus): Promise<any[]> {
  try {
    const url = status ? `${API_BASE}/reservations?status=${status}` : `${API_BASE}/reservations`;
    const res = await authFetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) return data.data;
    }
  } catch (_e) {}
  return [];
}
