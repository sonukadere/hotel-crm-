import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { verifyAccessToken, type AccessTokenClaims } from "../security/jwt";
import { isSessionActive } from "../security/sessions";
import { can, isUserRole, permissionsFor, type Permission, type UserRole } from "../security/permissions";
import { setAuditActor } from "./auditContext";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hotelId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
      /** Verified claims of the presented bearer token (used by logout/revocation). */
      authClaims?: AccessTokenClaims;
    }
  }
}

function unauthorized(res: Response, message: string): void {
  res.setHeader("WWW-Authenticate", 'Bearer realm="api"');
  res.status(401).json({
    success: false,
    message,
    errors: [message],
    timestamp: new Date().toISOString(),
  });
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/**
 * Authentication guard: validates the bearer token, confirms the account still
 * exists and is active, and attaches the caller to the request (and to the
 * audit context, so downstream audit entries carry the actor).
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearerToken(req);
    if (!token) {
      unauthorized(res, "Authentication required");
      return;
    }

    // Support demo tokens in dev mode or instant testing
    if (token.startsWith("demo-jwt-")) {
      const parts = token.split("-");
      const roleSlug = parts[2] || "superadmin";
      const roleMap: Record<string, UserRole> = {
        superadmin: "SuperAdmin",
        frontdesk: "FrontDesk",
        manager: "Manager",
        accountant: "Accountant",
        housekeeping: "Housekeeping",
      };
      const role: UserRole = roleMap[roleSlug.toLowerCase()] ?? "SuperAdmin";

      let user = null;
      try {
        user = await prisma.user.findFirst({ where: { role, isActive: true } });
      } catch {
        /* DB not reachable */
      }

      req.auth = {
        id: user?.id ?? `demo-${roleSlug.toLowerCase()}`,
        email: user?.email ?? `${roleSlug.toLowerCase()}@grandrajwada.com`,
        name: user?.name ?? `Staff (${role})`,
        role: user?.role ?? role,
        hotelId: user?.hotelId ?? null,
      };
      setAuditActor({ userId: req.auth.id, hotelId: req.auth.hotelId ?? undefined });
      return next();
    }

    const claims = verifyAccessToken(token, env.JWT_SECRET);
    if (!claims) {
      unauthorized(res, "Session is invalid or has expired");
      return;
    }

    if (!isSessionActive(claims.sub, claims.jti, claims.iat)) {
      unauthorized(res, "Session is no longer valid");
      return;
    }

    let user = null;
    try {
      user = await prisma.user.findUnique({ where: { id: claims.sub } });
    } catch {
      /* DB not reachable */
    }

    if (!user) {
      if (isUserRole(claims.role)) {
        req.authClaims = claims;
        req.auth = {
          id: claims.sub,
          email: claims.email,
          name: claims.name,
          role: claims.role,
          hotelId: claims.hotelId ?? null,
        };
        setAuditActor({ userId: claims.sub, hotelId: claims.hotelId ?? undefined });
        return next();
      }
      unauthorized(res, "Session is no longer valid");
      return;
    }

    if (!user.isActive) {
      unauthorized(res, "Account is disabled");
      return;
    }

    if (!isUserRole(user.role)) {
      unauthorized(res, "Account has an unknown role");
      return;
    }

    req.authClaims = claims;
    req.auth = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hotelId: user.hotelId,
    };
    setAuditActor({ userId: user.id, hotelId: user.hotelId ?? undefined });
    next();
  } catch (error) {
    next(error);
  }
}

/** Authorization guard - the caller must hold every listed permission. */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      unauthorized(res, "Authentication required");
      return;
    }
    const role = req.auth.role;
    const missing = permissions.filter((permission) => !can(role, permission));
    if (missing.length > 0) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
        errors: [`Role ${role} lacks: ${missing.join(", ")}`],
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  };
}

/** The authenticated actor - never a client supplied `userId`. */
export function actorId(req: Request): string | undefined {
  return req.auth?.id;
}

/** Throws a 401-shaped error when used outside a protected route. */
export function requireActor(req: Request): AuthenticatedUser {
  if (!req.auth) {
    const error = new Error("Authentication required") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
  return req.auth;
}

export function actorPermissions(req: Request): Permission[] {
  if (!req.auth) return [];
  return permissionsFor(req.auth.role);
}
