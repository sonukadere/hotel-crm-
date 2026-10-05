import React, { useState, useEffect } from "react";
import { Modal, Button, Input } from "@hotel/ui";
import type { Room, RoomType, Floor, BedType, RoomStatus } from "@hotel/types";
import { Check, Trash2 } from "lucide-react";

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  floors: Floor[];
  roomTypes: RoomType[];
  bedTypes: BedType[];
  onUpdateRoom: (id: string, updates: Partial<Room>) => Promise<void> | void;
  onDeleteRoom?: (id: string) => Promise<void> | void;
}

export function EditRoomModal({
  isOpen,
  onClose,
  room,
  floors,
  roomTypes,
  bedTypes,
  onUpdateRoom,
  onDeleteRoom,
}: EditRoomModalProps) {
  const [roomNumber, setRoomNumber] = useState("");
  const [floorId, setFloorId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [bedTypeId, setBedTypeId] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [status, setStatus] = useState<RoomStatus>("Available");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (room) {
      setRoomNumber(room.roomNumber);
      setFloorId(room.floorId);
      setRoomTypeId(room.roomTypeId);
      setBedTypeId(room.bedTypeId || bedTypes[0]?.id || "");
      setBaseRate(room.baseRate ? String(room.baseRate) : "");
      setStatus(room.status);
      setIsActive(room.isActive);
      setError("");
    }
  }, [room, bedTypes]);

  if (!room) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!roomNumber.trim()) {
      setError("Room number is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateRoom(room.id, {
        roomNumber: roomNumber.trim(),
        floorId,
        roomTypeId,
        bedTypeId: bedTypeId || undefined,
        status,
        baseRate: baseRate ? parseFloat(baseRate) : undefined,
        isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update room");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!onDeleteRoom) return;
    if (confirm(`Are you sure you want to deactivate Room ${room.roomNumber}?`)) {
      await onDeleteRoom(room.id);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Room ${room.roomNumber}`}
      description="Update room configuration, floor assignment, tariff rate, and operational status."
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
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
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
                  {rt.name} ({rt.code})
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
            value={baseRate}
            onChange={(e) => setBaseRate(e.target.value)}
            placeholder="Standard Tariff"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RoomStatus)}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="Available">Available</option>
              <option value="Clean">Clean</option>
              <option value="Dirty">Dirty</option>
              <option value="Occupied">Occupied</option>
              <option value="Blocked">Blocked</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="edit-active-toggle"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
          />
          <label htmlFor="edit-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
            Room Active in Hotel Operations
          </label>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {onDeleteRoom ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeactivate}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Deactivate Room
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting} className="flex items-center gap-1.5">
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
