import { authFetch } from "./http";
import type { Room, RoomType, RatePlan, Floor, BedType, RoomStatus } from "@hotel/types";

const API_BASE = "http://localhost:4000/api";

// Default initial dataset adhering strictly to real hotel structure
export const INITIAL_BED_TYPES: BedType[] = [
  { id: "bed-1", name: "King", capacity: 2 },
  { id: "bed-2", name: "Queen", capacity: 2 },
  { id: "bed-3", name: "Twin", capacity: 2 },
  { id: "bed-4", name: "Single", capacity: 1 },
  { id: "bed-5", name: "Sofa Bed", capacity: 1 },
];

export const INITIAL_FLOORS: Floor[] = [
  { id: "fl-1", hotelId: "hotel-1", floorNumber: 1, name: "Ground & Heritage Floor", description: "Colonial high ceilings and lawn access" },
  { id: "fl-2", hotelId: "hotel-1", floorNumber: 2, name: "Royal Deluxe Floor", description: "Courtyard facing rooms with private balconies" },
  { id: "fl-3", hotelId: "hotel-1", floorNumber: 3, name: "Executive Suite Wing", description: "Top floor panoramic view suites with butler service" },
];

export const ALL_AVAILABLE_AMENITIES = [
  "High Speed WiFi",
  "Air Conditioning",
  "Tea/Coffee Maker",
  "Smart TV 55\"",
  "Private Balcony",
  "King Size Bed",
  "Mini Bar",
  "Work Desk",
  "Living Room Lounge",
  "Jacuzzi",
  "Butler Service",
  "Lounge Access",
  "Bathrobe & Slippers",
  "Electronic Safe",
  "Iron & Ironing Board",
  "Intercom Phone",
  "Hair Dryer",
];

export const INITIAL_ROOM_TYPES: RoomType[] = [
  {
    id: "rt-1",
    hotelId: "hotel-1",
    code: "STD",
    name: "Standard Heritage",
    description: "Elegant heritage-inspired room with modern amenities and high-speed Wi-Fi.",
    basePrice: 4200,
    baseAdults: 2,
    maxAdults: 2,
    maxChildren: 1,
    amenities: ["High Speed WiFi", "Air Conditioning", "Tea/Coffee Maker", "Smart TV 55\"", "Electronic Safe"],
    images: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80"],
    isActive: true,
  },
  {
    id: "rt-2",
    hotelId: "hotel-1",
    code: "DLX",
    name: "Deluxe Courtyard",
    description: "Spacious deluxe room with serene courtyard views, private balcony, and king bed.",
    basePrice: 6500,
    baseAdults: 2,
    maxAdults: 3,
    maxChildren: 2,
    amenities: ["Private Balcony", "King Size Bed", "High Speed WiFi", "Air Conditioning", "Mini Bar", "Work Desk", "Smart TV 55\""],
    images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80"],
    isActive: true,
  },
  {
    id: "rt-3",
    hotelId: "hotel-1",
    code: "SUI",
    name: "Maharaja Royal Suite",
    description: "Opulent palatial suite featuring living lounge, personal butler service, and private jacuzzi.",
    basePrice: 12500,
    baseAdults: 2,
    maxAdults: 4,
    maxChildren: 2,
    amenities: ["Living Room Lounge", "Jacuzzi", "Butler Service", "Lounge Access", "Bathrobe & Slippers", "High Speed WiFi", "Mini Bar"],
    images: ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80"],
    isActive: true,
  },
  {
    id: "rt-4",
    hotelId: "hotel-1",
    code: "PREM",
    name: "Premium Skyline",
    description: "Elevated high-floor rooms offering panoramic views of the city skyline and luxury bedding.",
    basePrice: 8500,
    baseAdults: 2,
    maxAdults: 3,
    maxChildren: 2,
    amenities: ["High Speed WiFi", "Air Conditioning", "Smart TV 55\"", "Mini Bar", "Work Desk", "Bathrobe & Slippers"],
    images: ["https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80"],
    isActive: true,
  },
  {
    id: "rt-5",
    hotelId: "hotel-1",
    code: "FAM",
    name: "Family Interconnected Suite",
    description: "Two interconnected spacious rooms designed specifically for traveling families.",
    basePrice: 10500,
    baseAdults: 4,
    maxAdults: 5,
    maxChildren: 3,
    amenities: ["High Speed WiFi", "Air Conditioning", "Smart TV 55\"", "Tea/Coffee Maker", "Electronic Safe", "Bathrobe & Slippers"],
    images: ["https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80"],
    isActive: true,
  },
];

