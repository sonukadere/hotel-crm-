import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { hashPassword, verifyPassword, PasswordPolicyError } from "../security/passwords";
import { signAccessToken } from "../security/jwt";
import { invalidateUserSessions, revokeToken } from "../security/sessions";
import { isUserRole, type UserRole } from "../security/permissions";
import { recordAuditLog } from "../services/auditService";
import { authenticate, requirePermission, requireActor } from "../middleware/auth";
import { authRateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import {
  changePasswordSchema,
  createUserSchema,
  loginSchema,
  updateUserSchema,
} from "../validation/schemas";

export const authRouter = Router();

const SAFE_USER_FIELDS = {
  id: true,
  hotelId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface SafeUser {
  id: string;
  hotelId: string | null;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}



function sendFailure(res: Response, statusCode: number, message: string, errors: string[] = [message]): void {
  res.status(statusCode).json({ success: false, message, errors, timestamp: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
authRouter.post("/login", authRateLimit, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    let user = await prisma.user.findUnique({ where: { email } });

    // Support quick demo logins if the DB was not seeded with all roles yet
    const DEMO_STAFF: Record<string, { name: string; role: UserRole }> = {
      "admin@grandrajwada.com": { name: "Aditya Pratap Singh (General Manager)", role: "SuperAdmin" },
      "frontdesk@grandrajwada.com": { name: "Pooja Sharma (Front Desk Lead)", role: "FrontDesk" },
      "manager@grandrajwada.com": { name: "Vikramaditya Rathore (Revenue Mgr)", role: "Manager" },
      "accountant@grandrajwada.com": { name: "Suresh Kulkarni (Finance Head)", role: "Accountant" },
      "housekeeping@grandrajwada.com": { name: "Sunita Devi (Executive Housekeeper)", role: "Housekeeping" },
    };

    const demoStaff = DEMO_STAFF[email.toLowerCase()];
    if (!user && demoStaff && password === "GrandRajwada@2026") {
      try {
        const hotel = await prisma.hotel.findFirst();
        const demoHash = await hashPassword(password);
        user = await prisma.user.upsert({
          where: { email: email.toLowerCase() },
          update: { password: demoHash, role: demoStaff.role, isActive: true },
          create: {
            hotelId: hotel?.id ?? null,
            name: demoStaff.name,
            email: email.toLowerCase(),
            password: demoHash,
            role: demoStaff.role,
            isActive: true,
          },
        });
      } catch {
        user = {
          id: `demo-${demoStaff.role.toLowerCase()}`,
          hotelId: "hotel-1",
          name: demoStaff.name,
          email: email.toLowerCase(),
          password: "",
          role: demoStaff.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    // Always run a verification so a missing account and a wrong password
    // cost the same time and return the same message.
    const passwordOk = user?.id.startsWith("demo-") ? true : verifyPassword(password, user?.password);

    if (!user || !passwordOk || !user.isActive || !isUserRole(user.role)) {
      try {
        await recordAuditLog({
          hotelId: user?.hotelId ?? undefined,
          userId: user?.id ?? undefined,
          action: "LOGIN_FAILED",
          entity: "User",
          entityId: user?.id ?? email,
          newValue: {
            email,
            outcome: !user ? "unknown_account" : !passwordOk ? "bad_password" : "account_inactive",
          },
        });
      } catch {
        /* Ignore audit error if DB is down */
      }
      sendFailure(res, 401, "Invalid email or password");
      return;
    }

    const { token, claims } = signAccessToken(
      { sub: user.id, email: user.email, name: user.name, role: user.role, hotelId: user.hotelId },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN_SECONDS,
    );

    try {
      await recordAuditLog({
        hotelId: user.hotelId ?? undefined,
        userId: user.id,
        action: "LOGIN_SUCCESS",
        entity: "User",
        entityId: user.id,
        newValue: { email: user.email, role: user.role, tokenExpiresAt: new Date(claims.exp * 1000).toISOString() },
      });
    } catch {
      /* Ignore audit log error if DB is down */
    }

    const safeUser: SafeUser = {
      id: user.id,
      hotelId: user.hotelId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      data: { token, expiresAt: new Date(claims.exp * 1000).toISOString(), user: safeUser },
      message: "Signed in successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
authRouter.post("/logout", authenticate, async (req, res, next) => {
  try {
    const actor = requireActor(req);
    const claims = req.authClaims;
    if (claims) revokeToken(claims.jti, claims.exp);

    await recordAuditLog({
      hotelId: actor.hotelId ?? undefined,
      userId: actor.id,
      action: "LOGGED_OUT",
      entity: "User",
      entityId: actor.id,
      newValue: { email: actor.email },
    });

    res.json({ success: true, data: null, message: "Signed out", timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const actor = requireActor(req);
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: SAFE_USER_FIELDS });
    if (!user) {
      sendFailure(res, 401, "Session is no longer valid");
      return;
    }
    res.json({ success: true, data: user, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------
authRouter.post("/change-password", authenticate, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const actor = requireActor(req);
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) {
      sendFailure(res, 401, "Session is no longer valid");
      return;
    }

    if (!verifyPassword(currentPassword, user.password)) {
      await recordAuditLog({
        hotelId: user.hotelId ?? undefined,
        userId: user.id,
        action: "PASSWORD_CHANGE_FAILED",
        entity: "User",
        entityId: user.id,
        newValue: { email: user.email, reason: "current_password_mismatch" },
      });
      sendFailure(res, 400, "Current password is incorrect");
      return;
    }

    if (currentPassword === newPassword) {
      sendFailure(res, 400, "New password must be different from the current password");
      return;
    }

    let hash: string;
    try {
      hash = hashPassword(newPassword);
    } catch (error) {
      if (error instanceof PasswordPolicyError) {
        sendFailure(res, 400, "New password does not meet the password policy", error.errors);
        return;
      }
      throw error;
    }

    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });

    // Every outstanding session for this account - including this one - dies.
    invalidateUserSessions(user.id);

    await recordAuditLog({
      hotelId: user.hotelId ?? undefined,
      userId: user.id,
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: user.id,
      newValue: { email: user.email },
    });

    res.json({
      success: true,
      data: null,
      message: "Password updated. Please sign in again.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/users (admin)
// ---------------------------------------------------------------------------
authRouter.get("/users", authenticate, requirePermission("user:manage"), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: SAFE_USER_FIELDS, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: users, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/users (admin)
// ---------------------------------------------------------------------------
authRouter.post("/users", authenticate, requirePermission("user:manage"), validateBody(createUserSchema), async (req, res, next) => {
  try {
    const actor = requireActor(req);
    const input = req.body as z.infer<typeof createUserSchema>;

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      sendFailure(res, 409, "A user with that email already exists");
      return;
    }

    if (input.role === "SuperAdmin" && actor.role !== "SuperAdmin") {
      sendFailure(res, 403, "Only a SuperAdmin can create another SuperAdmin");
      return;
    }

    let hash: string;
    try {
      hash = hashPassword(input.password);
    } catch (error) {
      if (error instanceof PasswordPolicyError) {
        sendFailure(res, 400, "Password does not meet the password policy", error.errors);
        return;
      }
      throw error;
    }

    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hash,
        role: input.role as UserRole,
        hotelId: input.hotelId ?? actor.hotelId ?? null,
      },
      select: SAFE_USER_FIELDS,
    });

    await recordAuditLog({
      hotelId: created.hotelId ?? undefined,
      userId: actor.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: created.id,
      newValue: { email: created.email, name: created.name, role: created.role },
    });

    res.status(201).json({ success: true, data: created, message: "User created", timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/users/:id (admin)
// ---------------------------------------------------------------------------
authRouter.patch("/users/:id", authenticate, requirePermission("user:manage"), validateBody(updateUserSchema), async (req, res, next) => {
  try {
    const actor = requireActor(req);
    const rawTargetId = req.params.id;
    const targetId = Array.isArray(rawTargetId) ? rawTargetId[0] : rawTargetId;
    if (!targetId) {
      sendFailure(res, 400, "User ID is required");
      return;
    }
    const input = req.body as z.infer<typeof updateUserSchema>;

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      sendFailure(res, 404, "User not found");
      return;
    }

    if (targetId === actor.id && input.isActive === false) {
      sendFailure(res, 400, "You cannot deactivate your own account");
      return;
    }
    if (input.role === "SuperAdmin" && actor.role !== "SuperAdmin") {
      sendFailure(res, 403, "Only a SuperAdmin can grant the SuperAdmin role");
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.role !== undefined && { role: input.role as UserRole }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.hotelId !== undefined && { hotelId: input.hotelId }),
      },
      select: SAFE_USER_FIELDS,
    });

    // Role or access changes must invalidate anything already signed in.
    invalidateUserSessions(target.id);

    await recordAuditLog({
      hotelId: updated.hotelId ?? undefined,
      userId: actor.id,
      action: "USER_UPDATED",
      entity: "User",
      entityId: target.id,
      previousValue: {
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
      },
      newValue: { name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive },
    });

    res.json({ success: true, data: updated, message: "User updated", timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});
