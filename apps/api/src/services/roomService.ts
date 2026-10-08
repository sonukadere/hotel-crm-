import { prisma } from "../db/prisma";
import { RoomStatus, MealPlan } from "@hotel/types";
import { recordAuditLog } from "./auditService";

export interface RoomFilterOptions {
  hotelId?: string;
  status?: RoomStatus;
  floorId?: string;
  roomTypeId?: string;
  search?: string;
  isActive?: boolean;
}

export async function getDefaultHotelId(): Promise<string> {
  const hotel = await prisma.hotel.findFirst();
  if (hotel) return hotel.id;

  const created = await prisma.hotel.create({
    data: {
      code: "HOTEL-001",
      name: "Grand Rajwada Palace & Suites",
      gstin: "27AAAAA0000A1Z5",
      stateCode: "27",
      address: "1 Palace Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      phone: "+91 98200 12345",
      email: "info@grandrajwada.com",
    },
  });
  return created.id;
}

// =============================================================================
// ROOMS
// =============================================================================

export async function getRooms(filter: RoomFilterOptions) {
  const where: any = {};

  if (filter.hotelId) where.hotelId = filter.hotelId;
  if (filter.status) where.status = filter.status;
  if (filter.floorId) where.floorId = filter.floorId;
  if (filter.roomTypeId) where.roomTypeId = filter.roomTypeId;
  if (filter.isActive !== undefined) where.isActive = filter.isActive;
  if (filter.search) {
    where.OR = [
      { roomNumber: { contains: filter.search } },
      { roomType: { name: { contains: filter.search } } },
    ];
  }

  const rooms = await prisma.room.findMany({
    where,
    include: {
      floor: true,
      roomType: true,
      bedType: true,
      bookings: {
        where: {
          status: { in: ["CheckedIn", "Confirmed"] },
        },
        include: {
          primaryGuest: true,
        },
        take: 1,
      },
    },
    orderBy: { roomNumber: "asc" },
  });

  return rooms.map((r) => ({
    ...r,
    baseRate: r.baseRate ? Number(r.baseRate) : (r.roomType ? Number(r.roomType.basePrice) : 0),
    roomType: r.roomType
      ? {
          ...r.roomType,
          basePrice: Number(r.roomType.basePrice),
          amenities: typeof r.roomType.amenities === "string" ? JSON.parse(r.roomType.amenities || "[]") : r.roomType.amenities,
          images: typeof r.roomType.images === "string" ? JSON.parse(r.roomType.images || "[]") : r.roomType.images,
        }
      : undefined,
  }));
}

export async function getRoomById(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      floor: true,
      roomType: {
        include: {
          ratePlans: true,
        },
      },
      bedType: true,
      bookings: {
        include: {
          primaryGuest: true,
        },
        orderBy: { checkInDate: "desc" },
        take: 5,
      },
    },
  });

  if (!room) return null;

  return {
    ...room,
    baseRate: room.baseRate ? Number(room.baseRate) : (room.roomType ? Number(room.roomType.basePrice) : 0),
    roomType: room.roomType
      ? {
          ...room.roomType,
          basePrice: Number(room.roomType.basePrice),
          amenities: typeof room.roomType.amenities === "string" ? JSON.parse(room.roomType.amenities || "[]") : room.roomType.amenities,
          images: typeof room.roomType.images === "string" ? JSON.parse(room.roomType.images || "[]") : room.roomType.images,
          ratePlans: room.roomType.ratePlans.map((rp) => ({
            ...rp,
            baseRate: Number(rp.baseRate),
            seasonalMultiplier: Number(rp.seasonalMultiplier),
            weekendMultiplier: Number(rp.weekendMultiplier),
            extraAdultRate: Number(rp.extraAdultRate),
            extraChildRate: Number(rp.extraChildRate),
          })),
        }
      : undefined,
  };
}

