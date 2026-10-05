import React, { useState } from "react";
import { Modal, Button, Input } from "@hotel/ui";
import type { Room, RoomType, Floor, BedType, RoomStatus } from "@hotel/types";
import { Plus } from "lucide-react";

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  floors: Floor[];
  roomTypes: RoomType[];
  bedTypes: BedType[];
  existingRoomNumbers: string[];
  onAddRoom: (room: Partial<Room>) => Promise<void> | void;
}

export function AddRoomModal({
  isOpen,
  onClose,
  floors,
  roomTypes,
  bedTypes,
  existingRoomNumbers,
  onAddRoom,
}: AddRoomModalProps) {
  const [roomNumber, setRoomNumber] = useState("");
  const [floorId, setFloorId] = useState(floors[0]?.id || "");
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id || "");
  const [bedTypeId, setBedTypeId] = useState(bedTypes[0]?.id || "");
  const [baseRateOverride, setBaseRateOverride] = useState("");
  const [status, setStatus] = useState<RoomStatus>("Available");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected room type for default price display
  const selectedType = roomTypes.find((rt) => rt.id === roomTypeId) || roomTypes[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedNumber = roomNumber.trim();
    if (!trimmedNumber) {
      setError("Room number is required");
      return;
    }

    if (existingRoomNumbers.includes(trimmedNumber)) {
      setError(`Room number "${trimmedNumber}" already exists in the catalog`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddRoom({
        roomNumber: trimmedNumber,
        floorId: floorId || floors[0]?.id,
        roomTypeId: roomTypeId || roomTypes[0]?.id,
        bedTypeId: bedTypeId || bedTypes[0]?.id,
        status,
        baseRate: baseRateOverride ? parseFloat(baseRateOverride) : selectedType?.basePrice,
        isActive,
      });

      // Reset and close
      setRoomNumber("");
      setBaseRateOverride("");
      setStatus("Available");
      setIsActive(true);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create room");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Room"
      description="Register a new room to hotel inventory with floor, room type, and bed specifications."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Room Number"
            placeholder="e.g. 105, 204, 301"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Floor
            </label>
            <select
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  Floor {f.floorNumber} - {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Room Type
            </label>
            <select
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} ({rt.code}) — ₹{rt.basePrice.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Bed Type
            </label>
            <select
              value={bedTypeId}
              onChange={(e) => setBedTypeId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {bedTypes.map((bt) => (
                <option key={bt.id} value={bt.id}>
                  {bt.name} (Max {bt.capacity} guests)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Base Rate (₹ Override)"
            type="number"
            placeholder={`Default: ₹${selectedType?.basePrice || 4200}`}
            value={baseRateOverride}
            onChange={(e) => setBaseRateOverride(e.target.value)}
            helperText="Leave empty to use room type standard tariff"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RoomStatus)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="Available">Available (Ready for guest)</option>
              <option value="Clean">Clean (Housekeeping done)</option>
              <option value="Dirty">Dirty (Needs cleaning)</option>
              <option value="Blocked">Blocked (Reserved/Admin hold)</option>
              <option value="Maintenance">Maintenance (Out of order)</option>
            </select>
          </div>
        </div>

        {/* Room Specifications Preview */}
        {selectedType && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Room Type Amenities & Capacity:</p>
            <p>
              Capacity: <span className="font-medium text-slate-700">{selectedType.maxAdults} Adults, {selectedType.maxChildren} Children</span>
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {(selectedType.amenities || []).slice(0, 4).map((a, i) => (
                <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700">
                  {a}
                </span>
              ))}
              {(selectedType.amenities || []).length > 4 && (
                <span className="px-1.5 py-0.5 text-[11px] text-slate-500">
                  +{(selectedType.amenities || []).length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="active-toggle"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
          />
          <label htmlFor="active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
            Mark room as Active in Operational Inventory
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" disabled={isSubmitting} className="flex items-center gap-1.5">
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create Room
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
