import { useState, useMemo } from "react";
import {
  Button,
  Card,
  RoomStatusBadge,
} from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type { Room, RoomType, RatePlan, Floor, BedType, RoomStatus } from "@hotel/types";
import { AddRoomModal } from "./AddRoomModal";
import { EditRoomModal } from "./EditRoomModal";
import { RoomDetailsDrawer } from "./RoomDetailsDrawer";
import { RoomTypesManager } from "./RoomTypesManager";
import { RatePlansManager } from "./RatePlansManager";
import { FloorsBedTypesManager } from "./FloorsBedTypesManager";
import {
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  CheckSquare,
  Square,
  Layers,
  BedDouble,
  DollarSign,
  Tag,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface RoomInventoryViewProps {
  rooms: Room[];
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  floors: Floor[];
  bedTypes: BedType[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onAddRoom: (room: Partial<Room>) => Promise<void> | void;
  onUpdateRoom: (id: string, updates: Partial<Room>) => Promise<void> | void;
  onDeleteRoom: (id: string) => Promise<void> | void;
  onStatusChange: (roomId: string, status: RoomStatus) => Promise<void> | void;
  onBulkStatusChange: (roomIds: string[], status: RoomStatus) => Promise<void> | void;
  onAddRoomType: (data: Partial<RoomType>) => Promise<void> | void;
  onUpdateRoomType: (id: string, data: Partial<RoomType>) => Promise<void> | void;
  onAddRatePlan: (data: Partial<RatePlan>) => Promise<void> | void;
  onUpdateRatePlan: (id: string, data: Partial<RatePlan>) => Promise<void> | void;
  onAddFloor: (data: Partial<Floor>) => Promise<void> | void;
  onAddBedType: (data: Partial<BedType>) => Promise<void> | void;
}

export function RoomInventoryView({
  rooms,
  roomTypes,
  ratePlans,
  floors,
  bedTypes,
  isLoading = false,
  onRefresh,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  onStatusChange,
  onBulkStatusChange,
  onAddRoomType,
  onUpdateRoomType,
  onAddRatePlan,
  onUpdateRatePlan,
  onAddFloor,
  onAddBedType,
}: RoomInventoryViewProps) {
  // Sub-navigation tab
  const [subTab, setSubTab] = useState<"rooms" | "types" | "rates" | "floors">("rooms");

  // Filters
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Selection for bulk actions
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<RoomStatus>("Clean");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [inspectingRoom, setInspectingRoom] = useState<Room | null>(null);

  // REAL DATABASE METRICS ONLY (No fake statistics)
  const metrics = useMemo(() => {
    const total = rooms.length;
    const available = rooms.filter((r) => r.status === "Available").length;
    const clean = rooms.filter((r) => r.status === "Clean").length;
    const occupied = rooms.filter((r) => r.status === "Occupied").length;
    const dirty = rooms.filter((r) => r.status === "Dirty").length;
    const blockedOrMaint = rooms.filter((r) => r.status === "Blocked" || r.status === "Maintenance").length;
    const active = rooms.filter((r) => r.isActive).length;

    return { total, available, clean, occupied, dirty, blockedOrMaint, active };
  }, [rooms]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // Search
      const searchMatch =
        !search ||
        r.roomNumber.toLowerCase().includes(search.toLowerCase()) ||
        roomTypes.find((t) => t.id === r.roomTypeId)?.name.toLowerCase().includes(search.toLowerCase());

      // Floor
      const floorMatch = floorFilter === "ALL" || r.floorId === floorFilter;

      // Type
      const typeMatch = typeFilter === "ALL" || r.roomTypeId === typeFilter;

      // Status
      const statusMatch = statusFilter === "ALL" || r.status === statusFilter;

      // Active
      const activeMatch =
        activeFilter === "ALL" ||
        (activeFilter === "ACTIVE" && r.isActive) ||
        (activeFilter === "INACTIVE" && !r.isActive);

      return searchMatch && floorMatch && typeMatch && statusMatch && activeMatch;
    });
  }, [rooms, search, floorFilter, typeFilter, statusFilter, activeFilter, roomTypes]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedRoomIds.length === filteredRooms.length) {
      setSelectedRoomIds([]);
    } else {
      setSelectedRoomIds(filteredRooms.map((r) => r.id));
    }
  };

  const handleToggleSelectRoom = (roomId: string) => {
    if (selectedRoomIds.includes(roomId)) {
      setSelectedRoomIds(selectedRoomIds.filter((id) => id !== roomId));
    } else {
      setSelectedRoomIds([...selectedRoomIds, roomId]);
    }
  };

  const handleApplyBulkStatus = async () => {
    if (selectedRoomIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      await onBulkStatusChange(selectedRoomIds, bulkTargetStatus);
      setActionSuccessMsg(`Updated ${selectedRoomIds.length} rooms to "${bulkTargetStatus}"!`);
      setSelectedRoomIds([]);
      setTimeout(() => setActionSuccessMsg(""), 3500);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setIsEditModalOpen(true);
  };

  const handleOpenDrawer = (room: Room) => {
    setInspectingRoom(room);
    setIsDrawerOpen(true);
  };

  const handleResetFilters = () => {
    setSearch("");
    setFloorFilter("ALL");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setActiveFilter("ALL");
  };

  return (
    <div className="space-y-6">
      {/* Module Title & Top Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/70 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BedDouble className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Room Catalog & Inventory Module
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-normal">
                  Module 4
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Core PMS Administration: Room Allocation, Room Types, Bed Types, Rate Plans, and Operational Statuses.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="border-slate-800 text-slate-300 hover:text-white"
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          )}

          <Button
            variant="gold"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="font-semibold shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add New Room
          </Button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubTab("rooms")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            subTab === "rooms"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <BedDouble className="w-3.5 h-3.5" /> Rooms Inventory ({rooms.length})
        </button>

        <button
          onClick={() => setSubTab("types")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            subTab === "types"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Tag className="w-3.5 h-3.5" /> Room Types ({roomTypes.length})
        </button>

        <button
          onClick={() => setSubTab("rates")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            subTab === "rates"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Rate Plans ({ratePlans.length})
        </button>

        <button
          onClick={() => setSubTab("floors")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            subTab === "floors"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Floors & Bed Types ({floors.length} Floors)
        </button>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* SUB-VIEW 1: ROOMS INVENTORY TABLE */}
      {subTab === "rooms" && (
        <div className="space-y-4">
          {/* Dynamic Real Data Metrics Cards (Database Only, No Fake Statistics) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <Card className="bg-slate-950/70 border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-slate-400 block">Total Catalog</span>
              <span className="text-xl font-black text-white mt-1 block">{metrics.total}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">{metrics.active} active rooms</span>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-emerald-400 block">Available</span>
              <span className="text-xl font-black text-emerald-400 mt-1 block">{metrics.available}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Ready for booking</span>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-blue-400 block">Clean (Inspected)</span>
              <span className="text-xl font-black text-blue-400 mt-1 block">{metrics.clean}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Housekeeping OK</span>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-rose-400 block">Occupied</span>
              <span className="text-xl font-black text-rose-400 mt-1 block">{metrics.occupied}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Checked-in guests</span>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-amber-400 block">Dirty</span>
              <span className="text-xl font-black text-amber-400 mt-1 block">{metrics.dirty}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Pending turnover</span>
            </Card>

            <Card className="bg-slate-950/70 border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-orange-400 block">Blocked / Maint.</span>
              <span className="text-xl font-black text-orange-400 mt-1 block">{metrics.blockedOrMaint}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Out of service</span>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search room number or type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Floor Filter */}
              <div>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Floors</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      Floor {f.floorNumber} ({f.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Type Filter */}
              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Room Types</option>
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} ({rt.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
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

              {/* Active Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as any)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Inventory Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Archived Only</option>
                </select>

                {(search || floorFilter !== "ALL" || typeFilter !== "ALL" || statusFilter !== "ALL" || activeFilter !== "ALL") && (
                  <button
                    onClick={handleResetFilters}
                    className="text-xs text-slate-400 hover:text-white px-2 py-2 border border-slate-800 rounded-lg whitespace-nowrap hover:bg-slate-850"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Action Dock */}
            {selectedRoomIds.length > 0 && (
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-amber-500/10 px-4 py-2.5 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>{selectedRoomIds.length} rooms selected for bulk action</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-medium">Set Status to:</span>
                  <select
                    value={bulkTargetStatus}
                    onChange={(e) => setBulkTargetStatus(e.target.value as RoomStatus)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Available">Available</option>
                    <option value="Clean">Clean</option>
                    <option value="Dirty">Dirty</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>

                  <Button
                    variant="gold"
                    size="sm"
                    disabled={isBulkUpdating}
                    onClick={handleApplyBulkStatus}
                    className="font-semibold shadow-xs"
                  >
                    {isBulkUpdating ? "Updating..." : "Apply Bulk Status"}
                  </Button>

                  <button
                    onClick={() => setSelectedRoomIds([])}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Rooms Table */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800 tracking-wider">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-400 hover:text-white"
                        title="Select All"
                      >
                        {selectedRoomIds.length > 0 && selectedRoomIds.length === filteredRooms.length ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">Room</th>
                    <th className="p-3.5">Room Type</th>
                    <th className="p-3.5">Floor</th>
                    <th className="p-3.5">Bed Type</th>
                    <th className="p-3.5">Capacity</th>
                    <th className="p-3.5">Base Rate</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Active</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredRooms.map((room) => {
                    const floor = floors.find((f) => f.id === room.floorId);
                    const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
                    const bedType = bedTypes.find((bt) => bt.id === room.bedTypeId);
                    const isSelected = selectedRoomIds.includes(room.id);
                    const effectiveRate = room.baseRate ?? roomType?.basePrice ?? 4200;

                    return (
                      <tr
                        key={room.id}
                        className={`hover:bg-slate-900/60 transition-colors ${
                          isSelected ? "bg-amber-500/10" : ""
                        }`}
                      >
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectRoom(room.id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="p-3.5">
                          <button
                            onClick={() => handleOpenDrawer(room)}
                            className="font-bold text-white hover:text-amber-400 text-sm font-mono flex items-center gap-1.5"
                          >
                            <span>{room.roomNumber}</span>
                          </button>
                        </td>

                        <td className="p-3.5">
                          <div>
                            <span className="font-semibold text-slate-100">{roomType?.name || "Standard"}</span>
                            <span className="text-[10px] text-amber-400/80 font-mono ml-1.5 px-1 py-0.2 rounded bg-amber-500/10">
                              {roomType?.code || "STD"}
                            </span>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="text-slate-300">
                            {floor?.name || `Floor ${floor?.floorNumber || 1}`}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span className="text-slate-300">{bedType?.name || "King"}</span>
                        </td>

                        <td className="p-3.5 text-slate-400">
                          {roomType ? `${roomType.maxAdults}A + ${roomType.maxChildren}C` : "2A + 1C"}
                        </td>

                        <td className="p-3.5 font-bold text-amber-400 font-mono">
                          {formatINR(effectiveRate)}
                        </td>

                        <td className="p-3.5">
                          <RoomStatusBadge status={room.status} />
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              room.isActive
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {room.isActive ? "Active" : "Archived"}
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenDrawer(room)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="View Room Profile & Specifications"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenEdit(room)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                              title="Edit Room Configuration"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <select
                              value={room.status}
                              onChange={(e) => onStatusChange(room.id, e.target.value as RoomStatus)}
                              className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-amber-500 cursor-pointer ml-1"
                              title="Change Status"
                            >
                              <option value="Available">Available</option>
                              <option value="Clean">Clean</option>
                              <option value="Dirty">Dirty</option>
                              <option value="Occupied">Occupied</option>
                              <option value="Blocked">Blocked</option>
                              <option value="Maintenance">Maintenance</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRooms.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <AlertTriangle className="w-6 h-6 text-amber-500/80 mx-auto mb-2" />
                        <p className="font-semibold text-white">No rooms matching the criteria</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search keywords.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-900/60 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>
                Showing {filteredRooms.length} of {rooms.length} registered rooms
              </span>
              <span className="font-mono text-amber-400/80 text-[11px]">Database-verified Inventory</span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: ROOM TYPES CONFIGURATION */}
      {subTab === "types" && (
        <RoomTypesManager
          roomTypes={roomTypes}
          onAddRoomType={onAddRoomType}
          onUpdateRoomType={onUpdateRoomType}
        />
      )}

      {/* SUB-VIEW 3: RATE PLANS CONFIGURATION */}
      {subTab === "rates" && (
        <RatePlansManager
          ratePlans={ratePlans}
          roomTypes={roomTypes}
          onAddRatePlan={onAddRatePlan}
          onUpdateRatePlan={onUpdateRatePlan}
        />
      )}

      {/* SUB-VIEW 4: FLOORS & BED TYPES */}
      {subTab === "floors" && (
        <FloorsBedTypesManager
          floors={floors}
          bedTypes={bedTypes}
          rooms={rooms}
          onAddFloor={onAddFloor}
          onAddBedType={onAddBedType}
        />
      )}

      {/* ADD ROOM MODAL */}
      <AddRoomModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        floors={floors}
        roomTypes={roomTypes}
        bedTypes={bedTypes}
        existingRoomNumbers={rooms.map((r) => r.roomNumber)}
        onAddRoom={onAddRoom}
      />

      {/* EDIT ROOM MODAL */}
      <EditRoomModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRoom(null);
        }}
        room={editingRoom}
        floors={floors}
        roomTypes={roomTypes}
        bedTypes={bedTypes}
        onUpdateRoom={onUpdateRoom}
        onDeleteRoom={onDeleteRoom}
      />

      {/* ROOM DETAILS DRAWER */}
      <RoomDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setInspectingRoom(null);
        }}
        room={inspectingRoom}
        floors={floors}
        roomTypes={roomTypes}
        bedTypes={bedTypes}
        ratePlans={ratePlans}
        onOpenEdit={handleOpenEdit}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
