import { authFetch } from "./http";
import type { FolioItemType, PaymentMethod } from "@hotel/types";

const API_BASE = "http://localhost:4000/api";

export interface FolioSummaryItem {
  id: string;
  folioId: string;
  itemType: FolioItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sacCode: string;
  gstRate: number;
  gstAmount: number;
  isVoided: boolean;
  voidReason?: string;
  splitTarget: "Corporate" | "Personal";
  postedAt: string;
}

export interface FolioPaymentRecord {
  id: string;
  paymentNumber: string;
  folioId: string;
  amount: number;
  method: PaymentMethod;
  status: string;
  transactionRef?: string;
  panNumber?: string;
  notes?: string;
  receivedAt: string;
}

export interface FolioDetail {
  id: string;
  folioNumber: string;
  hotelId: string;
  bookingId: string;
  guestId: string;
  status: "Open" | "Closed" | "Settled";
  totalDebit: number;
  totalCredit: number;
  balanceDue: number;
  guest: {
    id: string;
    fullName: string;
    mobile: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    corporateName?: string;
    corporateGstin?: string;
  };
  booking?: {
    id: string;
    bookingNumber: string;
    checkInDate: string;
    checkOutDate: string;
    room?: { roomNumber: string };
    roomType?: { name: string };
    totalNights: number;
  };
  items: FolioSummaryItem[];
  payments: FolioPaymentRecord[];
  summary: {
    roomSubtotal: number;
    roomDiscount: number;
    discountedRoomSubtotal: number;
    totalRoomGST: number;
    totalServicesCharges: number;
    totalServicesGST: number;
    totalDebit: number;
    advanceDeposit: number;
    razorpayPayments: number;
    cashCollected: number;
    loyaltyRedeemed: number;
    cardPayments: number;
    upiPayments: number;
    bankTransferPayments: number;
    totalCredit: number;
    balanceDue: number;
    isSettled: boolean;
    amountInWords: string;
    corporate: {
      debit: number;
      taxable: number;
      tax: number;
      credit: number;
      balanceDue: number;
    };
    personal: {
      debit: number;
      taxable: number;
      tax: number;
      credit: number;
      balanceDue: number;
    };
  };
}

export interface GSTInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: "Consolidated" | "Corporate" | "Personal";
  hotel: {
    name: string;
    legalName?: string;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
    phone: string;
    email: string;
    gstin: string;
    pan?: string;
  };
  guest: {
    fullName: string;
    mobile: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    corporateName?: string;
    corporateGstin?: string;
  };
  booking?: {
    bookingNumber: string;
    checkInDate: string;
    checkOutDate: string;
    roomNumber?: string;
    roomType?: string;
    totalNights: number;
  };
  placeOfSupply: string;
  isInterState: boolean;
  items: Array<{
    id: string;
    itemType: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sacCode: string;
    gstRate: number;
    gstAmount: number;
    splitTarget?: string;
  }>;
  sacBreakdown: Array<{
    sacCode: string;
    description: string;
    taxableAmount: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
  }>;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
  amountInWords: string;
  payments: Array<{
    paymentNumber: string;
    method: string;
    amount: number;
    status: string;
    receivedAt: string;
  }>;
  totalCredit: number;
  balanceDue: number;
  isSettled: boolean;
}

export async function fetchFoliosApi(params: {
  status?: string;
  search?: string;
} = {}): Promise<any[]> {
  try {
    const query = new URLSearchParams();
    if (params.status && params.status !== "ALL") query.set("status", params.status);
    if (params.search) query.set("search", params.search);

    const res = await authFetch(`${API_BASE}/folios?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) return data.data;
    }
  } catch (_e) {}
  return [];
}

export async function fetchFolioByIdApi(folioId: string): Promise<FolioDetail | null> {
  try {
    const res = await authFetch(`${API_BASE}/folios/${folioId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return null;
}

export async function addFolioItemApi(folioId: string, itemData: {
  itemType: FolioItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  customGstRate?: number;
  splitTarget?: "Corporate" | "Personal";
}): Promise<any> {
  const res = await authFetch(`${API_BASE}/folios/${folioId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(itemData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Failed to add folio item"));
  }
  return data.data;
}

export async function editFolioItemApi(itemId: string, itemData: {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  splitTarget?: "Corporate" | "Personal";
}): Promise<any> {
  const res = await authFetch(`${API_BASE}/folios/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(itemData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Failed to update folio item"));
  }
  return data.data;
}

export async function voidFolioItemApi(itemId: string, reason: string): Promise<any> {
  const res = await authFetch(`${API_BASE}/folios/items/${itemId}/void`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Failed to void folio item"));
  }
  return data.data;
}

export async function applyFolioDiscountApi(folioId: string, amount: number, reason: string, splitTarget?: "Corporate" | "Personal"): Promise<any> {
  const res = await authFetch(`${API_BASE}/folios/${folioId}/discounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, reason, splitTarget }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Failed to apply discount"));
  }
  return data.data;
}

export async function recordFolioPaymentApi(folioId: string, paymentData: {
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  panNumber?: string;
  notes?: string;
  isAdvance?: boolean;
}): Promise<any> {
  const res = await authFetch(`${API_BASE}/folios/${folioId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paymentData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Failed to record payment"));
  }
  return data.data;
}

export async function refundFolioPaymentApi(paymentId: string, reason: string, amount?: number): Promise<any> {
  const res = await authFetch(`${API_BASE}/folios/payments/${paymentId}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, amount }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || (Array.isArray(data.errors) ? data.errors.join(", ") : "Failed to refund payment"));
  }
  return data.data;
}

export async function generateFolioInvoiceApi(folioId: string, invoiceType: "Consolidated" | "Corporate" | "Personal" = "Consolidated"): Promise<GSTInvoiceData> {
  const res = await authFetch(`${API_BASE}/folios/${folioId}/invoice?invoiceType=${invoiceType}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to generate tax invoice");
  }
  return data.data;
}

export async function createRazorpayOrderApi(folioId: string, amount?: number): Promise<{
  orderId: string;
  amount: number;
  amountINR: number;
  currency: string;
  keyId: string;
  folioId: string;
  balanceDue: number;
  isFullSettlement: boolean;
}> {
  const res = await authFetch(`${API_BASE}/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folioId, amount }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to create Razorpay order");
  }
  return data.data;
}

export async function verifyRazorpayPaymentApi(params: {
  folioId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  amount?: number;
  userId?: string;
  notes?: string;
}): Promise<any> {
  const res = await authFetch(`${API_BASE}/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Razorpay signature verification failed");
  }
  return data.data;
}
