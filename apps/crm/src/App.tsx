import { useState, useEffect } from "react";
import { getAccessToken, UNAUTHORIZED_EVENT, LOGGED_IN_EVENT } from "./services/http";
import { LoginScreen } from "./components/auth/LoginScreen";
import { logout } from "./services/authApi";
import {
  Hotel,
  Calendar,
  Receipt,
  Users,
  Award,
  Moon,
  BarChart3,
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  BedDouble,
  LayoutDashboard,
} from "lucide-react";
import { Button, Card } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import { DEFAULT_HOTEL_INFO } from "@hotel/config";
import type { RoomStatus, Room, RoomType, RatePlan, Floor, BedType } from "@hotel/types";
import { AdminDashboardView } from "./components/dashboard/AdminDashboardView";
import { RoomInventoryView } from "./components/rooms/RoomInventoryView";
import { NightAuditConsole } from "./components/nightAudit/NightAuditConsole";
import { TapeChartGrid } from "./components/frontDesk/TapeChartGrid";
import { QuickCheckInModal } from "./components/frontDesk/QuickCheckInModal";
import { CreateReservationModal } from "./components/frontDesk/CreateReservationModal";
import { CheckOutModal } from "./components/frontDesk/CheckOutModal";
import { RoomSwitchModal, type ActiveBookingInfo } from "./components/frontDesk/RoomSwitchModal";
import { CRMDashboard } from "./components/crm/CRMDashboard";
import { FolioManager } from "./components/folio/FolioManager";
import { LoyaltyProgramDashboard } from "./components/loyalty/LoyaltyProgramDashboard";
import { HotelReportsCenter } from "./components/reports/HotelReportsCenter";
import {
  fetchRoomsApi,
  fetchRoomTypesApi,
  fetchRatePlansApi,
  fetchFloorsApi,
  fetchBedTypesApi,
  createRoomApi,
  updateRoomApi,
  deleteRoomApi,
  updateRoomStatusApi,
  bulkUpdateRoomStatusApi,
  createRoomTypeApi,
  updateRoomTypeApi,
  createRatePlanApi,
  updateRatePlanApi,
  createFloorApi,
  createBedTypeApi,
  INITIAL_ROOMS_DATA,
  INITIAL_ROOM_TYPES,
  INITIAL_RATE_PLANS,
  INITIAL_FLOORS,
  INITIAL_BED_TYPES,
} from "./services/roomApi";

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

function PMSDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<"admin-dashboard" | "rooms-inventory" | "tape-chart" | "folios" | "crm" | "loyalty" | "night-audit" | "reports">("admin-dashboard");
  const [rooms, setRooms] = useState(INITIAL_ROOMS);

  // Room Catalog & Inventory Real DB State
  const [inventoryRooms, setInventoryRooms] = useState<Room[]>(INITIAL_ROOMS_DATA);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(INITIAL_ROOM_TYPES);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>(INITIAL_RATE_PLANS);
  const [floors, setFloors] = useState<Floor[]>(INITIAL_FLOORS);
  const [bedTypes, setBedTypes] = useState<BedType[]>(INITIAL_BED_TYPES);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

  // Fetch real data on mount
  useEffect(() => {
    loadAllInventoryData();
  }, []);

  const loadAllInventoryData = async () => {
    setIsInventoryLoading(true);
    try {
      const [fetchedRooms, fetchedTypes, fetchedPlans, fetchedFloors, fetchedBeds] = await Promise.all([
        fetchRoomsApi(),
        fetchRoomTypesApi(),
        fetchRatePlansApi(),
        fetchFloorsApi(),
        fetchBedTypesApi(),
      ]);
      setInventoryRooms(fetchedRooms);
      setRoomTypes(fetchedTypes);
      setRatePlans(fetchedPlans);
      setFloors(fetchedFloors);
      setBedTypes(fetchedBeds);

      // Keep tape-chart rooms in sync with inventory
      setRooms(
        fetchedRooms.map((r) => {
          const type = fetchedTypes.find((t) => t.id === r.roomTypeId);
          const floor = fetchedFloors.find((f) => f.id === r.floorId);
          return {
            roomNumber: r.roomNumber,
            roomType: type?.name || "Standard",
            floor: floor ? `Floor ${floor.floorNumber}` : "Floor 1",
            status: r.status,
            rate: r.baseRate || type?.basePrice || 4200,
          };
        }),
      );
    } catch (_err) {
      // Keep initial fallback
    } finally {
      setIsInventoryLoading(false);
    }
  };

  // CRUD Handlers for Room Catalog & Inventory Module
  const handleAddRoom = async (roomData: Partial<Room>) => {
    const created = await createRoomApi(roomData);
    setInventoryRooms((prev) => [...prev, created]);
    const type = roomTypes.find((t) => t.id === created.roomTypeId);
    const floor = floors.find((f) => f.id === created.floorId);
    setRooms((prev) => [
      ...prev,
      {
        roomNumber: created.roomNumber,
        roomType: type?.name || "Standard",
        floor: floor ? `Floor ${floor.floorNumber}` : "Floor 1",
        status: created.status,
        rate: created.baseRate || type?.basePrice || 4200,
      },
    ]);
  };

  const handleUpdateRoom = async (id: string, updates: Partial<Room>) => {
    const updated = await updateRoomApi(id, updates);
    setInventoryRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated, ...updates } : r)));
    if (updates.status || updates.roomNumber || updates.baseRate) {
      setRooms((prev) =>
        prev.map((r) => {
          const matched = inventoryRooms.find((ir) => ir.id === id);
          if (matched && r.roomNumber === matched.roomNumber) {
            return {
              ...r,
              roomNumber: updates.roomNumber || r.roomNumber,
              status: updates.status || r.status,
              rate: updates.baseRate || r.rate,
            };
          }
          return r;
        }),
      );
    }
  };

  const handleDeleteRoom = async (id: string) => {
    await deleteRoomApi(id);
    setInventoryRooms((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: false } : r)));
  };

  const handleStatusChange = async (roomId: string, newStatus: RoomStatus) => {
    await updateRoomStatusApi(roomId, newStatus);
    setInventoryRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r)));
    const targetRoom = inventoryRooms.find((r) => r.id === roomId);
    if (targetRoom) {
      setRooms((prev) =>
        prev.map((r) => (r.roomNumber === targetRoom.roomNumber ? { ...r, status: newStatus } : r)),
      );
    }
  };

  const handleBulkStatusChange = async (roomIds: string[], newStatus: RoomStatus) => {
    await bulkUpdateRoomStatusApi(roomIds, newStatus);
    setInventoryRooms((prev) =>
      prev.map((r) => (roomIds.includes(r.id) ? { ...r, status: newStatus } : r)),
    );
    const affectedNumbers = inventoryRooms
      .filter((r) => roomIds.includes(r.id))
      .map((r) => r.roomNumber);
    setRooms((prev) =>
      prev.map((r) => (affectedNumbers.includes(r.roomNumber) ? { ...r, status: newStatus } : r)),
    );
  };

  const handleAddRoomType = async (typeData: Partial<RoomType>) => {
    const created = await createRoomTypeApi(typeData);
    setRoomTypes((prev) => [...prev, created]);
  };

  const handleUpdateRoomType = async (id: string, updates: Partial<RoomType>) => {
    const updated = await updateRoomTypeApi(id, updates);
    setRoomTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated, ...updates } : t)));
  };

  const handleAddRatePlan = async (planData: Partial<RatePlan>) => {
    const created = await createRatePlanApi(planData);
    setRatePlans((prev) => [...prev, created]);
  };

  const handleUpdateRatePlan = async (id: string, updates: Partial<RatePlan>) => {
    const updated = await updateRatePlanApi(id, updates);
    setRatePlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated, ...updates } : p)));
  };

  const handleAddFloor = async (floorData: Partial<Floor>) => {
    const created = await createFloorApi(floorData);
    setFloors((prev) => [...prev, created]);
  };

  const handleAddBedType = async (bedData: Partial<BedType>) => {
    const created = await createBedTypeApi(bedData);
    setBedTypes((prev) => [...prev, created]);
  };

  // Front Desk PMS Modals State
  const [isQuickCheckInOpen, setIsQuickCheckInOpen] = useState(false);
  const [quickCheckInRoomNumber, setQuickCheckInRoomNumber] = useState<string | undefined>(undefined);

  const [isCreateReservationOpen, setIsCreateReservationOpen] = useState(false);
  const [reservationRoomId, setReservationRoomId] = useState<string | undefined>(undefined);

  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [checkOutBookingId, setCheckOutBookingId] = useState<string | null>(null);

  const [isRoomSwitchOpen, setIsRoomSwitchOpen] = useState(false);
  const [activeSwitchBooking, setActiveSwitchBooking] = useState<ActiveBookingInfo | null>(null);

  const [frontDeskNotification, setFrontDeskNotification] = useState<string>("");

  const handleFrontDeskSuccess = (msg: string) => {
    setFrontDeskNotification(msg);
    loadAllInventoryData();
    setTimeout(() => setFrontDeskNotification(""), 6000);
  };

  // Night Audit state
  const [currentBusinessDate, setCurrentBusinessDate] = useState("2026-10-05");

  const occupiedCount = rooms.filter((r) => r.status === "Occupied").length;
  const availableCount = rooms.filter((r) => r.status === "Available" || r.status === "Clean").length;
  const dirtyCount = rooms.filter((r) => r.status === "Dirty").length;
  const maintenanceCount = rooms.filter((r) => r.status === "Maintenance" || r.status === "Blocked").length;
  const totalRooms = rooms.length;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;



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
            onClick={() => {
              setQuickCheckInRoomNumber(undefined);
              setIsQuickCheckInOpen(true);
            }}
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
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                onLogout();
              }}
              className="border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-xs ml-1"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-950 border-r border-slate-800/80 p-4 flex flex-col gap-1.5 shrink-0">
          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-3 py-1">
            Executive Command
          </p>
          <button
            onClick={() => setActiveTab("admin-dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "admin-dashboard"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Admin PMS Dashboard
          </button>

          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-3 py-1 mt-3">
            Room Inventory & Catalog
          </p>
          <button
            onClick={() => setActiveTab("rooms-inventory")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "rooms-inventory"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <BedDouble className="w-4 h-4" /> Room Catalog & Inventory
          </button>

          <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-3 py-1 mt-3">
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
          {/* TAB 0: MODULE 4 - ROOM CATALOG & INVENTORY */}
          {activeTab === "rooms-inventory" && (
            <RoomInventoryView
              rooms={inventoryRooms}
              roomTypes={roomTypes}
              ratePlans={ratePlans}
              floors={floors}
              bedTypes={bedTypes}
              isLoading={isInventoryLoading}
              onRefresh={loadAllInventoryData}
              onAddRoom={handleAddRoom}
              onUpdateRoom={handleUpdateRoom}
              onDeleteRoom={handleDeleteRoom}
              onStatusChange={handleStatusChange}
              onBulkStatusChange={handleBulkStatusChange}
              onAddRoomType={handleAddRoomType}
              onUpdateRoomType={handleUpdateRoomType}
              onAddRatePlan={handleAddRatePlan}
              onUpdateRatePlan={handleUpdateRatePlan}
              onAddFloor={handleAddFloor}
              onAddBedType={handleAddBedType}
            />
          )}

          {/* TAB 0: MAIN ADMIN PMS DASHBOARD */}
          {activeTab === "admin-dashboard" && (
            <AdminDashboardView
              currentBusinessDate={currentBusinessDate}
              onOpenReservationModal={() => setIsCreateReservationOpen(true)}
              onOpenCheckInModal={() => {
                setQuickCheckInRoomNumber(undefined);
                setIsQuickCheckInOpen(true);
              }}
              onOpenCheckOutModal={() => setIsCheckOutOpen(true)}
              onOpenRoomSwitchModal={() => setIsRoomSwitchOpen(true)}
              onOpenAddGuestModal={() => setActiveTab("crm")}
              onOpenAddPaymentModal={() => setActiveTab("folios")}
              onOpenAddServiceModal={() => setActiveTab("folios")}
            />
          )}

          {/* Executive KPI Cards (for Tape-chart and other operations tabs) */}
          {activeTab !== "rooms-inventory" && activeTab !== "admin-dashboard" && (
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
          )}

          {/* TAB 1: TAPE CHART / ROOM GRID */}
          {activeTab === "tape-chart" && (
            <TapeChartGrid
              rooms={inventoryRooms}
              roomTypes={roomTypes}
              floors={floors}
              onOpenQuickCheckIn={(roomNum) => {
                setQuickCheckInRoomNumber(roomNum);
                setIsQuickCheckInOpen(true);
              }}
              onOpenCreateReservation={(roomId) => {
                setReservationRoomId(roomId);
                setIsCreateReservationOpen(true);
              }}
              onOpenCheckOut={(bookingId) => {
                setCheckOutBookingId(bookingId);
                setIsCheckOutOpen(true);
              }}
              onOpenRoomSwitch={(stay) => {
                setActiveSwitchBooking(stay);
                setIsRoomSwitchOpen(true);
              }}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* TAB 2: BILLING, FOLIO & SPLIT INVOICES */}
          {activeTab === "folios" && <FolioManager />}

          {/* TAB 3: CRM & LEADS PIPELINE */}
          {activeTab === "crm" && <CRMDashboard />}

          {/* TAB 4: LOYALTY PROGRAM */}
          {activeTab === "loyalty" && <LoyaltyProgramDashboard />}

          {/* TAB 5: NIGHT AUDIT & FLASH REPORT */}
          {activeTab === "night-audit" && (
            <NightAuditConsole
              currentBusinessDate={currentBusinessDate}
              onBusinessDateAdvanced={(nextDate) => setCurrentBusinessDate(nextDate)}
              rooms={inventoryRooms}
            />
          )}

          {/* TAB 6: REPORTS & STATUTORY COMPLIANCE */}
          {activeTab === "reports" && <HotelReportsCenter />}
        </main>
      </div>

      {/* Front Desk Notification Toast */}
      {frontDeskNotification && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-fade-in border border-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span>{frontDeskNotification}</span>
        </div>
      )}

      {/* Quick Check-In Modal */}
      <QuickCheckInModal
        isOpen={isQuickCheckInOpen}
        onClose={() => setIsQuickCheckInOpen(false)}
        availableRooms={inventoryRooms.filter((r) => r.status === "Available" || r.status === "Clean")}
        selectedRoomNumber={quickCheckInRoomNumber}
        onSuccess={handleFrontDeskSuccess}
      />

      {/* 12-Step Create Reservation Modal */}
      <CreateReservationModal
        isOpen={isCreateReservationOpen}
        onClose={() => setIsCreateReservationOpen(false)}
        rooms={inventoryRooms}
        roomTypes={roomTypes}
        ratePlans={ratePlans}
        hotelStateCode={DEFAULT_HOTEL_INFO.stateCode}
        preselectedRoomId={reservationRoomId}
        onSuccess={handleFrontDeskSuccess}
      />

      {/* Check-Out & Folio Settlement Modal */}
      <CheckOutModal
        isOpen={isCheckOutOpen}
        onClose={() => {
          setIsCheckOutOpen(false);
          setCheckOutBookingId(null);
        }}
        bookingId={checkOutBookingId}
        onSuccess={handleFrontDeskSuccess}
      />

      {/* Mid-Stay Transactional Room Switch Modal */}
      <RoomSwitchModal
        isOpen={isRoomSwitchOpen}
        onClose={() => {
          setIsRoomSwitchOpen(false);
          setActiveSwitchBooking(null);
        }}
        activeBooking={activeSwitchBooking}
        availableRooms={inventoryRooms}
        roomTypes={roomTypes}
        onSuccess={handleFrontDeskSuccess}
      />
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => Boolean(getAccessToken()));

  // React to login/logout/expired-session events dispatched by services/http.
  useEffect(() => {
    const refresh = () => setLoggedIn(Boolean(getAccessToken()));
    window.addEventListener(UNAUTHORIZED_EVENT, refresh);
    window.addEventListener(LOGGED_IN_EVENT, refresh);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, refresh);
      window.removeEventListener(LOGGED_IN_EVENT, refresh);
    };
  }, []);

  if (!loggedIn) {
    return <LoginScreen onSuccess={() => setLoggedIn(true)} />;
  }

  return <PMSDashboard onLogout={() => setLoggedIn(false)} />;
}
