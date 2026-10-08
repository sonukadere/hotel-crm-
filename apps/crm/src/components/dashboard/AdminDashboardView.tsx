import { useState, useEffect } from "react";
import {
  CreditCard,
  BedDouble,
  DollarSign,
  Users,
  ArrowRightLeft,
  Plus,
  RefreshCw,
  Building2,
  CalendarCheck,
  Receipt,
  Sparkles,
  PieChart,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { Button, Card } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type {
  AdminDashboardData,
  AdminDashboardPermission,
  UserRole,
} from "@hotel/types";
import { fetchAdminDashboardOverview } from "../../services/adminDashboardApi";
import { hasDashboardPermission } from "@hotel/utils";

interface AdminDashboardViewProps {
  currentBusinessDate: string;
  onOpenReservationModal?: () => void;
  onOpenCheckInModal?: () => void;
  onOpenCheckOutModal?: () => void;
  onOpenRoomSwitchModal?: () => void;
  onOpenAddGuestModal?: () => void;
  onOpenAddPaymentModal?: () => void;
  onOpenAddServiceModal?: () => void;
}

const AVAILABLE_ROLES: { role: UserRole; label: string; desc: string }[] = [
  { role: "SuperAdmin", label: "Super Admin", desc: "Full root access & system governance" },
  { role: "Admin", label: "Property Admin", desc: "Complete hotel operations & configurations" },
  { role: "Manager", label: "Duty Manager", desc: "Front office, discounts & overrides" },
  { role: "FrontDesk", label: "Front Desk Agent", desc: "Check-in, check-out, bookings & folios" },
  { role: "Accountant", label: "Hotel Accountant", desc: "Billing, payments & GST statutory audits" },
  { role: "Housekeeping", label: "Housekeeping Lead", desc: "Room cleaning & maintenance states only" },
];

export function AdminDashboardView({
  currentBusinessDate,
  onOpenReservationModal,
  onOpenCheckInModal,
  onOpenCheckOutModal,
  onOpenRoomSwitchModal,
  onOpenAddGuestModal,
  onOpenAddPaymentModal,
  onOpenAddServiceModal,
}: AdminDashboardViewProps) {
  const [activeRole, setActiveRole] = useState<UserRole>("Admin");
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());

  // Quick Action notification modal / banner
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [currentBusinessDate, activeRole]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDashboardOverview(undefined, currentBusinessDate, activeRole);
      setDashboardData(data);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || "Failed to load live admin dashboard data");
    } finally {
      setLoading(false);
    }
  }

  // Permission Checker
  const checkPerm = (perm: AdminDashboardPermission) => {
    return hasDashboardPermission(activeRole, perm);
  };

  const handleRestrictedAction = (permName: string) => {
    setActionNotice(
      `Access Denied: The role '${activeRole}' does not hold the '${permName}' permission. Switch to FrontDesk, Manager, or Admin to execute this action.`,
    );
    setTimeout(() => setActionNotice(null), 5000);
  };

  const cards = dashboardData?.cards;
  const sections = dashboardData?.sections;

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & RBAC ROLE SWITCHER */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  Hotel PMS Executive Command Center
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live Database Connected
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Business Date: <strong className="text-amber-400 font-mono">{currentBusinessDate}</strong> | Last updated: {lastRefreshedAt}
                </p>
              </div>
            </div>
          </div>

          {/* Right: RBAC Role Selector & Live Refresh */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-400" /> Role:
              </span>
              <select
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as UserRole)}
                className="bg-slate-950 text-amber-300 font-semibold text-xs border border-slate-700 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              >
                {AVAILABLE_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboard}
              className="text-xs border-slate-800 text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className="mt-3.5 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-3.5 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 2. QUICK ACTIONS BAR WITH RBAC PERMISSIONS */}
        <div className="mt-4 pt-3 border-t border-slate-800/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Front Office Quick Actions
            </span>
            <span className="text-[10px] text-slate-500">
              Gated by active role: <strong className="text-slate-300">{activeRole}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {/* 1. New Reservation */}
            <Button
              size="sm"
              onClick={checkPerm("reservation:create") ? onOpenReservationModal : () => handleRestrictedAction("reservation:create")}
              className={`text-xs h-9 font-semibold justify-center ${
                checkPerm("reservation:create")
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                  : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60"
              }`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Booking
            </Button>

            {/* 2. Quick Check-In */}
            <Button
              size="sm"
              onClick={checkPerm("reservation:checkin") ? onOpenCheckInModal : () => handleRestrictedAction("reservation:checkin")}
              className={`text-xs h-9 font-semibold justify-center ${
                checkPerm("reservation:checkin")
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Check-in
            </Button>

            {/* 3. Check-Out */}
            <Button
              size="sm"
              onClick={checkPerm("reservation:checkout") ? onOpenCheckOutModal : () => handleRestrictedAction("reservation:checkout")}
              className={`text-xs h-9 font-semibold justify-center ${
                checkPerm("reservation:checkout")
                  ? "bg-sky-600 hover:bg-sky-500 text-white"
                  : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60"
              }`}
            >
              <LogOut className="w-3.5 h-3.5 mr-1" /> Check-out
            </Button>

            {/* 4. Add Guest */}
            <Button
              size="sm"
              variant="outline"
              onClick={checkPerm("guest:create") ? onOpenAddGuestModal : () => handleRestrictedAction("guest:create")}
              className={`text-xs h-9 font-semibold justify-center ${
                checkPerm("guest:create")
                  ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                  : "border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
              }`}
            >
              <Users className="w-3.5 h-3.5 mr-1" /> Add Guest
            </Button>

            {/* 5. Add Payment */}
            <Button
              size="sm"
              variant="outline"
              onClick={checkPerm("payment:create") ? onOpenAddPaymentModal : () => handleRestrictedAction("payment:create")}
              className={`text-xs h-9 font-semibold justify-center ${
                checkPerm("payment:create")
                  ? "border-emerald-600/40 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" /> Add Payment
            </Button>

            {/* 6. Add Service */}
            <Button
              size="sm"
              variant="outline"
              onClick={checkPerm("service:create") ? onOpenAddServiceModal : () => handleRestrictedAction("service:create")}
              className={`text-xs h-9 font-semibold justify-center ${
                checkPerm("service:create")
                  ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                  : "border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
              }`}
            >
              <Receipt className="w-3.5 h-3.5 mr-1" /> Add Service
            </Button>

            {/* 7. Room Switch */}
            <Button
              size="sm"
              variant="outline"
              onClick={checkPerm("reservation:room-switch") ? onOpenRoomSwitchModal : () => handleRestrictedAction("reservation:room-switch")}
              className={`text-xs h-9 font-semibold justify-center ${
                checkPerm("reservation:room-switch")
                  ? "border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                  : "border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Room Switch
            </Button>
          </div>
        </div>
      </div>

      {/* 3. 10 LIVE DASHBOARD CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Today's Occupancy */}
        <Card className="bg-slate-950/80 border-slate-800 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Today's Occupancy</span>
            <span className="text-[10px] font-mono text-amber-400">
              {cards?.occupiedRooms ?? 0} / {cards?.totalAvailableRooms ?? 1}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{cards?.occupancyRate ?? 0}%</span>
            <span className="text-[10px] text-slate-500">Sellable</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${cards?.occupancyRate ?? 0}%` }}
            />
          </div>
        </Card>

        {/* Card 2: Today's Revenue */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Today's Revenue</span>
            <span className="text-[10px] font-mono text-emerald-400">INR</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">
            {formatINR(cards?.todayRevenue ?? 0)}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Room + Service Revenue</p>
        </Card>

        {/* Card 3: ADR */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">ADR (Average Rate)</span>
            <span className="text-[10px] font-mono text-slate-500">RoomRev/Occ</span>
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {formatINR(cards?.adr ?? 0)}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Per occupied room</p>
        </Card>

        {/* Card 4: RevPAR */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">RevPAR</span>
            <span className="text-[10px] font-mono text-amber-400">RoomRev/Avail</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400 font-mono">
            {formatINR(cards?.revPar ?? 0)}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Yield performance benchmark</p>
        </Card>

        {/* Card 5: Check-ins */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Check-ins</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {cards?.checkInsToday ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Arrivals today</p>
        </Card>

        {/* Card 6: Check-outs */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Check-outs</span>
            <LogOut className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {cards?.checkOutsToday ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Departures scheduled</p>
        </Card>

        {/* Card 7: Available Rooms */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Available Rooms</span>
            <BedDouble className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">
            {cards?.availableRooms ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Clean & ready for sale</p>
        </Card>

        {/* Card 8: Dirty Rooms */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Dirty Rooms</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-400">
            {cards?.dirtyRooms ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Awaiting housekeeping</p>
        </Card>

        {/* Card 9: Maintenance Rooms */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Maintenance</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400">
            {cards?.maintenanceRooms ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Blocked / Out of service</p>
        </Card>

        {/* Card 10: Pending Payments */}
        <Card className="bg-slate-950/80 border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Pending Payments</span>
            <Receipt className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-400 font-mono">
            {formatINR(cards?.pendingPayments ?? 0)}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Open Folio balances due</p>
        </Card>
      </div>

      {/* 4. SECTION 1: ROOM STATUS OVERVIEW & BREAKDOWN */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-amber-400" /> Section 1: Room Status Breakdown ({sections?.roomStatus.total ?? 0} Total Rooms)
          </h3>
          <span className="text-xs text-slate-400 font-mono">Real-time Housekeeping & Allocation</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-slate-900 border border-emerald-500/20 p-3 rounded-xl">
            <span className="text-[11px] text-emerald-400 font-semibold block">Available</span>
            <span className="text-2xl font-black text-white mt-1 block">{sections?.roomStatus.available ?? 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Ready for guests</span>
          </div>

          <div className="bg-slate-900 border border-blue-500/20 p-3 rounded-xl">
            <span className="text-[11px] text-blue-400 font-semibold block">Occupied</span>
            <span className="text-2xl font-black text-white mt-1 block">{sections?.roomStatus.occupied ?? 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">In-house guests</span>
          </div>

          <div className="bg-slate-900 border border-teal-500/20 p-3 rounded-xl">
            <span className="text-[11px] text-teal-400 font-semibold block">Clean</span>
            <span className="text-2xl font-black text-white mt-1 block">{sections?.roomStatus.clean ?? 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Inspected & cleared</span>
          </div>

          <div className="bg-slate-900 border border-rose-500/20 p-3 rounded-xl">
            <span className="text-[11px] text-rose-400 font-semibold block">Dirty</span>
            <span className="text-2xl font-black text-rose-400 mt-1 block">{sections?.roomStatus.dirty ?? 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Needs turnover</span>
          </div>

          <div className="bg-slate-900 border border-amber-500/20 p-3 rounded-xl">
            <span className="text-[11px] text-amber-400 font-semibold block">Blocked</span>
            <span className="text-2xl font-black text-white mt-1 block">{sections?.roomStatus.blocked ?? 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">VIP reserved</span>
          </div>

          <div className="bg-slate-900 border border-red-500/20 p-3 rounded-xl">
            <span className="text-[11px] text-red-400 font-semibold block">Maintenance</span>
            <span className="text-2xl font-black text-red-400 mt-1 block">{sections?.roomStatus.maintenance ?? 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Out of order</span>
          </div>
        </div>
      </div>

      {/* 5. DUAL SECTIONS: SECTION 2 (ARRIVALS) & SECTION 3 (DEPARTURES) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 2: TODAY'S ARRIVALS */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-400" /> Section 2: Today's Arrivals ({sections?.todayArrivals.length ?? 0})
            </h3>
            <span className="text-xs text-emerald-400 font-mono">Date: {currentBusinessDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2.5">Guest / Booking</th>
                  <th className="py-2 px-2.5">Room</th>
                  <th className="py-2 px-2.5">Payment</th>
                  <th className="py-2 px-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sections?.todayArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No pending arrivals scheduled for today.
                    </td>
                  </tr>
                ) : (
                  sections?.todayArrivals.map((arr) => (
                    <tr key={arr.bookingId} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-white">{arr.guestName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{arr.bookingNumber}</div>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className="font-semibold text-amber-400">{arr.roomNumber ? `Room ${arr.roomNumber}` : "Unassigned"}</span>
                        <div className="text-[10px] text-slate-400">{arr.roomType}</div>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <div className="font-mono text-emerald-400">Paid: {formatINR(arr.paidAmount)}</div>
                        <div className="text-[10px] text-slate-400">Bal: {formatINR(arr.balanceDue)}</div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        {checkPerm("reservation:checkin") ? (
                          <Button
                            size="sm"
                            onClick={onOpenCheckInModal}
                            className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                          >
                            Check-in
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Restricted</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: TODAY'S DEPARTURES */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <LogOut className="w-4 h-4 text-sky-400" /> Section 3: Today's Departures ({sections?.todayDepartures.length ?? 0})
            </h3>
            <span className="text-xs text-sky-400 font-mono">Date: {currentBusinessDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2.5">Guest / Booking</th>
                  <th className="py-2 px-2.5">Room</th>
                  <th className="py-2 px-2.5">Folio Balance</th>
                  <th className="py-2 px-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sections?.todayDepartures.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No departures scheduled for today.
                    </td>
                  </tr>
                ) : (
                  sections?.todayDepartures.map((dep) => (
                    <tr key={dep.bookingId} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-white">{dep.guestName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{dep.bookingNumber}</div>
                      </td>
                      <td className="py-2.5 px-2.5 font-semibold text-amber-400">
                        Room {dep.roomNumber}
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className={`font-mono font-bold ${dep.balanceDue > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {dep.balanceDue > 0 ? `${formatINR(dep.balanceDue)} due` : "Settled ₹0"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        {checkPerm("reservation:checkout") ? (
                          <Button
                            size="sm"
                            onClick={onOpenCheckOutModal}
                            className="h-7 text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                          >
                            Check-out
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Restricted</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. DUAL SECTIONS: SECTION 4 (CURRENT GUESTS) & SECTION 5 (OUTSTANDING FOLIOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 4: CURRENT IN-HOUSE GUESTS */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> Section 4: Current In-House Guests ({sections?.currentGuests.length ?? 0})
            </h3>
            <span className="text-xs text-amber-400 font-mono">Active Rooms</span>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2 px-2.5">Room / Tier</th>
                  <th className="py-2 px-2.5">Guest / Mobile</th>
                  <th className="py-2 px-2.5">Stay Dates</th>
                  <th className="py-2 px-2.5 text-right">Folio Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sections?.currentGuests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No guests currently in-house.
                    </td>
                  </tr>
                ) : (
                  sections?.currentGuests.map((g) => (
                    <tr key={g.bookingId} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-amber-400">Room {g.roomNumber}</div>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {g.loyaltyTier || "Bronze"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-white">{g.guestName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{g.mobile}</div>
                      </td>
                      <td className="py-2.5 px-2.5 text-[11px] text-slate-300 font-mono">
                        {g.checkInDate} → {g.checkOutDate}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold">
                        <span className={g.balanceDue > 0 ? "text-rose-400" : "text-emerald-400"}>
                          {formatINR(g.balanceDue)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 5: OUTSTANDING FOLIOS */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-400" /> Section 5: Outstanding Folios ({sections?.outstandingFolios.length ?? 0})
            </h3>
            <span className="text-xs text-rose-400 font-mono font-bold">
              Total: {formatINR(cards?.pendingPayments ?? 0)}
            </span>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2 px-2.5">Folio #</th>
                  <th className="py-2 px-2.5">Guest / Room</th>
                  <th className="py-2 px-2.5">Charges / Paid</th>
                  <th className="py-2 px-2.5 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sections?.outstandingFolios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Zero outstanding open folios. All folios settled!
                    </td>
                  </tr>
                ) : (
                  sections?.outstandingFolios.map((f) => (
                    <tr key={f.folioId} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-2.5 font-mono text-amber-400 font-semibold">
                        {f.folioNumber}
                      </td>
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-white">{f.guestName}</div>
                        <div className="text-[10px] text-slate-400">{f.roomNumber ? `Room ${f.roomNumber}` : "Non-room"}</div>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-300">
                        Debit: {formatINR(f.totalDebit)} | Cr: {formatINR(f.totalCredit)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-rose-400">
                        {formatINR(f.balanceDue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. DUAL SECTIONS: SECTION 6 (RECENT PAYMENTS) & SECTION 7 (BOOKING SOURCES) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 6: RECENT PAYMENTS */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" /> Section 6: Recent Payments Reconciled ({sections?.recentPayments.length ?? 0})
            </h3>
            <span className="text-xs text-slate-400 font-mono">Tender Audit</span>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2 px-2.5">Folio / Guest</th>
                  <th className="py-2 px-2.5">Method</th>
                  <th className="py-2 px-2.5">Amount</th>
                  <th className="py-2 px-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sections?.recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No payments captured yet today.
                    </td>
                  </tr>
                ) : (
                  sections?.recentPayments.map((p) => (
                    <tr key={p.paymentId} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-white">{p.guestName || "Guest"}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.folioNumber}</div>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300">
                          {p.method}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono font-bold text-emerald-400">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === "Captured"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 7: BOOKING SOURCES */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-400" /> Section 7: Booking Sources & Channels
            </h3>
            <span className="text-xs text-purple-400 font-mono">Channel Mix</span>
          </div>

          <div className="space-y-3 pt-1">
            {sections?.bookingSources.map((bs) => (
              <div key={bs.source} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{bs.source}</span>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-400">{bs.count} bookings</span>
                    <span className="text-amber-400 font-bold">{formatINR(bs.revenue)}</span>
                    <span className="text-slate-500">({bs.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${bs.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8. SECTION 8: REVENUE SUMMARY & TAX STATUTORY BREAKDOWN */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Section 8: Statutory Revenue Summary & Tax Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Indian Hospitality Ministry of Finance GST compliance (SAC 996311 & SAC 996331)
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-xs text-slate-400 block">Total Billed Revenue</span>
            <span className="text-xl font-black text-emerald-400">
              {formatINR(sections?.revenueSummary.totalBilled ?? 0)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase block font-mono">Room Revenue</span>
            <span className="text-base font-bold text-white font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.roomRevenue ?? 0)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase block font-mono">Service Revenue</span>
            <span className="text-base font-bold text-white font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.serviceRevenue ?? 0)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase block font-mono">Net Revenue</span>
            <span className="text-base font-bold text-emerald-400 font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.netRevenue ?? 0)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase block font-mono">CGST (6% / 9%)</span>
            <span className="text-base font-bold text-sky-400 font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.cgst ?? 0)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase block font-mono">SGST (6% / 9%)</span>
            <span className="text-base font-bold text-sky-400 font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.sgst ?? 0)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase block font-mono">IGST (12% / 18%)</span>
            <span className="text-base font-bold text-slate-400 font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.igst ?? 0)}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase block font-mono">Total GST</span>
            <span className="text-base font-bold text-amber-400 font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.totalTax ?? 0)}
            </span>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl">
            <span className="text-[10px] text-emerald-400 uppercase block font-mono font-bold">Total Gross</span>
            <span className="text-base font-bold text-emerald-300 font-mono mt-1 block">
              {formatINR(sections?.revenueSummary.totalBilled ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
