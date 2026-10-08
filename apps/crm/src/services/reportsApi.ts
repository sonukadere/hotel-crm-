import { authFetch } from "./http";
import type {
  HotelReportType,
  ReportFilterPreset,
  HotelReportResponse,
} from "@hotel/types";

const API_BASE = "http://localhost:4000/api";

export async function fetchHotelReport(
  reportType: HotelReportType,
  preset: ReportFilterPreset = "today",
  startDate?: string,
  endDate?: string,
  hotelId?: string,
): Promise<HotelReportResponse> {
  const params = new URLSearchParams();
  params.append("preset", preset);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (hotelId) params.append("hotelId", hotelId);

  const res = await authFetch(`${API_BASE}/reports/type/${reportType}?${params.toString()}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || json.message || "Failed to generate report");
  }
  return json.data;
}

export function getReportDownloadUrl(
  reportType: HotelReportType,
  preset: ReportFilterPreset = "today",
  format: "csv" | "excel" = "csv",
  startDate?: string,
  endDate?: string,
): string {
  const params = new URLSearchParams();
  params.append("preset", preset);
  params.append("format", format);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  return `${API_BASE}/reports/type/${reportType}?${params.toString()}`;
}
