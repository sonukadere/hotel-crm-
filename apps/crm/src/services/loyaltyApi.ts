import { authFetch } from "./http";
import type {
  LoyaltyProgramSettings,
  LoyaltyAccountSummary,
  LoyaltyTransaction,
  LoyaltyTierRule,
} from "@hotel/types";

const API_BASE = "http://localhost:4000/api";

export interface EarnLoyaltyPayload {
  guestId: string;
  hotelId?: string;
  eligibleSpendInr: number;
  folioId?: string;
  paymentId?: string;
  sacCode?: string;
  description?: string;
  userId?: string;
}

export interface RedeemLoyaltyPayload {
  guestId: string;
  hotelId?: string;
  pointsToRedeem: number;
  folioId: string;
  eligibleFolioBalanceInr?: number;
  description?: string;
  userId?: string;
}

export interface ReverseLoyaltyPayload {
  transactionId: string;
  hotelId?: string;
  reason?: string;
  reverseFolioPayment?: boolean;
  userId?: string;
}

export interface AdjustLoyaltyPayload {
  guestId: string;
  hotelId?: string;
  points: number;
  reason: string;
  userId?: string;
}

export async function fetchLoyaltySettings(hotelId?: string): Promise<LoyaltyProgramSettings> {
  const url = hotelId ? `${API_BASE}/loyalty/settings?hotelId=${hotelId}` : `${API_BASE}/loyalty/settings`;
  const res = await authFetch(url);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to load loyalty settings");
  }
  return data.data;
}

export async function updateLoyaltySettingsApi(
  payload: Partial<LoyaltyProgramSettings> & { hotelId?: string; tiers?: Partial<LoyaltyTierRule>[] }
): Promise<LoyaltyProgramSettings> {
  const res = await authFetch(`${API_BASE}/loyalty/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || (data.errors && data.errors.join(", ")) || "Failed to update loyalty settings");
  }
  return data.data;
}

export async function fetchLoyaltyAccount(guestId: string, hotelId?: string): Promise<LoyaltyAccountSummary> {
  const url = hotelId
    ? `${API_BASE}/loyalty/account/${guestId}?hotelId=${hotelId}`
    : `${API_BASE}/loyalty/account/${guestId}`;
  const res = await authFetch(url);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to fetch loyalty account");
  }
  return data.data;
}

export async function earnLoyaltyPointsApi(payload: EarnLoyaltyPayload): Promise<{
  account: any;
  transaction: LoyaltyTransaction;
  pointsEarned: number;
  tier: string;
}> {
  const res = await authFetch(`${API_BASE}/loyalty/earn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || (data.errors && data.errors.join(", ")) || "Failed to earn loyalty points");
  }
  return data.data;
}

export async function redeemLoyaltyPointsApi(payload: RedeemLoyaltyPayload): Promise<{
  account: any;
  transaction: LoyaltyTransaction;
  creditInr: number;
  payment: any;
  pointsRedeemed: number;
}> {
  const res = await authFetch(`${API_BASE}/loyalty/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || (data.errors && data.errors.join(", ")) || "Failed to redeem loyalty points");
  }
  return data.data;
}

export async function reverseLoyaltyTransactionApi(payload: ReverseLoyaltyPayload): Promise<{
  account: any;
  reversalTransaction: LoyaltyTransaction;
  originalTransaction: LoyaltyTransaction;
}> {
  const res = await authFetch(`${API_BASE}/loyalty/reverse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || (data.errors && data.errors.join(", ")) || "Failed to reverse loyalty transaction");
  }
  return data.data;
}

export async function adjustLoyaltyPointsApi(payload: AdjustLoyaltyPayload): Promise<{
  account: any;
  transaction: LoyaltyTransaction;
}> {
  const res = await authFetch(`${API_BASE}/loyalty/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || (data.errors && data.errors.join(", ")) || "Failed to adjust loyalty points");
  }
  return data.data;
}
