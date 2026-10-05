import { prisma } from "../db/prisma";
import { RoomStatus } from "@hotel/types";
import { recordAuditLog } from "./auditService";

export interface RoomFilterOptions {
  hotelId?: string;
  status?: RoomStatus;
  floorId?: string;
  roomTypeId?: string;
  search?: string;
}

export async function getRooms(filter: RoomFilterOptions) {
  const where: any = {};

  if (filter.hotelId) where.hotelId = filter.hotelId;
  if (filter.status) where.status = filter.status;
  if (filter.floorId) where.floorId = filter.floorId;
  if (filter.roomTypeId) where.roomTypeId = filter.roomTypeId;
  if (filter.search) {
    where.OR = [
      { roomNumber: { contains: filter.search } },
      { roomType: { name: { contains: filter.search } } },
    ];
  }

  return await prisma.room.findMany({
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
}

export async function getRoomById(id: string) {
  return await prisma.room.findUnique({
    where: { id },
    include: {
      floor: true,
      roomType: true,
      bedType: true,
    },
  });
}

export async function createRoom(data: {
  hotelId: string;
  roomNumber: string;
  floorId: string;
  roomTypeId: string;
  bedTypeId?: string;
  status?: RoomStatus;
  baseRate?: number;
}) {
  const room = await prisma.room.create({
    data: {
      hotelId: data.hotelId,
      roomNumber: data.roomNumber,
      floorId: data.floorId,
      roomTypeId: data.roomTypeId,
      bedTypeId: data.bedTypeId,
      status: (data.status as any) || "Available",
      baseRate: data.baseRate ? (data.baseRate as any) : undefined,
    },
    include: {
      floor: true,
      roomType: true,
      bedType: true,
    },
  });

  await recordAuditLog({
    hotelId: data.hotelId,
    action: "ROOM_CREATED",
    entity: "Room",
    entityId: room.id,
    newValue: room as any,
  });

  return room;
}

export async function updateRoomStatus(id: string, newStatus: RoomStatus, userId?: string) {
  const previous = await prisma.room.findUnique({ where: { id } });
  if (!previous) throw new Error(`Room with ID ${id} not found`);

  const updated = await prisma.room.update({
    where: { id },
    data: { status: newStatus as any },
    include: { floor: true, roomType: true },
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

  return updated;
}

export async function getRoomTypes(hotelId?: string) {
  return await prisma.roomType.findMany({
    where: hotelId ? { hotelId } : {},
    include: {
      ratePlans: true,
    },
  });
}

export async function getRatePlans(hotelId?: string) {
  return await prisma.ratePlan.findMany({
    where: hotelId ? { hotelId } : {},
    include: {
      roomType: true,
    },
  });
}
