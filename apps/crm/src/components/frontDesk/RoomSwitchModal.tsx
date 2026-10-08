import React, { useState, useEffect } from "react";
import { Modal, Button, Input } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type { Room, RoomType } from "@hotel/types";
import { switchRoomApi } from "../../services/frontDeskApi";
import {
  ArrowRightLeft,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";

export interface ActiveBookingInfo {
  id: string;
  bookingNumber: string;
  guestName: string;
  currentRoomId?: string;
  currentRoomNumber?: string;
  currentRoomType?: string;
  currentBaseRate?: number;
  checkOutDate?: string;
}

interface RoomSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBooking: ActiveBookingInfo | null;
  availableRooms: Room[];
  roomTypes: RoomType[];
  onSuccess: (msg: string) => void;
}

export function RoomSwitchModal({
  isOpen,
  onClose,
  activeBooking,
  availableRooms,
  roomTypes,
  onSuccess,
}: RoomSwitchModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [reason, setReason] = useState("");
  const [recalculateRate, setRecalculateRate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Filter available rooms (exclude currently assigned room)
  const sellableRooms = availableRooms.filter(
    (r) =>
      r.id !== activeBooking?.currentRoomId &&
      (r.status === "Available" || r.status === "Clean")
  );

  useEffect(() => {
    if (isOpen) {
      setError("");
      setReason("");
      setRecalculateRate(true);
      if (sellableRooms.length > 0) {
        setSelectedRoomId(sellableRooms[0]?.id || "");
      } else {
        setSelectedRoomId("");
      }
    }
  }, [isOpen, activeBooking]);

  const targetRoom = availableRooms.find((r) => r.id === selectedRoomId);
  const targetRoomType = roomTypes.find((t) => t.id === targetRoom?.roomTypeId);
  const currentRoomRate = activeBooking?.currentBaseRate || 0;
  const targetRoomRate = Number(targetRoom?.baseRate) || targetRoomType?.basePrice || 0;
  const isDifferentType = targetRoomType?.name !== activeBooking?.currentRoomType;
  const rateDiffPerNight = targetRoomRate - currentRoomRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;

    if (!selectedRoomId) {
      setError("Please select an available room to switch into");
      return;
    }

    if (!reason.trim()) {
      setError("A reason is mandatory for statutory PMS audit compliance");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await switchRoomApi({
        bookingId: activeBooking.id,
        newRoomId: selectedRoomId,
        reason: reason.trim(),
        recalculateRate,
      });

      const rateNotice =
        result.rateRecalculated && result.adjustmentAmount !== 0
          ? ` Tariff adjusted by ${formatINR(result.adjustmentAmount)}.`
          : "";

      onSuccess(
        `Room switched successfully from Room ${result.previousRoomNumber || "—"} to Room ${result.newRoomNumber}.${rateNotice}`
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to switch room");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mid-Stay Transactional Room Switch"
      description="Reassign guest to another available room with transactional lock and audit log preservation"
      maxWidth="md"
    >
      {activeBooking ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Active Stay Information */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Guest Name</span>
              <span className="text-white font-bold">{activeBooking.guestName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Booking Reference</span>
              <span className="text-amber-400 font-mono font-semibold">
                #{activeBooking.bookingNumber}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-400">Current Room</span>
              <span className="text-rose-400 font-bold">
                Room {activeBooking.currentRoomNumber || "Unassigned"} ({activeBooking.currentRoomType || "Standard"})
              </span>
            </div>
          </div>

          {/* Select New Target Room */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Select Target Available Room *
            </label>
            {sellableRooms.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>No clean or available rooms currently open in inventory.</span>
              </div>
            ) : (
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                required
              >
                {sellableRooms.map((r) => {
                  const type = roomTypes.find((t) => t.id === r.roomTypeId);
                  const rate = Number(r.baseRate) || type?.basePrice || 0;
                  return (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} — {type?.name || "Standard"} ({r.status}) • {formatINR(rate)}/night
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Tariff Recalculation Notice */}
          {targetRoom && isDifferentType && (
            <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Room Category Change
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {rateDiffPerNight >= 0 ? `+${formatINR(rateDiffPerNight)}/night` : `${formatINR(rateDiffPerNight)}/night`}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Switching from {activeBooking.currentRoomType} to {targetRoomType?.name}.
              </p>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={recalculateRate}
                  onChange={(e) => setRecalculateRate(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 h-4 w-4"
                />
                <span>Recalculate daily tariff for remaining nights & post to folio</span>
              </label>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Reason for Room Switch (Mandatory Audit Log) *
            </label>
            <Input
              placeholder="e.g. AC cooling issue / Guest requested garden courtyard view / VIP upgrade"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "AC maintenance issue",
                "Guest requested quiet floor",
                "Upgrade to Suite",
                "Plumbing maintenance",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setReason(suggestion)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400 hover:text-white rounded border border-slate-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gold"
              disabled={submitting || sellableRooms.length === 0}
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Switching Room...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4" /> Confirm Room Switch
                </span>
              )}
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
