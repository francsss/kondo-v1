import { describe, expect, it } from "vitest";
import {
  canDeleteOrArchiveOrganization,
  canEditOrganization,
  canManageOrganizationMember,
  canManageOrganizationMembers,
  canResumeOrganizationSetup,
  canSubmitOrganizationForVerification,
  canViewOrganizationDraft,
  hasOrganizationPermission,
  visibleOrganizationRole,
} from "@/lib/organization-authorization";

describe("organization authorization", () => {
  const active = (
    role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" | "MANAGER" | "MEMBER",
  ) => ({
    role,
    status: "ACTIVE" as const,
  });

  it("keeps draft viewing broad but editing role-aware", () => {
    expect(canViewOrganizationDraft({ membership: active("MEMBER") })).toBe(
      true,
    );
    expect(canEditOrganization(active("MEMBER"))).toBe(false);
    expect(canEditOrganization(active("MANAGER"))).toBe(true);
    expect(canEditOrganization({ role: "OWNER", status: "SUSPENDED" })).toBe(
      false,
    );
    expect(
      canViewOrganizationDraft({
        membership: null,
        globalRole: "SUPER_ADMIN",
      }),
    ).toBe(true);
  });

  it("reserves member management and verification for owners and admins", () => {
    expect(canManageOrganizationMembers(active("ADMIN"))).toBe(true);
    expect(canManageOrganizationMembers(active("MANAGER"))).toBe(false);
    expect(canSubmitOrganizationForVerification(active("OWNER"))).toBe(true);
    expect(canSubmitOrganizationForVerification(active("MANAGER"))).toBe(false);
  });

  it("reserves archival for the active owner", () => {
    expect(canDeleteOrArchiveOrganization(active("OWNER"))).toBe(true);
    expect(canDeleteOrArchiveOrganization(active("ADMIN"))).toBe(false);
  });

  it("maps the final role vocabulary and preserves legacy compatibility", () => {
    expect(visibleOrganizationRole("MANAGER")).toBe("EDITOR");
    expect(visibleOrganizationRole("MEMBER")).toBe("VIEWER");
    expect(canEditOrganization(active("EDITOR"))).toBe(true);
    expect(canEditOrganization(active("VIEWER"))).toBe(false);
    expect(
      hasOrganizationPermission(
        active("ADMIN"),
        "ORGANIZATION_MANAGE_VERIFICATION",
      ),
    ).toBe(true);
  });

  it("prevents administrators from changing owners or peer administrators", () => {
    expect(
      canManageOrganizationMember({
        actor: active("ADMIN"),
        target: active("ADMIN"),
        nextRole: "EDITOR",
      }),
    ).toBe(false);
    expect(
      canManageOrganizationMember({
        actor: active("OWNER"),
        target: active("ADMIN"),
        nextRole: "EDITOR",
      }),
    ).toBe(true);
    expect(
      canManageOrganizationMember({
        actor: active("OWNER"),
        target: active("VIEWER"),
        nextRole: "OWNER",
      }),
    ).toBe(false);
  });

  it("only resumes editable, unfinished drafts", () => {
    expect(
      canResumeOrganizationSetup({
        membership: active("OWNER"),
        lifecycleStatus: "DRAFT",
        setupCompletedAt: null,
      }),
    ).toBe(true);
    expect(
      canResumeOrganizationSetup({
        membership: active("OWNER"),
        lifecycleStatus: "ACTIVE",
        setupCompletedAt: new Date(),
      }),
    ).toBe(false);
  });
});