export async function createRoom(data: {
  hotelId?: string;
  roomNumber: string;
  floorId: string;
  roomTypeId: string;
  bedTypeId?: string;
  status?: RoomStatus;
  baseRate?: number;
  isActive?: boolean;
}) {
  const hotelId = data.hotelId || (await getDefaultHotelId());

  const room = await prisma.room.create({
    data: {
      hotelId,
      roomNumber: data.roomNumber,
      floorId: data.floorId,
      roomTypeId: data.roomTypeId,
      bedTypeId: data.bedTypeId,
      status: (data.status as any) || "Available",
      baseRate: data.baseRate !== undefined ? (data.baseRate as any) : undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    include: {
      floor: true,
      roomType: true,
      bedType: true,
    },
  });

  await recordAuditLog({
    hotelId,
    action: "ROOM_CREATED",
    entity: "Room",
    entityId: room.id,
    newValue: room as any,
  });

  return {
    ...room,
    baseRate: room.baseRate ? Number(room.baseRate) : (room.roomType ? Number(room.roomType.basePrice) : 0),
    roomType: room.roomType
      ? {
          ...room.roomType,
          basePrice: Number(room.roomType.basePrice),
          amenities: typeof room.roomType.amenities === "string" ? JSON.parse(room.roomType.amenities || "[]") : room.roomType.amenities,
          images: typeof room.roomType.images === "string" ? JSON.parse(room.roomType.images || "[]") : room.roomType.images,
        }
      : undefined,
  };
}

export async function updateRoom(
  id: string,
  data: {
    roomNumber?: string;
    floorId?: string;
    roomTypeId?: string;
    bedTypeId?: string | null;
    status?: RoomStatus;
    baseRate?: number | null;
    isActive?: boolean;
  },
  userId?: string,
) {
  const previous = await prisma.room.findUnique({ where: { id } });
  if (!previous) throw new Error(`Room with ID ${id} not found`);

  const updateData: any = {};
  if (data.roomNumber !== undefined) updateData.roomNumber = data.roomNumber;
  if (data.floorId !== undefined) updateData.floorId = data.floorId;
  if (data.roomTypeId !== undefined) updateData.roomTypeId = data.roomTypeId;
  if (data.bedTypeId !== undefined) updateData.bedTypeId = data.bedTypeId;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.baseRate !== undefined) updateData.baseRate = data.baseRate;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.room.update({
    where: { id },
    data: updateData,
    include: {
      floor: true,
      roomType: true,
      bedType: true,
    },
  });

  await recordAuditLog({
    hotelId: updated.hotelId,
    userId,
    action: "ROOM_UPDATED",
    entity: "Room",
    entityId: id,
    previousValue: previous as any,
    newValue: updated as any,
  });

  return {
    ...updated,
    baseRate: updated.baseRate ? Number(updated.baseRate) : (updated.roomType ? Number(updated.roomType.basePrice) : 0),
    roomType: updated.roomType
      ? {
          ...updated.roomType,
          basePrice: Number(updated.roomType.basePrice),
          amenities: typeof updated.roomType.amenities === "string" ? JSON.parse(updated.roomType.amenities || "[]") : updated.roomType.amenities,
          images: typeof updated.roomType.images === "string" ? JSON.parse(updated.roomType.images || "[]") : updated.roomType.images,
        }
      : undefined,
  };
}

export async function deleteRoom(id: string, userId?: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: { bookings: { where: { status: { in: ["CheckedIn", "Confirmed"] } } } },
  });

  if (!room) throw new Error(`Room with ID ${id} not found`);

  if (room.bookings && room.bookings.length > 0) {
    // If active bookings exist, deactivate instead of hard delete to preserve integrity
    const deactivated = await prisma.room.update({
      where: { id },
      data: { isActive: false, status: "Blocked" },
    });
    await recordAuditLog({
      hotelId: room.hotelId,
      userId,
      action: "ROOM_DEACTIVATED",
      entity: "Room",
      entityId: id,
      previousValue: { isActive: room.isActive, status: room.status },
      newValue: { isActive: false, status: "Blocked" },
    });
    return { success: true, message: "Room has active bookings; deactivated instead of deletion", room: deactivated };
  }

  // Soft delete / deactivate room
  const deactivated = await prisma.room.update({
    where: { id },
    data: { isActive: false },
  });

  await recordAuditLog({
    hotelId: room.hotelId,
    userId,
    action: "ROOM_DEACTIVATED",
    entity: "Room",
    entityId: id,
    previousValue: { isActive: true },
    newValue: { isActive: false },
  });

  return { success: true, message: "Room deactivated successfully", room: deactivated };
}

