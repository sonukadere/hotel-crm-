import type { UserRole, AdminDashboardPermission } from "@hotel/types";

export const ALL_DASHBOARD_PERMISSIONS: AdminDashboardPermission[] = [
  "reservation:create",
  "reservation:checkin",
  "reservation:checkout",
  "reservation:room-switch",
  "guest:create",
  "payment:create",
  "service:create",
  "room:status-update",
  "folio:view",
  "folio:settle",
  "reports:view",
];

export const ROLE_DASHBOARD_PERMISSIONS: Record<UserRole, AdminDashboardPermission[]> = {
  SuperAdmin: [...ALL_DASHBOARD_PERMISSIONS],
  Admin: [...ALL_DASHBOARD_PERMISSIONS],
  Manager: [...ALL_DASHBOARD_PERMISSIONS],
  FrontDesk: [
    "reservation:create",
    "reservation:checkin",
    "reservation:checkout",
    "reservation:room-switch",
    "guest:create",
    "payment:create",
    "service:create",
    "room:status-update",
    "folio:view",
    "folio:settle",
    "reports:view",
  ],
  Accountant: [
    "payment:create",
    "folio:view",
    "folio:settle",
    "reports:view",
  ],
  Housekeeping: [
    "room:status-update",
  ],
};

export function getDashboardPermissions(role: UserRole): AdminDashboardPermission[] {
  return ROLE_DASHBOARD_PERMISSIONS[role] ?? [];
}

export function hasDashboardPermission(
  role: UserRole,
  permission: AdminDashboardPermission,
): boolean {
  const perms = getDashboardPermissions(role);
  return perms.includes(permission);
}
