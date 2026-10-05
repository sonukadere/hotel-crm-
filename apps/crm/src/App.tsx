import React, { useState } from "react";
import {
  Hotel,
  Calendar,
  Receipt,
  Users,
  Award,
  Moon,
  BarChart3,
  Search,
  Plus,
  ArrowRightLeft,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Button, Card, RoomStatusBadge, Modal, Input } from "@hotel/ui";
import { formatINR, maskAadhaar, isValidGSTIN, numberToIndianWords } from "@hotel/utils";
import { DEFAULT_HOTEL_INFO, SAC_CODES } from "@hotel/config";
import type { RoomStatus, LeadStatus } from "@hotel/types";

// Operational inventory
const INITIAL_ROOMS: Array<{
  roomNumber: string;
  roomType: string;
  floor: string;
  status: RoomStatus;
  guestName?: string;
  rate: number;
}> = [
  { roomNumber: "101", roomType: "Standard Heritage", floor: "Floor 1", status: "Available", rate: 4200 },
  { roomNumber: "102", roomType: "Standard Heritage", floor: "Floor 1", status: "Clean", rate: 4200 },
  { roomNumber: "103", roomType: "Standard Heritage", floor: "Floor 1", status: "Dirty", rate: 4200 },
  { roomNumber: "104", roomType: "Standard Heritage", floor: "Floor 1", status: "Maintenance", rate: 4200 },
  { roomNumber: "201", roomType: "Deluxe Courtyard", floor: "Floor 2", status: "Available", rate: 6500 },
  { roomNumber: "202", roomType: "Deluxe Courtyard", floor: "Floor 2", status: "Occupied", guestName: "Vikram Singhania", rate: 6500 },
  { roomNumber: "203", roomType: "Deluxe Courtyard", floor: "Floor 2", status: "Clean", rate: 6500 },
  { roomNumber: "204", roomType: "Deluxe Courtyard", floor: "Floor 2", status: "Blocked", rate: 6500 },
  { roomNumber: "301", roomType: "Maharaja Suite", floor: "Floor 3", status: "Available", rate: 12500 },
  { roomNumber: "302", roomType: "Maharaja Suite", floor: "Floor 3", status: "Occupied", guestName: "Rajesh Mittal (Tata Steel)", rate: 12500 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"tape-chart" | "folios" | "crm" | "loyalty" | "night-audit" | "reports">("tape-chart");
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Quick Check-in modal state
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [corporateGstin, setCorporateGstin] = useState("");
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("101");
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState("");

  // Room Switch modal state
  const [isRoomSwitchOpen, setIsRoomSwitchOpen] = useState(false);
  const [switchFromRoom, setSwitchFromRoom] = useState("202");
  const [switchToRoom, setSwitchToRoom] = useState("201");
  const [switchReason, setSwitchReason] = useState("Guest requested courtyard garden view");
  const [switchSuccessMsg, setSwitchSuccessMsg] = useState("");

  // Night Audit state
  const [currentBusinessDate, setCurrentBusinessDate] = useState("2026-10-05");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditSuccess, setAuditSuccess] = useState(false);

  // CRM Leads state
  const [leads, setLeads] = useState([
    { id: "L-1", name: "Anil Ambani Corporate Desk", mobile: "9820011223", requirement: "10 Executive Deluxe Rooms for Annual Strategy Offsite", status: "Qualified" as LeadStatus, guestCount: 10 },
    { id: "L-2", name: "Pooja Hegde Wedding", mobile: "9876501234", requirement: "Banquet Hall + 25 Suites for 3 days", status: "New" as LeadStatus, guestCount: 50 },
    { id: "L-3", name: "Dr. K. Srinivas", mobile: "9123456789", requirement: "Deluxe Balcony with CP Meal Plan", status: "Contacted" as LeadStatus, guestCount: 2 },
  ]);

  // Loyalty accounts state
  const [loyaltyAccounts, setLoyaltyAccounts] = useState([
    { guest: "Vikram Singhania", tier: "Gold", points: 14200, spend: 185000 },
    { guest: "Rajesh Mittal (Tata Steel)", tier: "Silver", points: 8500, spend: 95000 },
    { guest: "Sunita Reddy", tier: "Bronze", points: 2100, spend: 32000 },
  ]);
  const [redeemSuccess, setRedeemSuccess] = useState("");

  const occupiedCount = rooms.filter((r) => r.status === "Occupied").length;
  const availableCount = rooms.filter((r) => r.status === "Available" || r.status === "Clean").length;
  const dirtyCount = rooms.filter((r) => r.status === "Dirty").length;
  const maintenanceCount = rooms.filter((r) => r.status === "Maintenance" || r.status === "Blocked").length;
  const totalRooms = rooms.length;
  const occupancyPct = Math.round((occupiedCount / totalRooms) * 100);

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.roomNumber.includes(searchFilter) ||
      r.roomType.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.guestName && r.guestName.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleQuickCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    setRooms((prev) =>
      prev.map((r) =>
        r.roomNumber === selectedRoomNumber
          ? { ...r, status: "Occupied", guestName: guestName }
          : r,
      ),
    );
    setCheckInSuccessMsg(
      `Guest ${guestName} checked in to Room ${selectedRoomNumber} with Masked ID ${maskAadhaar(aadhaarInput || "123456789012")}!`,
    );
    setTimeout(() => {
      setCheckInSuccessMsg("");
      setIsCheckInOpen(false);
      setGuestName("");
      setGuestMobile("");
      setAadhaarInput("");
      setCorporateGstin("");
    }, 1800);
  };

  const handleRoomSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    const source = rooms.find((r) => r.roomNumber === switchFromRoom);
    const guest = source?.guestName;

    setRooms((prev) =>
      prev.map((r) => {
        if (r.roomNumber === switchFromRoom) {
          return { ...r, status: "Dirty", guestName: undefined };
        }
        if (r.roomNumber === switchToRoom) {
          return { ...r, status: "Occupied", guestName: guest };
        }
        return r;
      }),
    );

    setSwitchSuccessMsg(`Successfully switched ${guest} from Room ${switchFromRoom} to Room ${switchToRoom}. Old room marked Dirty for housekeeping.`);
    setTimeout(() => {
      setSwitchSuccessMsg("");
      setIsRoomSwitchOpen(false);
    }, 2000);
  };

  const handleRunNightAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      setAuditSuccess(true);
      const nextDay = new Date(currentBusinessDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setCurrentBusinessDate(nextDay.toISOString().split("T")[0]!);
    }, 1800);
  };

  const handleConvertLead = (leadId: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: "Converted" as LeadStatus } : l)),
    );
  };

  const handleRedeemLoyalty = (guestNameStr: string) => {
    setLoyaltyAccounts((prev) =>
      prev.map((a) =>
        a.guest === guestNameStr && a.points >= 2000
          ? { ...a, points: a.points - 2000 }
          : a,
      ),
    );
    setRedeemSuccess(`2,000 Loyalty points redeemed for ₹1,200 Folio Credit for ${guestNameStr}!`);
    setTimeout(() => setRedeemSuccess(""), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-600/20">
            <Hotel className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              {DEFAULT_HOTEL_INFO.name}
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                GSTIN: {DEFAULT_HOTEL_INFO.gstin}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              State: {DEFAULT_HOTEL_INFO.state} (Code: {DEFAULT_HOTEL_INFO.stateCode}) • Business Date: <span className="font-mono text-amber-400 font-semibold">{currentBusinessDate}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRoomSwitchOpen(true)}
            className="border-slate-700 text-slate-300 hover:text-white"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Room Switch
          </Button>

          <Button
            variant="gold"
            size="sm"
            onClick={() => setIsCheckInOpen(true)}
            className="font-semibold shadow-amber-600/20"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Quick Check-In
          </Button>

          <div className="h-8 w-px bg-slate-800" />
          <div className="flex items-center gap-2.5 pl-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-bold text-xs text-slate-950">
              FD
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-white leading-tight">Front Desk Admin</p>
              <p className="text-[10px] text-amber-400">SuperAdmin</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-950 border-r border-slate-800/80 p-4 flex flex-col gap-1.5 shrink-0">
          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-3 py-1">
            PMS Operations
          </p>
          <button
            onClick={() => setActiveTab("tape-chart")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "tape-chart"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Calendar className="w-4 h-4" /> Room Grid / Tape Chart
          </button>
          <button
            onClick={() => setActiveTab("folios")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "folios"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Receipt className="w-4 h-4" /> Billing, Folio & Split Invoices
          </button>

          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-3 py-1 mt-4">
            Guest & CRM
          </p>
          <button
            onClick={() => setActiveTab("crm")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "crm"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Users className="w-4 h-4" /> CRM & Lead Pipeline
          </button>
          <button
            onClick={() => setActiveTab("loyalty")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "loyalty"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Award className="w-4 h-4" /> Tiered Loyalty Program
          </button>

          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-3 py-1 mt-4">
            Audit & Compliance
          </p>
          <button
            onClick={() => setActiveTab("night-audit")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "night-audit"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Moon className="w-4 h-4" /> Night Audit & Flash Report
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "reports"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> GST Tax & SAC Reports
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-6 space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-slate-950/70 border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-400">Today's Occupancy</p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-white">{occupancyPct}%</span>
                <span className="text-xs text-amber-400 font-semibold">{occupiedCount} / {totalRooms} Rooms</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${occupancyPct}%` }} />
              </div>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-400">Available / Clean</p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-400">{availableCount}</span>
                <span className="text-xs text-slate-400">Ready for guest</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">{dirtyCount} dirty • {maintenanceCount} blocked</p>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-400">Average Daily Rate (ADR)</p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-white">{formatINR(9500)}</span>
                <span className="text-xs text-emerald-400 font-medium">+12% vs LY</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Total room revenue / occupied</p>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-400">RevPAR (Indian Rupee)</p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-amber-400">{formatINR(1900)}</span>
                <span className="text-xs text-slate-400">ADR * Occupancy %</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Statutory metric</p>
            </Card>
          </div>

          {/* TAB 1: TAPE CHART / ROOM GRID */}
          {activeTab === "tape-chart" && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search room number, type or guest..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-xs rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Available">Available</option>
                    <option value="Clean">Clean</option>
                    <option value="Dirty">Dirty</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Tape Chart Status:</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs text-emerald-400 font-medium">Real-time Feed</span>
                </div>
              </div>

              {/* Matrix of Rooms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {filteredRooms.map((room) => (
                  <div
                    key={room.roomNumber}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      room.status === "Occupied"
                        ? "bg-slate-900/90 border-rose-500/40 hover:border-rose-500/70"
                        : room.status === "Dirty"
                        ? "bg-slate-900/90 border-amber-500/40 hover:border-amber-500/70"
                        : room.status === "Maintenance"
                        ? "bg-slate-900/90 border-orange-500/40 hover:border-orange-500/70"
                        : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-white">{room.roomNumber}</span>
                      <RoomStatusBadge status={room.status} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-medium">{room.roomType}</p>
                    <p className="text-[11px] text-slate-500">{room.floor}</p>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      {room.guestName ? (
                        <span className="text-rose-300 font-semibold truncate max-w-[130px]">
                          {room.guestName}
                        </span>
                      ) : (
                        <span className="text-slate-400">{formatINR(room.rate)} / night</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">
                        {room.rate > 7500 ? "18% GST" : "12% GST"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: BILLING, FOLIO & SPLIT INVOICES */}
          {activeTab === "folios" && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-400" />
                      Folio #FOL-2026-9812 • Split Billing & GST Tax Invoice
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Guest: Rajesh Mittal • Corporate: Tata Steel Ltd • GSTIN: 27AAACT2727Q1ZW • Place of Supply: 27 (Maharashtra)
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Open Folio
                  </span>
                </div>

                {/* SAC Table with Split Billing */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="p-3">SAC Code</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Split Target</th>
                        <th className="p-3">Taxable (INR)</th>
                        <th className="p-3">GST Rate</th>
                        <th className="p-3">CGST (50%)</th>
                        <th className="p-3">SGST (50%)</th>
                        <th className="p-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      <tr>
                        <td className="p-3 font-mono text-amber-400">{SAC_CODES.ROOM_ACCOMMODATION}</td>
                        <td className="p-3 font-medium">Maharaja Royal Suite (2 Nights)</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">Company (Tata Steel)</span></td>
                        <td className="p-3">{formatINR(25000)}</td>
                        <td className="p-3 font-mono">18%</td>
                        <td className="p-3 text-amber-400">{formatINR(2250)}</td>
                        <td className="p-3 text-amber-400">{formatINR(2250)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatINR(29500)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-amber-400">{SAC_CODES.RESTAURANT_DINING}</td>
                        <td className="p-3 font-medium">In-Room Royal Awadhi Dining</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">Personal Guest</span></td>
                        <td className="p-3">{formatINR(3600)}</td>
                        <td className="p-3 font-mono">5%</td>
                        <td className="p-3 text-amber-400">{formatINR(90)}</td>
                        <td className="p-3 text-amber-400">{formatINR(90)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatINR(3780)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-amber-400">{SAC_CODES.LAUNDRY_HOUSEKEEPING}</td>
                        <td className="p-3 font-medium">Express Silk Laundry Service</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">Personal Guest</span></td>
                        <td className="p-3">{formatINR(1200)}</td>
                        <td className="p-3 font-mono">18%</td>
                        <td className="p-3 text-amber-400">{formatINR(108)}</td>
                        <td className="p-3 text-amber-400">{formatINR(108)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatINR(1416)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Net Folio Balance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs text-slate-400">Total Debit (Rooms + F&B + Taxes)</p>
                    <p className="text-xl font-black text-white mt-1">{formatINR(34696)}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Company: {formatINR(29500)} • Personal: {formatINR(5196)}</p>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs text-slate-400">Total Credit (Advance + Payments)</p>
                    <p className="text-xl font-black text-emerald-400 mt-1">{formatINR(15000)}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Collected via Razorpay UPI</p>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-amber-500/30">
                    <p className="text-xs text-amber-400 font-semibold">Net Balance Due</p>
                    <p className="text-xl font-black text-amber-400 mt-1">{formatINR(19696)}</p>
                    <p className="text-[10px] text-slate-400 italic mt-1 truncate">
                      {numberToIndianWords(19696)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CRM & LEADS PIPELINE */}
          {activeTab === "crm" && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-400" />
                      Guest CRM & Inquiries Pipeline
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Convert high-value inquiries into guaranteed bookings with stay history
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-500">{lead.id}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              lead.status === "Converted"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : lead.status === "Qualified"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            }`}
                          >
                            {lead.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white">{lead.name}</h4>
                        <p className="text-xs text-slate-400">Mobile: {lead.mobile}</p>
                        <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                          {lead.requirement}
                        </p>
                      </div>

                      {lead.status !== "Converted" && (
                        <Button
                          variant="gold"
                          size="sm"
                          onClick={() => handleConvertLead(lead.id)}
                          className="w-full text-xs mt-2"
                        >
                          Convert to Confirmed Reservation
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOYALTY PROGRAM */}
          {activeTab === "loyalty" && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      Royal Heritage Loyalty Program
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Spend-based points accrual across Bronze, Silver, and Gold tiers
                    </p>
                  </div>
                </div>

                {redeemSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg">
                    {redeemSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {loyaltyAccounts.map((acc, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{acc.guest}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {acc.tier} Tier
                        </span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-amber-400">{acc.points.toLocaleString()}</span>
                        <span className="text-xs text-slate-400"> Available Points</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Lifetime Spend: {formatINR(acc.spend)}</p>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRedeemLoyalty(acc.guest)}
                        className="w-full text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                      >
                        Redeem 2,000 Points (₹1,200 Credit)
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NIGHT AUDIT & FLASH REPORT */}
          {activeTab === "night-audit" && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Moon className="w-5 h-5 text-amber-400" />
                      Night Audit & Business Date Close
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Rolls the hotel business date, posts daily room charges, and generates statutory Flash Report
                    </p>
                  </div>

                  <Button
                    variant="gold"
                    size="sm"
                    disabled={isAuditing}
                    onClick={handleRunNightAudit}
                  >
                    {isAuditing ? "Processing EOD Audit..." : `Close Business Date (${currentBusinessDate})`}
                  </Button>
                </div>

                {auditSuccess && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Night Audit completed successfully! Business date advanced. Flash Report generated below.
                  </div>
                )}

                {/* Flash Report Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <p className="text-[11px] text-slate-400">Audited Occupancy</p>
                    <p className="text-xl font-black text-white mt-1">{occupancyPct}%</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <p className="text-[11px] text-slate-400">Total Room Revenue (INR)</p>
                    <p className="text-xl font-black text-amber-400 mt-1">{formatINR(19000)}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <p className="text-[11px] text-slate-400">GST Collected (12% / 18%)</p>
                    <p className="text-xl font-black text-white mt-1">{formatINR(3030)}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <p className="text-[11px] text-slate-400">ADR (Occupied Rooms)</p>
                    <p className="text-xl font-black text-emerald-400 mt-1">{formatINR(9500)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: REPORTS & STATUTORY COMPLIANCE */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-amber-400" />
                      Statutory GST & SAC Summary Report
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Exportable tax breakdown by SAC Code compliant with Indian Ministry of Finance guidelines
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="p-3">SAC Code</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Taxable Value</th>
                        <th className="p-3">CGST Amount</th>
                        <th className="p-3">SGST Amount</th>
                        <th className="p-3">IGST Amount</th>
                        <th className="p-3 text-right">Total Tax (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      <tr>
                        <td className="p-3 font-mono text-amber-400">996311</td>
                        <td className="p-3 font-medium">Hotel Accommodation / Room Tariff</td>
                        <td className="p-3">{formatINR(37500)}</td>
                        <td className="p-3">{formatINR(2475)}</td>
                        <td className="p-3">{formatINR(2475)}</td>
                        <td className="p-3">{formatINR(1800)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatINR(6750)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-amber-400">996331</td>
                        <td className="p-3 font-medium">Restaurant & In-Room Dining (F&B)</td>
                        <td className="p-3">{formatINR(12000)}</td>
                        <td className="p-3">{formatINR(300)}</td>
                        <td className="p-3">{formatINR(300)}</td>
                        <td className="p-3">{formatINR(0)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatINR(600)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-amber-400">999799</td>
                        <td className="p-3 font-medium">Laundry, Dry Cleaning & Housekeeping</td>
                        <td className="p-3">{formatINR(4500)}</td>
                        <td className="p-3">{formatINR(405)}</td>
                        <td className="p-3">{formatINR(405)}</td>
                        <td className="p-3">{formatINR(0)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatINR(810)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Quick Check-In Modal */}
      <Modal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        title="Quick Check-In — Front Desk"
        description="Capture Indian guest details, masked Aadhaar/PAN compliance, and room allotment"
        maxWidth="lg"
      >
        {checkInSuccessMsg ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <p className="text-emerald-700 font-semibold">{checkInSuccessMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleQuickCheckIn} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Guest Full Name *"
                placeholder="e.g. Ramesh Kumar Sharma"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
              />
              <Input
                label="10-Digit Mobile Number *"
                placeholder="9876543210"
                value={guestMobile}
                onChange={(e) => setGuestMobile(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="12-Digit Aadhaar (Auto-Masked)"
                placeholder="XXXX-XXXX-XXXX"
                value={aadhaarInput}
                onChange={(e) => setAadhaarInput(e.target.value)}
                helperText="First 8 digits will be masked in compliance with UIDAI"
              />
              <Input
                label="Corporate GSTIN (Optional B2B)"
                placeholder="27AAAAA0000A1Z5"
                value={corporateGstin}
                onChange={(e) => setCorporateGstin(e.target.value)}
                helperText={
                  corporateGstin
                    ? isValidGSTIN(corporateGstin)
                      ? "✓ Valid 15-digit GSTIN"
                      : "⚠ Invalid GSTIN format"
                    : "For corporate ITC claim"
                }
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Assign Available Room *
              </label>
              <select
                value={selectedRoomNumber}
                onChange={(e) => setSelectedRoomNumber(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {rooms
                  .filter((r) => r.status === "Available" || r.status === "Clean")
                  .map((r) => (
                    <option key={r.roomNumber} value={r.roomNumber}>
                      Room {r.roomNumber} ({r.roomType}) — {formatINR(r.rate)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsCheckInOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold">
                Complete Check-In & Allot Key
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Room Switch Modal */}
      <Modal
        isOpen={isRoomSwitchOpen}
        onClose={() => setIsRoomSwitchOpen(false)}
        title="Mid-Stay Room Switch"
        description="Reallocate active guest to another room transactionally with automatic price re-calculation"
        maxWidth="md"
      >
        {switchSuccessMsg ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <p className="text-emerald-700 font-semibold">{switchSuccessMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleRoomSwitch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Occupied Room
              </label>
              <select
                value={switchFromRoom}
                onChange={(e) => setSwitchFromRoom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {rooms
                  .filter((r) => r.status === "Occupied")
                  .map((r) => (
                    <option key={r.roomNumber} value={r.roomNumber}>
                      Room {r.roomNumber} ({r.guestName})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Available Room
              </label>
              <select
                value={switchToRoom}
                onChange={(e) => setSwitchToRoom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {rooms
                  .filter((r) => r.status === "Available" || r.status === "Clean")
                  .map((r) => (
                    <option key={r.roomNumber} value={r.roomNumber}>
                      Room {r.roomNumber} ({r.roomType}) — {formatINR(r.rate)}
                    </option>
                  ))}
              </select>
            </div>

            <Input
              label="Reason for Room Switch *"
              value={switchReason}
              onChange={(e) => setSwitchReason(e.target.value)}
              placeholder="e.g. AC maintenance, guest upgrade, courtyard preference"
              required
            />

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsRoomSwitchOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold">
                Execute Room Switch
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
