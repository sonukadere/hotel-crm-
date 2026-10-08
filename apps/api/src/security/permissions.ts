/**
 * Role based access control.
 *
 * Roles come from the Prisma `UserRole` enum. Every protected endpoint asks
 * for a permission, never for a raw role, so roles can evolve without
 * rewriting route guards.
 */

export const USER_ROLES = [
  "SuperAdmin",
  "Admin",
  "Manager",
  "FrontDesk",
  "Housekeeping",
  "Accountant",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type Permission =
  | "reservation:read"
  | "reservation:write"
  | "reservation:checkin"
  | "reservation:checkout"
  | "reservation:room-switch"
  | "guest:read"
  | "guest:write"
  | "room:read"
  | "room:write"
  | "room:status"
  | "folio:read"
  | "folio:write"
  | "payment:capture"
  | "payment:refund"
  | "invoice:generate"
  | "invoice:correct"
  | "gst:manage"
  | "loyalty:read"
  | "loyalty:adjust"
  | "crm:read"
  | "crm:write"
  | "night-audit:run"
  | "report:read"
  | "audit:read"
  | "settings:write"
  | "user:manage";

const ALL_PERMISSIONS: Permission[] = [
  "reservation:read",
  "reservation:write",
  "reservation:checkin",
  "reservation:checkout",
  "reservation:room-switch",
  "guest:read",
  "guest:write",
  "room:read",
  "room:write",
  "room:status",
  "folio:read",
  "folio:write",
  "payment:capture",
  "payment:refund",
  "invoice:generate",
  "invoice:correct",
  "gst:manage",
  "loyalty:read",
  "loyalty:adjust",
  "crm:read",
  "crm:write",
  "night-audit:run",
  "report:read",
  "audit:read",
  "settings:write",
  "user:manage",
];

const FRONT_DESK: Permission[] = [
  "reservation:read",
  "reservation:write",
  "reservation:checkin",
  "reservation:checkout",
  "reservation:room-switch",
  "guest:read",
  "guest:write",
  "room:read",
  "room:status",
  "folio:read",
  "folio:write",
  "payment:capture",
  "invoice:generate",
  "loyalty:read",
  "crm:read",
  "crm:write",
];

const MANAGER: Permission[] = [
  ...FRONT_DESK,
  "room:write",
  "payment:refund",
  "invoice:correct",
  "gst:manage",
  "loyalty:adjust",
  "night-audit:run",
  "report:read",
  "audit:read",
  "settings:write",
];

const ACCOUNTANT: Permission[] = [
  "reservation:read",
  "guest:read",
  "room:read",
  "folio:read",
  "payment:capture",
  "payment:refund",
  "invoice:generate",
  "invoice:correct",
  "gst:manage",
  "loyalty:read",
  "report:read",
  "audit:read",
];

const HOUSEKEEPING: Permission[] = ["room:read", "room:status"];

const PERMISSIONS_BY_ROLE: Record<UserRole, Permission[]> = {
  SuperAdmin: [...ALL_PERMISSIONS],
  Admin: ALL_PERMISSIONS.filter((permission) => permission !== "user:manage"),
  Manager: MANAGER,
  FrontDesk: FRONT_DESK,
  Housekeeping: HOUSEKEEPING,
  Accountant: ACCOUNTANT,
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function permissionsFor(role: string): Permission[] {
  if (!isUserRole(role)) return [];
  return PERMISSIONS_BY_ROLE[role];
}

export function can(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/** True when the role satisfies every requested permission. */
export function canAll(role: string, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}
