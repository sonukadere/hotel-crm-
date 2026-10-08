import { authFetch } from "./http";
const API_BASE = "http://localhost:4000/api";

export interface GuestIdentity {
  id: string;
  identityType: string;
  idNumber: string;
  maskedIdNumber: string;
  verified: boolean;
}

export interface LoyaltyAccount {
  id: string;
  tier: string;
  availablePoints: number;
  lifetimePoints: number;
}

export interface GuestBooking {
  id: string;
  bookingNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  room?: { roomNumber: string };
  roomType?: { name: string };
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  folio?: {
    id: string;
    folioNumber: string;
    payments: Array<{ id: string; amount: number; method: string; status: string; receivedAt: string }>;
  };
}

export interface GuestProfile {
  id: string;
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  country: string;
  guestType: string;
  corporateGstin?: string;
  corporateName?: string;
  identities?: GuestIdentity[];
  internationalDetails?: any;
  loyaltyAccount?: LoyaltyAccount;
  preferences?: any;
  notes?: string;
  createdAt: string;
  bookings: GuestBooking[];
  leads?: any[];
}

export interface CRMLead {
  id: string;
  hotelId: string;
  guestName: string;
  mobile: string;
  email?: string;
  source: string;
  requirement?: string;
  expectedCheckIn?: string;
  expectedCheckOut?: string;
  guestCount?: number;
  status: "New" | "Contacted" | "Qualified" | "Converted" | "Lost";
  notes?: string;
  convertedBookingId?: string;
  createdAt: string;
  updatedAt: string;
}

export async function searchGuestsApi(query: string): Promise<GuestProfile[]> {
  try {
    const res = await authFetch(`${API_BASE}/crm/guests/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) return data.data;
    }
  } catch (_e) {}
  return [];
}

export async function getGuestProfileApi(guestId: string): Promise<GuestProfile | null> {
  try {
    const res = await authFetch(`${API_BASE}/crm/guests/${guestId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function createCRMLeadApi(leadData: {
  hotelId: string;
  guestName: string;
  mobile: string;
  email?: string;
  source?: string;
  requirement?: string;
  expectedCheckIn?: string;
  expectedCheckOut?: string;
  guestCount?: number;
  notes?: string;
}): Promise<CRMLead | null> {
  try {
    const res = await authFetch(`${API_BASE}/crm/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function updateLeadStatusApi(leadId: string, status: CRMLead["status"], userId?: string): Promise<CRMLead | null> {
  try {
    const res = await authFetch(`${API_BASE}/crm/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, userId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function getCRMLeadsApi(hotelId?: string, status?: string): Promise<CRMLead[]> {
  try {
    const params = new URLSearchParams();
    if (hotelId) params.append("hotelId", hotelId);
    if (status) params.append("status", status);
    const res = await authFetch(`${API_BASE}/crm/leads?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) return data.data;
    }
  } catch (_e) {}
  return [];
}
