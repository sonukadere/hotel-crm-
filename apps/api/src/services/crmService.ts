import { prisma } from "../db/prisma";
import { LeadStatus } from "@hotel/types";
import { recordAuditLog } from "./auditService";

export async function searchGuests(query: string) {
  const clean = query.trim();
  return await prisma.guest.findMany({
    where: {
      OR: [
        { fullName: { contains: clean } },
        { mobile: { contains: clean } },
        { email: { contains: clean } },
        { corporateGstin: { contains: clean } },
      ],
    },
    include: {
      identities: true,
      loyaltyAccount: true,
      bookings: {
        take: 5,
        orderBy: { createdAt: "desc" },
      },
    },
    take: 20,
  });
}

export async function getGuestProfile(guestId: string) {
  return await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      identities: true,
      loyaltyAccount: {
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
      bookings: {
        include: {
          room: true,
          roomType: true,
          folio: {
            include: { payments: true },
          },
        },
        orderBy: { checkInDate: "desc" },
      },
      leads: true,
    },
  });
}

export async function createCRMLead(data: {
  hotelId: string;
  guestName: string;
  mobile: string;
  email?: string;
  source?: string;
  requirement?: string;
  expectedCheckIn?: string;
  expectedCheckOut?: string;
  guestCount?: number;
  notes?: string;
}) {
  return await prisma.cRMLead.create({
    data: {
      hotelId: data.hotelId,
      guestName: data.guestName,
      mobile: data.mobile,
      email: data.email,
      source: data.source || "Website",
      requirement: data.requirement,
      expectedCheckIn: data.expectedCheckIn ? new Date(data.expectedCheckIn) : undefined,
      expectedCheckOut: data.expectedCheckOut ? new Date(data.expectedCheckOut) : undefined,
      guestCount: data.guestCount || 2,
      notes: data.notes,
      status: "New",
    },
  });
}

export async function updateLeadStatus(leadId: string, status: LeadStatus, userId?: string) {
  const updated = await prisma.cRMLead.update({
    where: { id: leadId },
    data: { status: status as any },
  });

  await recordAuditLog({
    hotelId: updated.hotelId,
    userId,
    action: "CRM_LEAD_STATUS_UPDATED",
    entity: "CRMLead",
    entityId: leadId,
    newValue: { status },
  });

  return updated;
}

export async function getCRMLeads(hotelId?: string, status?: LeadStatus) {
  const where: any = {};
  if (hotelId) where.hotelId = hotelId;
  if (status) where.status = status;

  return await prisma.cRMLead.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}