export async function updateRoomStatus(id: string, newStatus: RoomStatus, userId?: string) {
  const previous = await prisma.room.findUnique({ where: { id } });
  if (!previous) throw new Error(`Room with ID ${id} not found`);

  const updated = await prisma.room.update({
    where: { id },
    data: { status: newStatus as any },
    include: { floor: true, roomType: true, bedType: true },
  });

  await recordAuditLog({
    hotelId: updated.hotelId,
    userId,
    action: "ROOM_STATUS_UPDATED",
    entity: "Room",
    entityId: id,
    previousValue: { status: previous.status },
    newValue: { status: newStatus },
  });

  return updated;
}

export async function bulkUpdateRoomStatus(
  roomIds: string[],
  newStatus: RoomStatus,
  userId?: string,
) {
  const updated = await prisma.room.updateMany({
    where: { id: { in: roomIds } },
    data: { status: newStatus as any },
  });

  for (const id of roomIds) {
    await recordAuditLog({
      userId,
      action: "ROOM_STATUS_BULK_UPDATED",
      entity: "Room",
      entityId: id,
      newValue: { status: newStatus },
    });
  }

  return { count: updated.count, status: newStatus };
}

// =============================================================================
// ROOM TYPES
// =============================================================================

export async function getRoomTypes(hotelId?: string) {
  const resolvedHotelId = hotelId || (await getDefaultHotelId());

  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId: resolvedHotelId },
    include: {
      ratePlans: true,
      rooms: {
        select: { id: true, roomNumber: true, status: true, isActive: true },
      },
    },
    orderBy: { basePrice: "asc" },
  });

  return roomTypes.map((rt) => ({
    ...rt,
    basePrice: Number(rt.basePrice),
    amenities: typeof rt.amenities === "string" ? JSON.parse(rt.amenities || "[]") : rt.amenities,
    images: typeof rt.images === "string" ? JSON.parse(rt.images || "[]") : rt.images,
    ratePlans: rt.ratePlans.map((rp) => ({
      ...rp,
      baseRate: Number(rp.baseRate),
      seasonalMultiplier: Number(rp.seasonalMultiplier),
      weekendMultiplier: Number(rp.weekendMultiplier),
      extraAdultRate: Number(rp.extraAdultRate),
      extraChildRate: Number(rp.extraChildRate),
    })),
    roomsCount: rt.rooms.length,
  }));
}

