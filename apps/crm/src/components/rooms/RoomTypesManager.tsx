import React, { useState } from "react";
import { Button, Input, Modal } from "@hotel/ui";
import { formatINR } from "@hotel/utils";
import type { RoomType } from "@hotel/types";
import { ALL_AVAILABLE_AMENITIES } from "../../services/roomApi";
import { Plus, Check, Edit2 } from "lucide-react";

interface RoomTypesManagerProps {
  roomTypes: RoomType[];
  onAddRoomType: (data: Partial<RoomType>) => Promise<void> | void;
  onUpdateRoomType: (id: string, data: Partial<RoomType>) => Promise<void> | void;
}

export function RoomTypesManager({
  roomTypes,
  onAddRoomType,
  onUpdateRoomType,
}: RoomTypesManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [maxAdults, setMaxAdults] = useState("3");
  const [maxChildren, setMaxChildren] = useState("2");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingType(null);
    setCode("");
    setName("");
    setDescription("");
    setBasePrice("5000");
    setMaxAdults("3");
    setMaxChildren("2");
    setSelectedAmenities(["High Speed WiFi", "Air Conditioning", "Tea/Coffee Maker"]);
    setIsActive(true);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (rt: RoomType) => {
    setEditingType(rt);
    setCode(rt.code);
    setName(rt.name);
    setDescription(rt.description || "");
    setBasePrice(String(rt.basePrice));
    setMaxAdults(String(rt.maxAdults || 2));
    setMaxChildren(String(rt.maxChildren || 1));
    setSelectedAmenities(rt.amenities || []);
    setIsActive(rt.isActive);
    setError("");
    setIsModalOpen(true);
  };

  const toggleAmenity = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const handleAddCustomAmenity = () => {
    if (customAmenity.trim() && !selectedAmenities.includes(customAmenity.trim())) {
      setSelectedAmenities([...selectedAmenities, customAmenity.trim()]);
      setCustomAmenity("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code.trim() || !name.trim()) {
      setError("Type Code and Name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<RoomType> = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        basePrice: parseFloat(basePrice) || 4000,
        maxAdults: parseInt(maxAdults, 10) || 2,
        maxChildren: parseInt(maxChildren, 10) || 0,
        amenities: selectedAmenities,
        isActive,
      };

      if (editingType) {
        await onUpdateRoomType(editingType.id, payload);
      } else {
        await onAddRoomType(payload);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save room type");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Room Types Catalog & Configuration
          </h3>
          <p className="text-xs text-slate-400">
            Define and manage room categories, tariffs, guest capacities, and inclusive amenities.
          </p>
        </div>
        <Button variant="gold" size="sm" onClick={openAddModal} className="flex items-center gap-1.5 font-semibold">
          <Plus className="w-4 h-4" /> Add Room Type
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roomTypes.map((rt) => (
          <div
            key={rt.id}
            className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/40 transition-colors group"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {rt.code}
                    </span>
                    <h4 className="font-bold text-white text-sm">{rt.name}</h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rt.description}</p>
                </div>
                <button
                  onClick={() => openEditModal(rt)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Edit Room Type"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Base Price</span>
                  <span className="font-bold text-amber-400 text-sm">{formatINR(rt.basePrice)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Max Capacity</span>
                  <span className="font-medium text-slate-300">
                    {rt.maxAdults} Adults, {rt.maxChildren} Children
                  </span>
                </div>
              </div>

              {/* Amenities */}
              <div className="mt-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                  Amenities ({(rt.amenities || []).length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {(rt.amenities || []).slice(0, 4).map((a, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300">
                      {a}
                    </span>
                  ))}
                  {(rt.amenities || []).length > 4 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                      +{(rt.amenities || []).length - 4} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                rt.isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400"
              }`}>
                {rt.isActive ? "Active in Booking Engine" : "Inactive"}
              </span>
              <button
                onClick={() => openEditModal(rt)}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
              >
                Configure &gt;
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingType ? `Edit Room Type: ${editingType.name}` : "Create New Room Type"}
        description="Configure room category code, base tariff rate, guest occupancy rules, and amenities."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Type Code (e.g. STD, DLX, SUI, PREM, FAM)"
              placeholder="e.g. FAM"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Input
              label="Type Name (Admin Configurable)"
              placeholder="e.g. Family Interconnected Suite"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <Input
            label="Description"
            placeholder="Brief overview of room ambiance, layout and views"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Base Price (₹ per night)"
              type="number"
              placeholder="5000"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
            />
            <Input
              label="Max Adults"
              type="number"
              value={maxAdults}
              onChange={(e) => setMaxAdults(e.target.value)}
              required
            />
            <Input
              label="Max Children"
              type="number"
              value={maxChildren}
              onChange={(e) => setMaxChildren(e.target.value)}
              required
            />
          </div>

          {/* Amenities Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Inclusive Amenities
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
              {ALL_AVAILABLE_AMENITIES.map((amenity) => {
                const checked = selectedAmenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-left text-xs border transition-colors ${
                      checked
                        ? "bg-amber-100 text-amber-900 border-amber-300 font-semibold"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border ${
                      checked ? "bg-amber-600 text-white border-amber-600" : "border-slate-300"
                    }`}>
                      {checked && "✓"}
                    </span>
                    <span className="truncate">{amenity}</span>
                  </button>
                );
              })}
            </div>

            {/* Add Custom Amenity */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Or add custom amenity (e.g. Sea View, Soundproof)"
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                className="flex h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddCustomAmenity}>
                + Add
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="rt-active-toggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="rt-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active in Room Catalog & Booking Engine
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={isSubmitting} className="flex items-center gap-1.5">
              {isSubmitting ? <span>Saving...</span> : <><Check className="w-4 h-4" /> Save Room Type</>}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
