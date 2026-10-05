import React, { useState } from "react";
import { Button, Input, Modal } from "@hotel/ui";
import type { Floor, BedType, Room } from "@hotel/types";
import { Layers, Bed, Plus } from "lucide-react";

interface FloorsBedTypesManagerProps {
  floors: Floor[];
  bedTypes: BedType[];
  rooms: Room[];
  onAddFloor: (floor: Partial<Floor>) => Promise<void> | void;
  onAddBedType: (bedType: Partial<BedType>) => Promise<void> | void;
}

export function FloorsBedTypesManager({
  floors,
  bedTypes,
  rooms,
  onAddFloor,
  onAddBedType,
}: FloorsBedTypesManagerProps) {
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [floorNumber, setFloorNumber] = useState("");
  const [floorName, setFloorName] = useState("");
  const [floorDescription, setFloorDescription] = useState("");

  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [bedName, setBedName] = useState("");
  const [bedCapacity, setBedCapacity] = useState("2");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorNumber || !floorName) return;
    setIsSubmitting(true);
    try {
      await onAddFloor({
        floorNumber: parseInt(floorNumber, 10),
        name: floorName.trim(),
        description: floorDescription.trim(),
      });
      setFloorNumber("");
      setFloorName("");
      setFloorDescription("");
      setIsFloorModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBedType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedName) return;
    setIsSubmitting(true);
    try {
      await onAddBedType({
        name: bedName.trim(),
        capacity: parseInt(bedCapacity, 10) || 2,
      });
      setBedName("");
      setBedCapacity("2");
      setIsBedModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* FLOORS */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Property Floors</h3>
          </div>
          <Button variant="gold" size="sm" onClick={() => setIsFloorModalOpen(true)} className="flex items-center gap-1 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add Floor
          </Button>
        </div>

        <div className="space-y-2">
          {floors.map((f) => {
            const floorRooms = rooms.filter((r) => r.floorId === f.id);
            return (
              <div key={f.id} className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-white flex items-center gap-2">
                    Floor {f.floorNumber}: {f.name}
                  </p>
                  {f.description && <p className="text-slate-400 text-[11px] mt-0.5">{f.description}</p>}
                </div>
                <div className="text-right">
                  <span className="font-mono text-amber-400 font-bold">{floorRooms.length}</span>
                  <span className="text-[11px] text-slate-500 block">Rooms</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BED TYPES */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bed className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Bed Configurations</h3>
          </div>
          <Button variant="gold" size="sm" onClick={() => setIsBedModalOpen(true)} className="flex items-center gap-1 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add Bed Type
          </Button>
        </div>

        <div className="space-y-2">
          {bedTypes.map((bt) => {
            const bedRooms = rooms.filter((r) => r.bedTypeId === bt.id);
            return (
              <div key={bt.id} className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-white">{bt.name} Bed</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Capacity: {bt.capacity} adult guests</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-amber-400 font-bold">{bedRooms.length}</span>
                  <span className="text-[11px] text-slate-500 block">Rooms</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Floor Modal */}
      <Modal
        isOpen={isFloorModalOpen}
        onClose={() => setIsFloorModalOpen(false)}
        title="Add New Floor"
        description="Register a building floor or wing in property configuration."
        maxWidth="md"
      >
        <form onSubmit={handleCreateFloor} className="space-y-3">
          <Input
            label="Floor Number"
            type="number"
            placeholder="e.g. 4"
            value={floorNumber}
            onChange={(e) => setFloorNumber(e.target.value)}
            required
          />
          <Input
            label="Floor Name / Wing"
            placeholder="e.g. Club Executive Level"
            value={floorName}
            onChange={(e) => setFloorName(e.target.value)}
            required
          />
          <Input
            label="Description (Optional)"
            placeholder="e.g. Quiet floor with lounge access"
            value={floorDescription}
            onChange={(e) => setFloorDescription(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsFloorModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting}>
              Create Floor
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Bed Modal */}
      <Modal
        isOpen={isBedModalOpen}
        onClose={() => setIsBedModalOpen(false)}
        title="Add Bed Type"
        description="Define mattress setup and default adult capacity."
        maxWidth="md"
      >
        <form onSubmit={handleCreateBedType} className="space-y-3">
          <Input
            label="Bed Type Name"
            placeholder="e.g. California King"
            value={bedName}
            onChange={(e) => setBedName(e.target.value)}
            required
          />
          <Input
            label="Guest Capacity"
            type="number"
            value={bedCapacity}
            onChange={(e) => setBedCapacity(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsBedModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting}>
              Create Bed Type
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
