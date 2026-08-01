import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canManageResource,
  hasAdminPermission,
  hasRole,
  isAdminRole,
  isModeratorRole,
  isSuperAdminRole,
} from "@/lib/authorization";

describe("role authorization helpers", () => {
  it("allows moderation roles into admin routes", () => {
    expect(canAccessAdmin("MEMBER")).toBe(false);
    expect(canAccessAdmin("MODERATOR")).toBe(true);
    expect(canAccessAdmin("ADMIN")).toBe(true);
    expect(canAccessAdmin("SUPER_ADMIN")).toBe(true);
  });

  it("checks explicit roles", () => {
    expect(hasRole("MEMBER", ["MEMBER"])).toBe(true);
    expect(hasRole("ADMIN", ["MEMBER"])).toBe(false);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isModeratorRole("MODERATOR")).toBe(true);
    expect(isSuperAdminRole("ADMIN")).toBe(false);
  });

  it("allows resource owners or a moderation override", () => {
    expect(
      canManageResource({ role: "MEMBER", userId: "u1", ownerId: "u1" }),
    ).toBe(true);
    expect(
      canManageResource({ role: "MEMBER", userId: "u1", ownerId: "u2" }),
    ).toBe(false);
    expect(
      canManageResource({ role: "MODERATOR", userId: "u1", ownerId: "u2" }),
    ).toBe(true);
  });

  it("separates Moderator, Admin, and Super Admin permissions", () => {
    expect(
      hasAdminPermission("MODERATOR", "REPORT_VIEW_EVIDENCE_REDACTED"),
    ).toBe(true);
    expect(hasAdminPermission("MODERATOR", "REPORT_ASSIGN_ANY")).toBe(false);
    expect(
      hasAdminPermission("MODERATOR", "REPORT_VIEW_REPORTER_IDENTITY"),
    ).toBe(false);
    expect(hasAdminPermission("MODERATOR", "AUDIT_VIEW_GLOBAL")).toBe(false);
    expect(
      hasAdminPermission("MODERATOR", "ADMIN_VIEW_PLATFORM_OVERVIEW"),
    ).toBe(false);

    expect(hasAdminPermission("ADMIN", "REPORT_ASSIGN_ANY")).toBe(true);
    expect(hasAdminPermission("ADMIN", "REPORT_VIEW_REPORTER_IDENTITY")).toBe(
      true,
    );
    expect(hasAdminPermission("ADMIN", "REPORT_REOPEN")).toBe(true);
    expect(hasAdminPermission("ADMIN", "AUDIT_VIEW_GLOBAL")).toBe(true);
    expect(hasAdminPermission("ADMIN", "AUDIT_VIEW_SECURITY_METADATA")).toBe(
      false,
    );
    expect(hasAdminPermission("ADMIN", "REFERENCE_DATA_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "REFERENCE_DATA_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "MEDIA_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "MEDIA_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "USER_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "ACCOUNT_REQUEST_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "NOTIFICATION_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "NOTIFICATION_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "COMMUNITY_CMS_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "COMMUNITY_CMS_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "MARKETPLACE_CMS_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "MARKETPLACE_CMS_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "ORGANIZATION_CATALOG_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "ORGANIZATION_CATALOG_MODERATE")).toBe(
      true,
    );
    expect(
      hasAdminPermission("MODERATOR", "ORGANIZATION_CATALOG_MODERATE"),
    ).toBe(false);
    expect(hasAdminPermission("ADMIN", "HOUSING_PRIVATE_LOCATION_VIEW")).toBe(
      true,
    );
    expect(
      hasAdminPermission("MODERATOR", "HOUSING_PRIVATE_LOCATION_VIEW"),
    ).toBe(false);
    expect(hasAdminPermission("ADMIN", "USER_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "USER_ROLE_MANAGE")).toBe(false);
    expect(hasAdminPermission("ADMIN", "ANALYTICS_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "PLATFORM_SETTINGS_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "GUIDE_CMS_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "GUIDE_CMS_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "STUDENT_HUB_CONFIG_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "STUDENT_HUB_CONFIG_MANAGE")).toBe(true);
    expect(hasAdminPermission("ADMIN", "OPPORTUNITY_APPLICATIONS_VIEW")).toBe(
      true,
    );
    expect(hasAdminPermission("ADMIN", "FEEDBACK_VIEW")).toBe(true);
    expect(hasAdminPermission("ADMIN", "FEEDBACK_MANAGE")).toBe(true);
    expect(hasAdminPermission("MODERATOR", "REFERENCE_DATA_VIEW")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "MEDIA_VIEW")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "USER_VIEW")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "USER_MANAGE")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "NOTIFICATION_VIEW")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "COMMUNITY_CMS_VIEW")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "MARKETPLACE_CMS_VIEW")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "GUIDE_CMS_VIEW")).toBe(false);
    expect(hasAdminPermission("MODERATOR", "FEEDBACK_VIEW")).toBe(false);

    expect(
      hasAdminPermission("SUPER_ADMIN", "AUDIT_VIEW_SECURITY_METADATA"),
    ).toBe(true);
    expect(hasAdminPermission("SUPER_ADMIN", "USER_ROLE_MANAGE")).toBe(true);
  });
});
