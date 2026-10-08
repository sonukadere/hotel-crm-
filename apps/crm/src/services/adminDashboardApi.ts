import { authFetch } from "./http";
import type { AdminDashboardData, UserRole } from "@hotel/types";

const API_BASE = "http://localhost:4000/api";

export async function fetchAdminDashboardOverview(
  hotelId?: string,
  businessDate?: string,
  role: UserRole = "Admin",
): Promise<AdminDashboardData> {
  const params = new URLSearchParams();
  if (hotelId) params.append("hotelId", hotelId);
  if (businessDate) params.append("businessDate", businessDate);
  if (role) params.append("role", role);

  const res = await authFetch(`${API_BASE}/admin-dashboard/overview?${params.toString()}`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to fetch admin dashboard overview");
  }
  return data.data;
}
