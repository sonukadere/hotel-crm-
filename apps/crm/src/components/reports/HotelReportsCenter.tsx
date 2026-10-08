import { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  TrendingUp,
  Percent,
  Receipt,
  BedDouble,
  Users,
  LogOut,
  Ban,
  UserX,
  Sparkles,
  Award,
} from "lucide-react";
import { Card, Button } from "@hotel/ui";
import {
  formatINR,
  generateReportCSV,
  generateReportExcelXML,
} from "@hotel/utils";
import type {
  HotelReportType,
  ReportFilterPreset,
  HotelReportResponse,
} from "@hotel/types";
import { fetchHotelReport } from "../../services/reportsApi";

interface ReportMeta {
  type: HotelReportType;
  label: string;
  category: "revenue" | "operations" | "compliance" | "loyalty";
  icon: any;
  desc: string;
}

const REPORT_CATALOG: ReportMeta[] = [
  // Revenue & Financial
  {
    type: "daily-revenue",
    label: "Daily Revenue Report",
    category: "revenue",
    icon: DollarSign,
    desc: "Room charges, ancillary services, GST, gross billed, and net collections",
  },
  {
    type: "adr",
    label: "ADR Report",
    category: "revenue",
    icon: TrendingUp,
    desc: "Average daily room rate realized across occupied room inventory",
  },
  {
    type: "revpar",
    label: "RevPAR Report",
    category: "revenue",
    icon: Percent,
    desc: "Revenue per available room combining average rate and property occupancy",
  },
  {
    type: "service-revenue",
    label: "Service Revenue Report",
    category: "revenue",
    icon: Sparkles,
    desc: "Dining, room service, laundry, spa, and banquet facility earnings",
  },
  {
    type: "payment-collection",
    label: "Payment Collection Report",
    category: "revenue",
    icon: Receipt,
    desc: "Detailed ledger of cash, UPI, POS cards, and Razorpay gateway receipts",
  },

  // Operations & Front Desk
  {
    type: "occupancy",
    label: "Occupancy Report",
    category: "operations",
    icon: BarChart3,
    desc: "Property capacity utilization, sold room nights, and percentage occupancy",
  },
  {
    type: "room-status",
    label: "Room Status Report",
    category: "operations",
    icon: BedDouble,
    desc: "Real-time housekeeping cleanliness and operational availability by floor",
  },
  {
    type: "check-in",
    label: "Check-in Report",
    category: "operations",
    icon: Users,
    desc: "Front desk guest registrations, room assignments, and advance collections",
  },
  {
    type: "check-out",
    label: "Check-out Report",
    category: "operations",
    icon: LogOut,
    desc: "Guest departures, room clearances, and final folio billing settlements",
  },
  {
    type: "cancellation",
    label: "Cancellation Report",
    category: "operations",
    icon: Ban,
    desc: "Voided reservations, released dates, and unrealized revenue log",
  },
  {
    type: "no-show",
    label: "No-show Report",
    category: "operations",
    icon: UserX,
    desc: "Unclaimed confirmed bookings and retained guarantee deposits",
  },

  // Compliance & Folios
  {
    type: "gst",
    label: "Statutory GST Report",
    category: "compliance",
    icon: Building2,
    desc: "Ministry of Finance compliant SAC breakdown with CGST, SGST, and IGST",
  },
  {
    type: "outstanding-folio",
    label: "Outstanding Folio Report",
    category: "compliance",
    icon: AlertCircle,
    desc: "Unsettled guest and corporate accounts with pending balances due",
  },

  // Loyalty
  {
    type: "loyalty",
    label: "Loyalty Program Report",
    category: "loyalty",
    icon: Award,
    desc: "Tier standings, points circulation, redemption volume, and member spend",
  },
];

