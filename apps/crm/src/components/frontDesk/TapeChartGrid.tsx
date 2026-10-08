import { useState, useEffect } from "react";
import { Button, RoomStatusBadge } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type {
  Room,
  RoomType,
  Floor,
  RoomStatus,
  TapeChartResponse,
} from "@hotel/types";
import { fetchTapeChartApi } from "../../services/frontDeskApi";
import {
  Calendar,
  Search,
  Plus,
  ArrowRightLeft,
  LogOut,
  LogIn,
  CheckCircle2,
  Sparkles,
  User,
  RefreshCw,
  LayoutGrid,
  CalendarRange,
} from "lucide-react";

interface TapeChartGridProps {
  rooms: Room[];
  roomTypes: RoomType[];
  floors: Floor[];
  onOpenQuickCheckIn: (roomNumber?: string) => void;
  onOpenCreateReservation: (roomId?: string) => void;
  onOpenCheckOut: (bookingId: string) => void;
  onOpenRoomSwitch: (stay: {
    id: string;
    bookingNumber: string;
    guestName: string;
    currentRoomId?: string;
    currentRoomNumber?: string;
    currentRoomType?: string;
    currentBaseRate?: number;
    checkOutDate?: string;
  }) => void;
  onStatusChange: (roomId: string, newStatus: RoomStatus) => void;
}