export const INITIAL_RATE_PLANS: RatePlan[] = [
  {
    id: "rp-1",
    hotelId: "hotel-1",
    roomTypeId: "rt-1",
    code: "STD-EP",
    name: "Standard - EP (Room Only)",
    mealPlan: "EP",
    baseRate: 4200,
    seasonalMultiplier: 1.0,
    weekendMultiplier: 1.15,
    extraAdultRate: 800,
    extraChildRate: 400,
    isActive: true,
  },
  {
    id: "rp-2",
    hotelId: "hotel-1",
    roomTypeId: "rt-2",
    code: "DLX-CP",
    name: "Deluxe - CP (Buffet Breakfast)",
    mealPlan: "CP",
    baseRate: 7200,
    seasonalMultiplier: 1.0,
    weekendMultiplier: 1.15,
    extraAdultRate: 1000,
    extraChildRate: 500,
    isActive: true,
  },
  {
    id: "rp-3",
    hotelId: "hotel-1",
    roomTypeId: "rt-3",
    code: "SUI-MAP",
    name: "Maharaja Suite - MAP (Breakfast & Dinner)",
    mealPlan: "MAP",
    baseRate: 14500,
    seasonalMultiplier: 1.0,
    weekendMultiplier: 1.20,
    extraAdultRate: 1800,
    extraChildRate: 900,
    isActive: true,
  },
  {
    id: "rp-4",
    hotelId: "hotel-1",
    roomTypeId: "rt-4",
    code: "PREM-AP",
    name: "Premium - AP (All Meals Included)",
    mealPlan: "AP",
    baseRate: 11000,
    seasonalMultiplier: 1.05,
    weekendMultiplier: 1.20,
    extraAdultRate: 1500,
    extraChildRate: 750,
    isActive: true,
  },
];

export const INITIAL_ROOMS_DATA: Room[] = [
  { id: "r-101", hotelId: "hotel-1", roomNumber: "101", floorId: "fl-1", roomTypeId: "rt-1", bedTypeId: "bed-1", status: "Available", baseRate: 4200, isActive: true },
  { id: "r-102", hotelId: "hotel-1", roomNumber: "102", floorId: "fl-1", roomTypeId: "rt-1", bedTypeId: "bed-3", status: "Clean", baseRate: 4200, isActive: true },
  { id: "r-103", hotelId: "hotel-1", roomNumber: "103", floorId: "fl-1", roomTypeId: "rt-1", bedTypeId: "bed-2", status: "Dirty", baseRate: 4200, isActive: true },
  { id: "r-104", hotelId: "hotel-1", roomNumber: "104", floorId: "fl-1", roomTypeId: "rt-1", bedTypeId: "bed-1", status: "Maintenance", baseRate: 4200, isActive: true },
  { id: "r-201", hotelId: "hotel-1", roomNumber: "201", floorId: "fl-2", roomTypeId: "rt-2", bedTypeId: "bed-1", status: "Available", baseRate: 6500, isActive: true },
  { id: "r-202", hotelId: "hotel-1", roomNumber: "202", floorId: "fl-2", roomTypeId: "rt-2", bedTypeId: "bed-1", status: "Occupied", baseRate: 6500, isActive: true },
  { id: "r-203", hotelId: "hotel-1", roomNumber: "203", floorId: "fl-2", roomTypeId: "rt-2", bedTypeId: "bed-3", status: "Clean", baseRate: 6500, isActive: true },
  { id: "r-204", hotelId: "hotel-1", roomNumber: "204", floorId: "fl-2", roomTypeId: "rt-2", bedTypeId: "bed-1", status: "Blocked", baseRate: 6500, isActive: true },
  { id: "r-301", hotelId: "hotel-1", roomNumber: "301", floorId: "fl-3", roomTypeId: "rt-3", bedTypeId: "bed-1", status: "Available", baseRate: 12500, isActive: true },
  { id: "r-302", hotelId: "hotel-1", roomNumber: "302", floorId: "fl-3", roomTypeId: "rt-3", bedTypeId: "bed-1", status: "Occupied", baseRate: 12500, isActive: true },
];

export async function fetchRoomsApi(): Promise<Room[]> {
  try {
    const res = await authFetch(`${API_BASE}/rooms`, { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    }
  } catch (_e) {
    // API server offline, use stored or initial
  }
  return INITIAL_ROOMS_DATA;
}

export async function createRoomApi(roomData: Partial<Room>): Promise<Room> {
  try {
    const res = await authFetch(`${API_BASE}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roomData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return {
    id: `r-${Date.now()}`,
    hotelId: "hotel-1",
    roomNumber: roomData.roomNumber || "000",
    floorId: roomData.floorId || "fl-1",
    roomTypeId: roomData.roomTypeId || "rt-1",
    bedTypeId: roomData.bedTypeId,
    status: roomData.status || "Available",
    baseRate: roomData.baseRate || 4200,
    isActive: roomData.isActive ?? true,
  };
}

export async function updateRoomApi(id: string, roomData: Partial<Room>): Promise<Room> {
  try {
    const res = await authFetch(`${API_BASE}/rooms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roomData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return { id, ...roomData } as Room;
}

export async function deleteRoomApi(id: string): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/rooms/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) return true;
  } catch (_e) {}
  return true;
}