export function HotelReportsCenter() {
  const [selectedReportType, setSelectedReportType] = useState<HotelReportType>("daily-revenue");
  const [preset, setPreset] = useState<ReportFilterPreset>("today");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [reportData, setReportData] = useState<HotelReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Load report on change of type, preset, or custom dates
  useEffect(() => {
    loadReport();
  }, [selectedReportType, preset]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchHotelReport(
        selectedReportType,
        preset,
        preset === "custom" ? customStart : undefined,
        preset === "custom" ? customEnd : undefined,
      );
      setReportData(data);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Failed to load report", err);
      setError(err?.message || "Failed to load report data from database");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preset === "custom") {
      loadReport();
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!reportData) return;
    const csvContent = generateReportCSV(reportData);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${reportData.reportType}-${reportData.filter.startDate}-to-${reportData.filter.endDate}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    const xmlContent = generateReportExcelXML(reportData);
    const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${reportData.reportType}-${reportData.filter.startDate}-to-${reportData.filter.endDate}.xls`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // Filter rows by search term
  const filteredRows = useMemo(() => {
    if (!reportData || !reportData.rows) return [];
    if (!searchTerm.trim()) return reportData.rows;

    const query = searchTerm.toLowerCase();
    return reportData.rows.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(query)),
    );
  }, [reportData, searchTerm]);

  const activeMeta = REPORT_CATALOG.find((r) => r.type === selectedReportType);

  return (
    <div className="space-y-6">
      {/* 1. Header with Property Branding and Action Tools */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/80 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Live Database Reports
            </span>
            <span className="text-xs text-slate-500">Updated: {lastRefreshedAt || "Just now"}</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Hotel Management & Statutory Reporting Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time analytics engine calculating performance metrics, tax declarations, and room operational logs.
          </p>
        </div>

        {/* Global Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            disabled={isLoading}
            className="border-slate-700 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!reportData || reportData.rows.length === 0}
            className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!reportData || reportData.rows.length === 0}
            className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Export Excel
          </Button>

          <Button
            variant="gold"
            size="sm"
            onClick={handlePrintPDF}
            disabled={!reportData}
            className="shadow-sm shadow-amber-500/20 font-semibold"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* 2. Main Grid: Left Catalog Navigation & Right Report Surface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: 14 Reports Catalog */}
        <div className="lg:col-span-1 space-y-4 print:hidden">
          <Card className="bg-slate-950/80 border-slate-800 p-4 space-y-4 shadow-md">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Select Report (14 Available)
            </h2>

            {/* Category Groups */}
            <div className="space-y-4 text-xs">
              {/* Group 1: Revenue */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider px-2">
                  Revenue & Financial
                </p>
                {REPORT_CATALOG.filter((r) => r.category === "revenue").map((r) => {
                  const Icon = r.icon;
                  const isActive = selectedReportType === r.type;
                  return (
                    <button
                      key={r.type}
                      onClick={() => setSelectedReportType(r.type)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all text-left ${
                        isActive
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Group 2: Operations */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider px-2 pt-2">
                  Operations & Front Desk
                </p>
                {REPORT_CATALOG.filter((r) => r.category === "operations").map((r) => {
                  const Icon = r.icon;
                  const isActive = selectedReportType === r.type;
                  return (
                    <button
                      key={r.type}
                      onClick={() => setSelectedReportType(r.type)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all text-left ${
                        isActive
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Group 3: Compliance & Tax */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-2 pt-2">
                  Statutory & Compliance
                </p>
                {REPORT_CATALOG.filter((r) => r.category === "compliance").map((r) => {
                  const Icon = r.icon;
                  const isActive = selectedReportType === r.type;
                  return (
                    <button
                      key={r.type}
                      onClick={() => setSelectedReportType(r.type)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all text-left ${
                        isActive
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Group 4: Loyalty */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider px-2 pt-2">
                  Guest Loyalty
                </p>
                {REPORT_CATALOG.filter((r) => r.category === "loyalty").map((r) => {
                  const Icon = r.icon;
                  const isActive = selectedReportType === r.type;
                  return (
                    <button
                      key={r.type}
                      onClick={() => setSelectedReportType(r.type)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all text-left ${
                        isActive
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Right 3 Columns: Active Report Surface */}
        <div className="lg:col-span-3 space-y-5">
          {/* 3. Filter Bar (Presets & Custom Date Picker) */}
          <Card className="bg-slate-950/80 border-slate-800 p-4 space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" /> Filter:
                </span>
                {(
                  [
                    { key: "today", label: "Today" },
                    { key: "yesterday", label: "Yesterday" },
                    { key: "current-week", label: "Current Week" },
                    { key: "current-month", label: "Current Month" },
                    { key: "custom", label: "Custom Range" },
                  ] as { key: ReportFilterPreset; label: string }[]
                ).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPreset(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      preset === p.key
                        ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20 font-bold"
                        : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Table search filter */}
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter table rows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Custom Range Inputs (Shown when preset is 'custom') */}
            {preset === "custom" && (
              <form
                onSubmit={handleCustomDateSubmit}
                className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3"
              >
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-medium">From:</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-medium">To:</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <Button variant="gold" size="sm" type="submit" className="text-xs py-1">
                  Apply Range
                </Button>
              </form>
            )}
          </Card>

          {/* 4. Active Report Title & Description */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {activeMeta && <activeMeta.icon className="w-5 h-5 text-amber-400" />}
                  {reportData?.title || activeMeta?.label}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {reportData?.description || activeMeta?.desc}
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Period:</span>{" "}
                <span className="text-amber-400 font-mono">
                  {reportData?.filter.startDate} to {reportData?.filter.endDate}
                </span>{" "}
                <span className="uppercase text-[10px] text-slate-500">
                  ({reportData?.filter.preset})
                </span>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 5. Executive Summary KPI Cards */}
            {reportData && reportData.summary && reportData.summary.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
                {reportData.summary.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors"
                  >
                    <p className="text-[11px] font-semibold text-slate-400 truncate">{kpi.label}</p>
                    <p className="text-base font-black text-amber-400 mt-1 font-mono tracking-tight truncate">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Detailed Data Table with Totals Row */}
          <Card className="bg-slate-950/80 border-slate-800 overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    {reportData?.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`p-3.5 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={reportData?.columns.length || 6}
                        className="p-8 text-center text-slate-400"
                      >
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
                        Calculating report rows from database...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={reportData?.columns.length || 6}
                        className="p-8 text-center text-slate-500"
                      >
                        No records found matching the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/60 transition-colors">
                        {reportData?.columns.map((col) => {
                          const val = row[col.key];
                          const alignClass =
                            col.align === "right"
                              ? "text-right font-mono"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left";

                          // Formatter
                          let formattedContent: any = val ?? "-";

                          if (col.format === "currency" && typeof val === "number") {
                            formattedContent = (
                              <span className="font-bold text-white">{formatINR(val)}</span>
                            );
                          } else if (col.format === "percent" && typeof val === "number") {
                            formattedContent = (
                              <span
                                className={`font-bold ${
                                  val >= 70
                                    ? "text-emerald-400"
                                    : val >= 40
                                    ? "text-amber-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {val}%
                              </span>
                            );
                          } else if (col.format === "badge") {
                            const badgeColor =
                              val === "Captured" || val === "Clean" || val === "Active" || val === "Gold"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : val === "Dirty" || val === "Unsettled" || val === "Silver"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : val === "Maintenance" || val === "Blocked" || val === "Cancelled"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-slate-800 text-slate-300 border-slate-700";

                            formattedContent = (
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}
                              >
                                {val}
                              </span>
                            );
                          }

                          return (
                            <td key={col.key} className={`p-3 ${alignClass}`}>
                              {formattedContent}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Totals Row */}
                {reportData && reportData.totals && Object.keys(reportData.totals).length > 0 && (
                  <tfoot className="bg-slate-900 border-t-2 border-slate-700 font-bold text-white text-xs">
                    <tr>
                      {reportData.columns.map((col, idx) => {
                        const totalVal = reportData.totals[col.key];
                        const alignClass =
                          col.align === "right"
                            ? "text-right font-mono"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left";

                        let formattedTotal: any = totalVal ?? (idx === 0 ? "TOTAL" : "");
                        if (col.format === "currency" && typeof totalVal === "number") {
                          formattedTotal = (
                            <span className="text-amber-400 font-extrabold">{formatINR(totalVal)}</span>
                          );
                        }

                        return (
                          <td key={col.key} className={`p-3.5 ${alignClass}`}>
                            {formattedTotal}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
