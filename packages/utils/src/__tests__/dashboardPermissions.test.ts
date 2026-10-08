import { describe, it, expect } from "vitest";
import { ALL_DASHBOARD_PERMISSIONS, getDashboardPermissions, hasDashboardPermission } from "../auth/dashboardPermissions";
import type { UserRole } from "@hotel/types";

describe("Module 13 - Admin Dashboard RBAC Permissions", () => {
  it("SuperAdmin, Admin, and Manager have all dashboard permissions", () => {
    const fullRoles: UserRole[] = ["SuperAdmin", "Admin", "Manager"];

    for (const role of fullRoles) {
      const permissions = getDashboardPermissions(role);
      expect(permissions).toEqual(ALL_DASHBOARD_PERMISSIONS);

      for (const perm of ALL_DASHBOARD_PERMISSIONS) {
        expect(hasDashboardPermission(role, perm)).toBe(true);
      }
    }
  });

  it("FrontDesk role can perform reservations, check-ins, check-outs, room switches, and payments", () => {
    const frontDeskPerms = getDashboardPermissions("FrontDesk");
    expect(frontDeskPerms).toContain("reservation:create");
    expect(frontDeskPerms).toContain("reservation:checkin");
    expect(frontDeskPerms).toContain("reservation:checkout");
    expect(frontDeskPerms).toContain("reservation:room-switch");
    expect(frontDeskPerms).toContain("payment:create");
    expect(frontDeskPerms).toContain("guest:create");
    expect(hasDashboardPermission("FrontDesk", "reservation:checkin")).toBe(true);
    expect(hasDashboardPermission("FrontDesk", "reservation:room-switch")).toBe(true);
  });

  it("Housekeeping role only has room status update permissions and is blocked from reservations/payments", () => {
    const hkPerms = getDashboardPermissions("Housekeeping");
    expect(hkPerms).toEqual(["room:status-update"]);

    expect(hasDashboardPermission("Housekeeping", "room:status-update")).toBe(true);
    expect(hasDashboardPermission("Housekeeping", "reservation:checkin")).toBe(false);
    expect(hasDashboardPermission("Housekeeping", "reservation:checkout")).toBe(false);
    expect(hasDashboardPermission("Housekeeping", "reservation:create")).toBe(false);
    expect(hasDashboardPermission("Housekeeping", "reservation:room-switch")).toBe(false);
    expect(hasDashboardPermission("Housekeeping", "payment:create")).toBe(false);
    expect(hasDashboardPermission("Housekeeping", "guest:create")).toBe(false);
  });

  it("Accountant role has financial/folio permissions but cannot check-in or switch rooms", () => {
    const accPerms = getDashboardPermissions("Accountant");
    expect(accPerms).toContain("payment:create");
    expect(accPerms).toContain("folio:view");
    expect(accPerms).toContain("folio:settle");
    expect(accPerms).toContain("reports:view");

    expect(hasDashboardPermission("Accountant", "payment:create")).toBe(true);
    expect(hasDashboardPermission("Accountant", "folio:view")).toBe(true);
    expect(hasDashboardPermission("Accountant", "reservation:checkin")).toBe(false);
    expect(hasDashboardPermission("Accountant", "reservation:room-switch")).toBe(false);
    expect(hasDashboardPermission("Accountant", "reservation:create")).toBe(false);
    expect(hasDashboardPermission("Housekeeping", "reports:view")).toBe(false);
  });

  it("Handles unknown or invalid role gracefully", () => {
    expect(getDashboardPermissions("UnknownRole" as unknown as UserRole)).toEqual([]);
    expect(hasDashboardPermission("UnknownRole" as unknown as UserRole, "reservation:create")).toBe(false);
  });
});
