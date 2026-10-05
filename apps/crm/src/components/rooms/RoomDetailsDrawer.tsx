import { useState } from "react";
import { Drawer, Button, RoomStatusBadge } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type { Room, RoomType, Floor, BedType, RatePlan, RoomStatus } from "@hotel/types";
import {
  Layers,
  Sparkles,
  Edit,
  CheckCircle,
  Clock,
  UtensilsCrossed,
} from "lucide-react";

interface RoomDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  floors: Floor[];
  roomTypes: RoomType[];
  bedTypes: BedType[];
  ratePlans: RatePlan[];
  onOpenEdit: (room: Room) => void;
  onStatusChange: (roomId: string, status: RoomStatus) => Promise<void> | void;
}

export function RoomDetailsDrawer({
  isOpen,
  onClose,
  room,
  floors,
  roomTypes,
  bedTypes,
  ratePlans,
  onOpenEdit,
  onStatusChange,
}: RoomDetailsDrawerProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!room) return null;

  const floor = floors.find((f) => f.id === room.floorId);
  const roomType = roomTypes.find((rt) => rt.id === room.roomTypeId);
  const bedType = bedTypes.find((bt) => bt.id === room.bedTypeId);
  const matchedPlans = ratePlans.filter((rp) => rp.roomTypeId === room.roomTypeId);

  const effectiveRate = room.baseRate ?? roomType?.basePrice ?? 4200;

  const handleQuickStatus = async (status: RoomStatus) => {
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(room.id, status);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Room ${room.roomNumber}`}
      description={`${roomType?.name || "Standard Room"} • Floor ${floor?.floorNumber || 1}`}
      width="lg"
    >
      <div className="space-y-6">
        {/* Header Summary Card */}
        <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-lg">
                {room.roomNumber}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{roomType?.name || "Room"}</h4>
                <p className="text-xs text-slate-400">
                  {floor?.name || `Floor ${floor?.floorNumber || 1}`} • Code: <span className="font-mono text-amber-400">{roomType?.code || "STD"}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <RoomStatusBadge status={room.status} />
              <span
                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                  room.isActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-700 text-slate-400 border border-slate-600"
                }`}
              >
                {room.isActive ? "Active Inventory" : "Inactive / Archived"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800 text-center">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Nightly Base Tariff</p>
              <p className="text-base font-bold text-amber-400">{formatINR(effectiveRate)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Bed Setup</p>
              <p className="text-xs font-semibold text-slate-200 mt-1">{bedType?.name || "King"} Bed</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Max Occupancy</p>
              <p className="text-xs font-semibold text-slate-200 mt-1">
                {roomType?.maxAdults || 2}A + {roomType?.maxChildren || 1}C
              </p>
            </div>
          </div>
        </div>

        {/* Quick Operational Status Control */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-600" /> Quick Status Change
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["Available", "Clean", "Dirty", "Occupied", "Blocked", "Maintenance"] as RoomStatus[]).map((st) => (
              <button
                key={st}
                disabled={isUpdatingStatus || room.status === st}
                onClick={() => handleQuickStatus(st)}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border text-center transition-all ${
                  room.status === st
                    ? "bg-slate-900 text-white border-slate-900 font-bold shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Room Specifications */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" /> Specifications & Capacities
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-medium block">Room Number</span>
              <span className="font-bold text-slate-900 text-sm">{room.roomNumber}</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-medium block">Floor Wing</span>
              <span className="font-bold text-slate-900 text-sm">
                Floor {floor?.floorNumber}: {floor?.name}
              </span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-medium block">Bed Configuration</span>
              <span className="font-bold text-slate-900 text-sm">
                {bedType?.name} ({bedType?.capacity} persons capacity)
              </span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-medium block">Guest Allocation Limit</span>
              <span className="font-bold text-slate-900 text-sm">
                Up to {roomType?.maxAdults || 2} Adults, {roomType?.maxChildren || 1} Children
              </span>
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600" /> Configured Room Amenities
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {(roomType?.amenities || []).map((amenity, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3 text-amber-600" /> {amenity}
              </span>
            ))}
            {(!roomType?.amenities || roomType.amenities.length === 0) && (
              <p className="text-xs text-slate-400 italic">No specific amenities configured.</p>
            )}
          </div>
        </div>

        {/* Available Rate Plans for this Room */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <UtensilsCrossed className="w-4 h-4 text-amber-600" /> Configured Rate Plans
          </h4>
          <div className="space-y-2">
            {matchedPlans.map((plan) => (
              <div
                key={plan.id}
                className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    {plan.name}
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                      {plan.mealPlan}
                    </span>
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Season: {plan.seasonalMultiplier}x • Weekend: {plan.weekendMultiplier}x • +Adult: {formatINR(plan.extraAdultRate)} • +Child: {formatINR(plan.extraChildRate)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 text-sm">{formatINR(plan.baseRate)}</span>
                  <span className="text-[10px] text-slate-500 block">/ night</span>
                </div>
              </div>
            ))}
            {matchedPlans.length === 0 && (
              <p className="text-xs text-slate-400 italic">No separate rate plans configured for this type.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="gold"
            onClick={() => {
              onClose();
              onOpenEdit(room);
            }}
            className="flex items-center gap-1.5"
          >
            <Edit className="w-4 h-4" /> Edit Room Details
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
