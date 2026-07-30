import { describe, expect, it } from "vitest";
import {
  canDeleteOrArchiveOrganization,
  canEditOrganization,
  canManageOrganizationMembers,
  canResumeOrganizationSetup,
  canSubmitOrganizationForVerification,
  canViewOrganizationDraft,
} from "@/lib/organization-authorization";

describe("organization authorization", () => {
  const active = (role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER") => ({
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
