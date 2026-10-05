import { prisma } from "../db/prisma";

export interface CreateAuditLogParams {
  hotelId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog(params: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        hotelId: params.hotelId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        previousValue: params.previousValue ? JSON.stringify(params.previousValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("❌ Failed to record audit log:", error);
    return null;
  }
}
