import { prisma } from "../db/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getAuditContext } from "../middleware/auditContext";
import { redactSensitive } from "../security/redaction";

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

type AuditClient = Prisma.TransactionClient | PrismaClient;

/**
 * Records an audit entry.
 *
 * Missing actor / IP / user-agent are filled from the request-scoped audit
 * context, and every payload is passed through `redactSensitive` first: the
 * trail keeps enough detail to reconstruct what changed, but never stores a
 * password, payment secret, API key or a full identity number.
 *
 * When an enclosing transaction client is supplied the write joins that
 * transaction and failures are NOT swallowed: an audit trail that can silently
 * drop entries is worthless for a PMS, so a failed log rolls the whole room move
 * back. Standalone calls (no client) stay best-effort so a logging outage can
 * never take down an unrelated request.
 */
export async function recordAuditLog(params: CreateAuditLogParams, client?: AuditClient) {
  const context = getAuditContext();

  const data = {
    // The property that owns the entity wins; the actor always comes from the
    // authenticated request context so a client cannot forge it.
    hotelId: params.hotelId ?? context?.hotelId ?? null,
    userId: context?.userId ?? params.userId ?? null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    previousValue: serialize(params.previousValue),
    newValue: serialize(params.newValue),
    ipAddress: context?.ipAddress ?? params.ipAddress ?? null,
    userAgent: context?.userAgent ?? params.userAgent ?? null,
  };

  if (client) {
    return await client.auditLog.create({ data });
  }

  try {
    return await prisma.auditLog.create({ data });
  } catch (error) {
    console.error("Failed to record audit log:", redactSensitive({ action: params.action, entity: params.entity }));
    if (error instanceof Error) console.error(error.message);
    return null;
  }
}

function serialize(value?: Record<string, unknown> | null): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(redactSensitive(value));
  } catch {
    return JSON.stringify({ error: "value not serializable" });
  }
}
