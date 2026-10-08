import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

/**
 * Request-scoped audit context.
 *
 * Every request runs inside an AsyncLocalStorage store carrying the caller's
 * identity plus the transport details (IP, user agent). `recordAuditLog`
 * picks these up automatically, so audit entries produced deep inside a
 * service always know *who* did *what* from *where* - without threading a
 * context object through forty call sites.
 */

export interface AuditContext {
  userId?: string;
  hotelId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<AuditContext>();

export function getAuditContext(): AuditContext | undefined {
  return storage.getStore();
}

export function setAuditActor(actor: { userId?: string; hotelId?: string }): void {
  const store = storage.getStore();
  if (!store) return;
  if (actor.userId) store.userId = actor.userId;
  if (actor.hotelId) store.hotelId = actor.hotelId;
}

function clientIp(req: Request): string | undefined {
  // `req.ip` honours the `trust proxy` setting; only trust X-Forwarded-For
  // when the app is explicitly configured to sit behind a proxy.
  const ip = req.ip || req.socket.remoteAddress || undefined;
  if (!ip) return undefined;
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function auditContextMiddleware(req: Request, _res: unknown, next: (error?: unknown) => void): void {
  const context: AuditContext = {
    ipAddress: clientIp(req),
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 512) : undefined,
  };
  storage.run(context, () => next());
}