export function TapeChartGrid({
  rooms,
  roomTypes,
  floors,
  onOpenQuickCheckIn,
  onOpenCreateReservation,
  onOpenCheckOut,
  onOpenRoomSwitch,
  onStatusChange,
}: TapeChartGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "tape">("grid");
  const [tapeData, setTapeData] = useState<TapeChartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [floorFilter, setFloorFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  useEffect(() => {
    loadTapeChart();
  }, [rooms]);

  const loadTapeChart = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTapeChartApi({ days: 10 });
      if (data) {
        setTapeData(data);
      }
    } catch (_err) {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  // Harmonized room list combining DB Room inventory and TapeChart API stays
  const displayRooms = rooms.map((room) => {
    const tapeRoom = tapeData?.rooms.find((tr) => tr.roomNumber === room.roomNumber || tr.id === room.id);
    const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
    const floor = floors.find((f) => f.id === room.floorId);

    // Active stay information
    const currentStay = tapeRoom?.currentStay || tapeRoom?.stays.find((s) => s.isInHouse || s.isArrival);

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      roomTypeName: roomType?.name || tapeRoom?.roomTypeName || "Standard",
      floorId: room.floorId,
      floorNumber: floor?.floorNumber ?? tapeRoom?.floorNumber ?? 1,
      status: room.status,
      isActive: room.isActive,
      baseRate: Number(room.baseRate) || roomType?.basePrice || 4200,
      currentStay,
      allStays: tapeRoom?.stays || [],
    };
  });

  // Filtered rooms
  const filteredRooms = displayRooms.filter((r) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNumber = r.roomNumber.toLowerCase().includes(q);
      const matchType = r.roomTypeName.toLowerCase().includes(q);
      const matchGuest = r.currentStay?.guest.fullName.toLowerCase().includes(q);
      const matchBooking = r.currentStay?.bookingNumber.toLowerCase().includes(q);
      if (!matchNumber && !matchType && !matchGuest && !matchBooking) return false;
    }

    // Status filter
    if (statusFilter !== "ALL" && r.status !== statusFilter) {
      return false;
    }

    // Floor filter
    if (floorFilter !== "ALL" && String(r.floorNumber) !== floorFilter) {
      return false;
    }

    // Room Type filter
    if (typeFilter !== "ALL" && r.roomTypeId !== typeFilter) {
      return false;
    }

    return true;
  });

  // KPI counts
  const totalCount = rooms.length;
  const occupiedCount = rooms.filter((r) => r.status === "Occupied").length;
  const availableCount = rooms.filter((r) => r.status === "Available").length;
  const cleanCount = rooms.filter((r) => r.status === "Clean").length;
  const dirtyCount = rooms.filter((r) => r.status === "Dirty").length;
  const blockedCount = rooms.filter((r) => r.status === "Blocked").length;
  const maintenanceCount = rooms.filter((r) => r.status === "Maintenance").length;
  const occupancyPct = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950/70 border border-slate-800 rounded-xl p-5">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-amber-400" />
            Front Desk Room Tape Chart & PMS Grid
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time room occupancy states, guest stays, rapid check-in allotment, and mid-stay room relocations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex items-center">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === "grid"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Room Grid
            </button>
            <button
              onClick={() => setViewMode("tape")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === "tape"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Tape Timeline
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadTapeChart}
            disabled={isLoading}
            className="text-xs border-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenCreateReservation()}
            className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> New Reservation
          </Button>

          <Button
            variant="gold"
            size="sm"
            onClick={() => onOpenQuickCheckIn()}
            className="text-xs font-bold"
          >
            <LogIn className="w-3.5 h-3.5 mr-1.5" /> Quick Check-In
          </Button>
        </div>
      </div>

      {/* Real-Time Room State Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "ALL"
              ? "bg-slate-800/80 border-amber-500 shadow-md shadow-amber-500/10"
              : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total</span>
            <span className="text-xs text-amber-400 font-bold">{occupancyPct}% Occ</span>
          </div>
          <p className="text-2xl font-black text-white mt-1">{totalCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("Available")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "Available"
              ? "bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10"
              : "bg-slate-950/70 border-slate-800 hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase">Available</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-1">{availableCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("Clean")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "Clean"
              ? "bg-teal-950/40 border-teal-500 shadow-md shadow-teal-500/10"
              : "bg-slate-950/70 border-slate-800 hover:border-teal-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-400 uppercase">Clean</span>
            <span className="h-2 w-2 rounded-full bg-teal-500" />
          </div>
          <p className="text-2xl font-black text-teal-400 mt-1">{cleanCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("Occupied")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "Occupied"
              ? "bg-rose-950/40 border-rose-500 shadow-md shadow-rose-500/10"
              : "bg-slate-950/70 border-slate-800 hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-400 uppercase">Occupied</span>
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-400 mt-1">{occupiedCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("Dirty")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "Dirty"
              ? "bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/10"
              : "bg-slate-950/70 border-slate-800 hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase">Dirty</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-400 mt-1">{dirtyCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("Blocked")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "Blocked"
              ? "bg-slate-800 border-slate-500 shadow-md"
              : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Blocked</span>
            <span className="h-2 w-2 rounded-full bg-slate-500" />
          </div>
          <p className="text-2xl font-black text-slate-300 mt-1">{blockedCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter("Maintenance")}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === "Maintenance"
              ? "bg-orange-950/40 border-orange-500 shadow-md shadow-orange-500/10"
              : "bg-slate-950/70 border-slate-800 hover:border-orange-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-orange-400 uppercase">Maint.</span>
            <span className="h-2 w-2 rounded-full bg-orange-500" />
          </div>
          <p className="text-2xl font-black text-orange-400 mt-1">{maintenanceCount}</p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search room number, type, guest, or reservation #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All States</option>
            <option value="Clean">Clean</option>
            <option value="Dirty">Dirty</option>
            <option value="Occupied">Occupied</option>
            <option value="Blocked">Blocked</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Available">Available</option>
          </select>

          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Floors</option>
            {floors.map((f) => (
              <option key={f.id} value={String(f.floorNumber)}>
                Floor {f.floorNumber}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Room Types</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Showing <strong className="text-white">{filteredRooms.length}</strong> of {rooms.length} rooms</span>
        </div>
      </div>

      {/* VIEW MODE 1: INTERACTIVE ROOM GRID */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const stay = room.currentStay;
            const isOccupied = room.status === "Occupied";
            const isClean = room.status === "Clean";
            const isDirty = room.status === "Dirty";
            const isAvailable = room.status === "Available";
            const isMaintenance = room.status === "Maintenance";
            const isBlocked = room.status === "Blocked";

            return (
              <div
                key={room.id}
                className={`bg-slate-950/80 border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-lg ${
                  isOccupied
                    ? "border-rose-500/40 hover:border-rose-500/70"
                    : isDirty
                    ? "border-amber-500/40 hover:border-amber-500/70"
                    : isMaintenance
                    ? "border-orange-500/40 hover:border-orange-500/70"
                    : isBlocked
                    ? "border-slate-700 hover:border-slate-600"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  {/* Card Header: Room Number, Floor & Status Badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white">
                          {room.roomNumber}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Floor {room.floorNumber}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">
                        {room.roomTypeName}
                      </p>
                    </div>

                    <RoomStatusBadge status={room.status} />
                  </div>

                  {/* Stay / Guest Information or Room Rate Details */}
                  {stay ? (
                    <div className="mt-3.5 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-bold text-white truncate">
                            {stay.guest.fullName}
                          </span>
                        </div>
                        {/* Payment Status Badge */}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            stay.paymentStatus === "Paid"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : stay.paymentStatus === "Partially Paid"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {stay.paymentStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Reservation:</span>
                        <span className="text-amber-400 font-mono font-semibold">
                          #{stay.bookingNumber}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Check-In:</span>
                        <span className="text-slate-300 font-mono">{stay.checkInDate}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Check-Out:</span>
                        <span className="text-slate-300 font-mono">{stay.checkOutDate}</span>
                      </div>

                      {stay.balanceAmount > 0 && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                          <span className="text-rose-400">Balance Due:</span>
                          <span className="text-rose-400 font-bold font-mono">
                            {formatINR(stay.balanceAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3.5 p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Standard Tariff:</span>
                        <span className="text-white font-bold">{formatINR(room.baseRate)} / night</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>GST Slab:</span>
                        <span className="font-mono text-slate-400">
                          {room.baseRate > 7500 ? "18% GST (SAC 996311)" : "12% GST (SAC 996311)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Status:</span>
                        <span className="text-slate-300">
                          {isClean ? "Clean & Ready for check-in" : isDirty ? "Needs Housekeeping" : room.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                  {isOccupied && stay ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onOpenRoomSwitch({
                            id: stay.bookingId,
                            bookingNumber: stay.bookingNumber,
                            guestName: stay.guest.fullName,
                            currentRoomId: room.id,
                            currentRoomNumber: room.roomNumber,
                            currentRoomType: room.roomTypeName,
                            currentBaseRate: room.baseRate,
                            checkOutDate: stay.checkOutDate,
                          })
                        }
                        className="text-[11px] px-2.5 py-1 h-7 border-slate-700 text-slate-300 hover:text-white"
                      >
                        <ArrowRightLeft className="w-3 h-3 mr-1 text-amber-400" /> Switch
                      </Button>

                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => onOpenCheckOut(stay.bookingId)}
                        className="text-[11px] px-2.5 py-1 h-7 font-bold"
                      >
                        <LogOut className="w-3 h-3 mr-1" /> Check-Out
                      </Button>
                    </>
                  ) : isAvailable || isClean ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenCreateReservation(room.id)}
                        className="text-[11px] px-2 py-1 h-7 border-slate-700 text-slate-300 hover:text-white"
                      >
                        Reserve
                      </Button>
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => onOpenQuickCheckIn(room.roomNumber)}
                        className="text-[11px] px-2.5 py-1 h-7 font-semibold"
                      >
                        <LogIn className="w-3 h-3 mr-1" /> Check-In
                      </Button>
                    </>
                  ) : isDirty ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStatusChange(room.id, "Clean")}
                      className="w-full text-[11px] h-7 border-teal-500/40 text-teal-400 hover:bg-teal-500/10 font-semibold"
                    >
                      <Sparkles className="w-3 h-3 mr-1" /> Mark as Clean
                    </Button>
                  ) : isMaintenance ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStatusChange(room.id, "Clean")}
                      className="w-full text-[11px] h-7 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Release to Clean
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStatusChange(room.id, "Available")}
                      className="w-full text-[11px] h-7 border-slate-700 text-slate-300 hover:text-white"
                    >
                      Unblock Room
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: TAPE TIMELINE CHART */}
      {viewMode === "tape" && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  <th className="p-3 text-left text-slate-400 font-bold uppercase w-48 sticky left-0 bg-slate-900 z-10">
                    Room / Type
                  </th>
                  {tapeData?.days.map((day) => (
                    <th
                      key={day.date}
                      className={`p-2.5 text-center min-w-[90px] border-l border-slate-800/80 ${
                        day.isToday
                          ? "bg-amber-500/10 text-amber-400 font-bold"
                          : day.isWeekend
                          ? "bg-slate-900/60 text-slate-300"
                          : "text-slate-400"
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold tracking-wider">
                        {day.dayOfWeek}
                      </div>
                      <div className="text-sm font-black mt-0.5">{day.dayOfMonth}</div>
                      {day.isToday && (
                        <span className="inline-block mt-0.5 px-1 py-0.2 rounded text-[9px] bg-amber-500 text-slate-950 font-bold">
                          Today
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-900/40">
                    {/* Fixed Room Col */}
                    <td className="p-3 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">
                          Room {room.roomNumber}
                        </span>
                        <RoomStatusBadge status={room.status} />
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {room.roomTypeName}
                      </p>
                    </td>

                    {/* Timeline Days */}
                    {tapeData?.days.map((day) => {
                      // Check if room has stay on this date
                      const matchStay = room.allStays.find(
                        (s) => day.date >= s.checkInDate && day.date < s.checkOutDate
                      );

                      return (
                        <td
                          key={day.date}
                          className={`p-1.5 text-center border-l border-slate-800/60 align-middle ${
                            day.isToday ? "bg-amber-500/5" : ""
                          }`}
                        >
                          {matchStay ? (
                            <div
                              onClick={() => {
                                if (matchStay.isInHouse) {
                                  onOpenCheckOut(matchStay.bookingId);
                                }
                              }}
                              className={`p-1.5 rounded-md text-[10px] font-semibold truncate cursor-pointer transition-transform hover:scale-105 ${
                                matchStay.isInHouse
                                  ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                                  : "bg-blue-500/20 border border-blue-500/40 text-blue-300"
                              }`}
                              title={`${matchStay.guest.fullName} (#${matchStay.bookingNumber}) • ${matchStay.checkInDate} to ${matchStay.checkOutDate}`}
                            >
                              <p className="truncate font-bold">{matchStay.guest.fullName}</p>
                              <p className="text-[9px] opacity-75 truncate">#{matchStay.bookingNumber}</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => onOpenQuickCheckIn(room.roomNumber)}
                              className="w-full h-8 rounded hover:bg-slate-800/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              title={`Book Room ${room.roomNumber} on ${day.date}`}
                            >
                              <Plus className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