export async function updateRoomStatusApi(id: string, status: RoomStatus): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/rooms/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) return true;
  } catch (_e) {}
  return true;
}

export async function bulkUpdateRoomStatusApi(roomIds: string[], status: RoomStatus): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/rooms/bulk-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomIds, status }),
    });
    if (res.ok) return true;
  } catch (_e) {}
  return true;
}

export async function fetchRoomTypesApi(): Promise<RoomType[]> {
  try {
    const res = await authFetch(`${API_BASE}/room-types`, { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    }
  } catch (_e) {}
  return INITIAL_ROOM_TYPES;
}

export async function createRoomTypeApi(typeData: Partial<RoomType>): Promise<RoomType> {
  try {
    const res = await authFetch(`${API_BASE}/room-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(typeData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return {
    id: `rt-${Date.now()}`,
    hotelId: "hotel-1",
    code: typeData.code || "NEW",
    name: typeData.name || "New Type",
    description: typeData.description || "",
    basePrice: typeData.basePrice || 5000,
    baseAdults: typeData.baseAdults ?? 2,
    maxAdults: typeData.maxAdults ?? 3,
    maxChildren: typeData.maxChildren ?? 2,
    amenities: typeData.amenities || [],
    images: typeData.images || [],
    isActive: typeData.isActive ?? true,
  };
}

export async function updateRoomTypeApi(id: string, typeData: Partial<RoomType>): Promise<RoomType> {
  try {
    const res = await authFetch(`${API_BASE}/room-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(typeData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return { id, ...typeData } as RoomType;
}

export async function deleteRoomTypeApi(id: string): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/room-types/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) return true;
  } catch (_e) {}
  return true;
}

export async function fetchRatePlansApi(): Promise<RatePlan[]> {
  try {
    const res = await authFetch(`${API_BASE}/rate-plans`, { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    }
  } catch (_e) {}
  return INITIAL_RATE_PLANS;
}

export async function createRatePlanApi(planData: Partial<RatePlan>): Promise<RatePlan> {
  try {
    const res = await authFetch(`${API_BASE}/rate-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return {
    id: `rp-${Date.now()}`,
    hotelId: "hotel-1",
    roomTypeId: planData.roomTypeId || "rt-1",
    code: planData.code || "PLAN",
    name: planData.name || "Custom Plan",
    mealPlan: planData.mealPlan || "EP",
    baseRate: planData.baseRate || 5000,
    seasonalMultiplier: planData.seasonalMultiplier || 1.0,
    weekendMultiplier: planData.weekendMultiplier || 1.15,
    extraAdultRate: planData.extraAdultRate || 800,
    extraChildRate: planData.extraChildRate || 400,
    isActive: planData.isActive ?? true,
  };
}

export async function updateRatePlanApi(id: string, planData: Partial<RatePlan>): Promise<RatePlan> {
  try {
    const res = await authFetch(`${API_BASE}/rate-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return { id, ...planData } as RatePlan;
}

export async function deleteRatePlanApi(id: string): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/rate-plans/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) return true;
  } catch (_e) {}
  return true;
}

export async function fetchFloorsApi(): Promise<Floor[]> {
  try {
    const res = await authFetch(`${API_BASE}/floors`, { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    }
  } catch (_e) {}
  return INITIAL_FLOORS;
}

export async function createFloorApi(floorData: Partial<Floor>): Promise<Floor> {
  try {
    const res = await authFetch(`${API_BASE}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(floorData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return {
    id: `fl-${Date.now()}`,
    hotelId: "hotel-1",
    floorNumber: floorData.floorNumber || 1,
    name: floorData.name || "Floor",
    description: floorData.description,
  };
}

export async function fetchBedTypesApi(): Promise<BedType[]> {
  try {
    const res = await authFetch(`${API_BASE}/bed-types`, { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    }
  } catch (_e) {}
  return INITIAL_BED_TYPES;
}

export async function createBedTypeApi(bedData: Partial<BedType>): Promise<BedType> {
  try {
    const res = await authFetch(`${API_BASE}/bed-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bedData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) return data.data;
    }
  } catch (_e) {}
  return {
    id: `bed-${Date.now()}`,
    name: bedData.name || "Double",
    capacity: bedData.capacity || 2,
  };
}