export async function createRoomType(data: {
  hotelId?: string;
  code: string;
  name: string;
  description?: string;
  basePrice: number;
  baseAdults?: number;
  maxAdults?: number;
  maxChildren?: number;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
}) {
  const hotelId = data.hotelId || (await getDefaultHotelId());

  const created = await prisma.roomType.create({
    data: {
      hotelId,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      basePrice: data.basePrice as any,
      baseAdults: data.baseAdults ?? 2,
      maxAdults: data.maxAdults ?? 3,
      maxChildren: data.maxChildren ?? 2,
      amenities: JSON.stringify(data.amenities || []),
      images: JSON.stringify(data.images || []),
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  // Automatically create a default European Plan (EP) rate plan for this room type
  await prisma.ratePlan.create({
    data: {
      hotelId,
      roomTypeId: created.id,
      code: `${created.code}-EP`,
      name: `${created.name} - EP (Room Only)`,
      mealPlan: "EP",
      baseRate: data.basePrice as any,
      seasonalMultiplier: 1.0,
      weekendMultiplier: 1.15,
      extraAdultRate: 800.0,
      extraChildRate: 400.0,
      isActive: true,
    },
  });

  return {
    ...created,
    basePrice: Number(created.basePrice),
    amenities: data.amenities || [],
    images: data.images || [],
  };
}

export async function updateRoomType(
  id: string,
  data: {
    code?: string;
    name?: string;
    description?: string;
    basePrice?: number;
    baseAdults?: number;
    maxAdults?: number;
    maxChildren?: number;
    amenities?: string[];
    images?: string[];
    isActive?: boolean;
  },
) {
  const updateData: any = {};
  if (data.code !== undefined) updateData.code = data.code.toUpperCase();
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
  if (data.baseAdults !== undefined) updateData.baseAdults = data.baseAdults;
  if (data.maxAdults !== undefined) updateData.maxAdults = data.maxAdults;
  if (data.maxChildren !== undefined) updateData.maxChildren = data.maxChildren;
  if (data.amenities !== undefined) updateData.amenities = JSON.stringify(data.amenities);
  if (data.images !== undefined) updateData.images = JSON.stringify(data.images);
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.roomType.update({
    where: { id },
    data: updateData,
  });

  return {
    ...updated,
    basePrice: Number(updated.basePrice),
    amenities: typeof updated.amenities === "string" ? JSON.parse(updated.amenities || "[]") : updated.amenities,
    images: typeof updated.images === "string" ? JSON.parse(updated.images || "[]") : updated.images,
  };
}

export async function getRoomTypeById(id: string) {
  const rt = await prisma.roomType.findUnique({
    where: { id },
    include: {
      ratePlans: true,
      rooms: {
        select: { id: true, roomNumber: true, status: true, isActive: true },
      },
    },
  });

  if (!rt) return null;

  return {
    ...rt,
    basePrice: Number(rt.basePrice),
    amenities: typeof rt.amenities === "string" ? JSON.parse(rt.amenities || "[]") : rt.amenities,
    images: typeof rt.images === "string" ? JSON.parse(rt.images || "[]") : rt.images,
    ratePlans: rt.ratePlans.map((rp) => ({
      ...rp,
      baseRate: Number(rp.baseRate),
      seasonalMultiplier: Number(rp.seasonalMultiplier),
      weekendMultiplier: Number(rp.weekendMultiplier),
      extraAdultRate: Number(rp.extraAdultRate),
      extraChildRate: Number(rp.extraChildRate),
    })),
    roomsCount: rt.rooms.length,
  };
}

export async function deleteRoomType(id: string) {
  const rt = await prisma.roomType.findUnique({
    where: { id },
    include: { rooms: true },
  });
  if (!rt) throw new Error(`Room type with ID ${id} not found`);

  if (rt.rooms && rt.rooms.length > 0) {
    // If rooms exist under this type, deactivate to protect inventory integrity
    const updated = await prisma.roomType.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true, message: "Room type has assigned rooms; deactivated instead of deletion", roomType: updated };
  }

  const deactivated = await prisma.roomType.update({
    where: { id },
    data: { isActive: false },
  });
  return { success: true, message: "Room type deactivated successfully", roomType: deactivated };
}

// =============================================================================
// RATE PLANS
// =============================================================================

export async function getRatePlans(hotelId?: string, roomTypeId?: string) {
  const resolvedHotelId = hotelId || (await getDefaultHotelId());
  const where: any = { hotelId: resolvedHotelId };
  if (roomTypeId) where.roomTypeId = roomTypeId;

  const plans = await prisma.ratePlan.findMany({
    where,
    include: {
      roomType: true,
    },
    orderBy: { baseRate: "asc" },
  });

  return plans.map((p) => ({
    ...p,
    baseRate: Number(p.baseRate),
    seasonalMultiplier: Number(p.seasonalMultiplier),
    weekendMultiplier: Number(p.weekendMultiplier),
    extraAdultRate: Number(p.extraAdultRate),
    extraChildRate: Number(p.extraChildRate),
    roomType: p.roomType
      ? {
          ...p.roomType,
          basePrice: Number(p.roomType.basePrice),
          amenities: typeof p.roomType.amenities === "string" ? JSON.parse(p.roomType.amenities || "[]") : p.roomType.amenities,
        }
      : undefined,
  }));
}

export async function createRatePlan(data: {
  hotelId?: string;
  roomTypeId: string;
  code: string;
  name: string;
  mealPlan?: MealPlan;
  baseRate: number;
  seasonalMultiplier?: number;
  weekendMultiplier?: number;
  extraAdultRate?: number;
  extraChildRate?: number;
  isActive?: boolean;
}) {
  const hotelId = data.hotelId || (await getDefaultHotelId());

  const plan = await prisma.ratePlan.create({
    data: {
      hotelId,
      roomTypeId: data.roomTypeId,
      code: data.code.toUpperCase(),
      name: data.name,
      mealPlan: (data.mealPlan as any) || "EP",
      baseRate: data.baseRate as any,
      seasonalMultiplier: (data.seasonalMultiplier ?? 1.0) as any,
      weekendMultiplier: (data.weekendMultiplier ?? 1.15) as any,
      extraAdultRate: (data.extraAdultRate ?? 800.0) as any,
      extraChildRate: (data.extraChildRate ?? 400.0) as any,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    include: {
      roomType: true,
    },
  });

  return {
    ...plan,
    baseRate: Number(plan.baseRate),
    seasonalMultiplier: Number(plan.seasonalMultiplier),
    weekendMultiplier: Number(plan.weekendMultiplier),
    extraAdultRate: Number(plan.extraAdultRate),
    extraChildRate: Number(plan.extraChildRate),
  };
}

export async function updateRatePlan(
  id: string,
  data: {
    name?: string;
    code?: string;
    mealPlan?: MealPlan;
    baseRate?: number;
    seasonalMultiplier?: number;
    weekendMultiplier?: number;
    extraAdultRate?: number;
    extraChildRate?: number;
    isActive?: boolean;
  },
) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.code !== undefined) updateData.code = data.code.toUpperCase();
  if (data.mealPlan !== undefined) updateData.mealPlan = data.mealPlan;
  if (data.baseRate !== undefined) updateData.baseRate = data.baseRate;
  if (data.seasonalMultiplier !== undefined) updateData.seasonalMultiplier = data.seasonalMultiplier;
  if (data.weekendMultiplier !== undefined) updateData.weekendMultiplier = data.weekendMultiplier;
  if (data.extraAdultRate !== undefined) updateData.extraAdultRate = data.extraAdultRate;
  if (data.extraChildRate !== undefined) updateData.extraChildRate = data.extraChildRate;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const plan = await prisma.ratePlan.update({
    where: { id },
    data: updateData,
    include: { roomType: true },
  });

  return {
    ...plan,
    baseRate: Number(plan.baseRate),
    seasonalMultiplier: Number(plan.seasonalMultiplier),
    weekendMultiplier: Number(plan.weekendMultiplier),
    extraAdultRate: Number(plan.extraAdultRate),
    extraChildRate: Number(plan.extraChildRate),
  };
}

export async function getRatePlanById(id: string) {
  const plan = await prisma.ratePlan.findUnique({
    where: { id },
    include: { roomType: true },
  });

  if (!plan) return null;

  return {
    ...plan,
    baseRate: Number(plan.baseRate),
    seasonalMultiplier: Number(plan.seasonalMultiplier),
    weekendMultiplier: Number(plan.weekendMultiplier),
    extraAdultRate: Number(plan.extraAdultRate),
    extraChildRate: Number(plan.extraChildRate),
    roomType: plan.roomType
      ? {
          ...plan.roomType,
          basePrice: Number(plan.roomType.basePrice),
          amenities: typeof plan.roomType.amenities === "string" ? JSON.parse(plan.roomType.amenities || "[]") : plan.roomType.amenities,
        }
      : undefined,
  };
}

export async function deleteRatePlan(id: string) {
  const plan = await prisma.ratePlan.findUnique({ where: { id } });
  if (!plan) throw new Error(`Rate plan with ID ${id} not found`);

  const updated = await prisma.ratePlan.update({
    where: { id },
    data: { isActive: false },
  });
  return { success: true, message: "Rate plan deactivated successfully", ratePlan: updated };
}

// =============================================================================
// FLOORS & BED TYPES
// =============================================================================

export async function getFloors(hotelId?: string) {
  const resolvedHotelId = hotelId || (await getDefaultHotelId());
  return await prisma.floor.findMany({
    where: { hotelId: resolvedHotelId },
    include: {
      rooms: { select: { id: true, roomNumber: true, status: true } },
    },
    orderBy: { floorNumber: "asc" },
  });
}

export async function createFloor(data: { hotelId?: string; floorNumber: number; name: string; description?: string }) {
  const hotelId = data.hotelId || (await getDefaultHotelId());
  return await prisma.floor.create({
    data: {
      hotelId,
      floorNumber: data.floorNumber,
      name: data.name,
      description: data.description,
    },
  });
}

export async function getBedTypes() {
  return await prisma.bedType.findMany({
    include: {
      rooms: { select: { id: true, roomNumber: true } },
    },
    orderBy: { capacity: "desc" },
  });
}

export async function createBedType(data: { name: string; capacity?: number }) {
  return await prisma.bedType.create({
    data: {
      name: data.name,
      capacity: data.capacity ?? 2,
    },
  });
}
