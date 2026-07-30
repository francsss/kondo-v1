import { describe, expect, it } from "vitest";
import {
  canManageOrganizationMember,
  hasOrganizationPermission,
  organizationPermissionsFor,
  visibleOrganizationRole,
} from "@/lib/organization-authorization";
import {
  canUseOrganizationCapability,
  isOrganizationCapabilityKey,
  organizationCapabilityLabel,
} from "@/lib/organization-capabilities";
import {
  canTransitionOrganizationLifecycle,
  organizationAllowsMutation,
  organizationAllowsPublishing,
  organizationAllowsWorkspace,
  organizationIsPubliclyEligible,
} from "@/lib/organization-lifecycle";
import {
  isReservedOrganizationSlug,
  normalizeOrganizationSlug,
  organizationProfileCompleteness,
  publicOrganizationDto,
  validateOrganizationSlug,
} from "@/lib/organization-profile";
import { organizationProfileUpdateSchema } from "@/lib/validation";

describe("organization workspace domain", () => {
  const activeOwner = { role: "OWNER" as const, status: "ACTIVE" as const };
  const activeAdmin = { role: "ADMIN" as const, status: "ACTIVE" as const };
  const activeEditor = { role: "EDITOR" as const, status: "ACTIVE" as const };
  const activeViewer = { role: "VIEWER" as const, status: "ACTIVE" as const };

  it("keeps organization permissions role-scoped and inactive memberships powerless", () => {
    expect(
      hasOrganizationPermission(activeOwner, "ORGANIZATION_TRANSFER_OWNERSHIP"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(activeAdmin, "ORGANIZATION_MANAGE_TEAM"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(activeAdmin, "ORGANIZATION_TRANSFER_OWNERSHIP"),
    ).toBe(false);
    expect(
      hasOrganizationPermission(activeEditor, "ORGANIZATION_EDIT_PROFILE"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(activeEditor, "ORGANIZATION_MANAGE_TEAM"),
    ).toBe(false);
    expect(
      hasOrganizationPermission(activeViewer, "ORGANIZATION_VIEW_DASHBOARD"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(activeViewer, "ORGANIZATION_EDIT_PROFILE"),
    ).toBe(false);
    expect(
      organizationPermissionsFor({ role: "OWNER", status: "REMOVED" }),
    ).toEqual([]);
    expect(visibleOrganizationRole("MANAGER")).toBe("EDITOR");
    expect(visibleOrganizationRole("MEMBER")).toBe("VIEWER");
  });

  it("prevents administrators from managing owners or peer administrators", () => {
    expect(
      canManageOrganizationMember({
        actor: activeAdmin,
        target: activeOwner,
        nextRole: "VIEWER",
      }),
    ).toBe(false);
    expect(
      canManageOrganizationMember({
        actor: activeAdmin,
        target: activeAdmin,
        nextRole: "EDITOR",
      }),
    ).toBe(false);
    expect(
      canManageOrganizationMember({
        actor: activeOwner,
        target: activeAdmin,
        nextRole: "EDITOR",
      }),
    ).toBe(true);
  });

  it("gates capabilities by registry, lifecycle, status and membership permission", () => {
    expect(isOrganizationCapabilityKey("STUDENT_SERVICES")).toBe(true);
    expect(isOrganizationCapabilityKey("UNKNOWN")).toBe(false);
    expect(organizationCapabilityLabel("STUDENT_SERVICES")).toBe(
      "Student services",
    );
    expect(
      canUseOrganizationCapability({
        key: "STUDENT_SERVICES",
        status: "ENABLED",
        lifecycleStatus: "ACTIVE",
        membership: activeEditor,
      }),
    ).toBe(true);
    expect(
      canUseOrganizationCapability({
        key: "STUDENT_SERVICES",
        status: "DISABLED",
        lifecycleStatus: "ACTIVE",
        membership: activeEditor,
      }),
    ).toBe(false);
    expect(
      canUseOrganizationCapability({
        key: "STUDENT_SERVICES",
        status: "ENABLED",
        lifecycleStatus: "SUSPENDED",
        membership: activeEditor,
      }),
    ).toBe(false);
    expect(
      canUseOrganizationCapability({
        key: "STUDENT_SERVICES",
        status: "ENABLED",
        lifecycleStatus: "ACTIVE",
        membership: activeViewer,
      }),
    ).toBe(false);
  });

  it("enforces explicit lifecycle transitions and separates read, mutation and publishing", () => {
    expect(canTransitionOrganizationLifecycle("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionOrganizationLifecycle("ACTIVE", "SUSPENDED")).toBe(
      true,
    );
    expect(canTransitionOrganizationLifecycle("SUSPENDED", "ACTIVE")).toBe(
      true,
    );
    expect(canTransitionOrganizationLifecycle("ARCHIVED", "ACTIVE")).toBe(
      false,
    );
    expect(organizationAllowsWorkspace("SUSPENDED")).toBe(true);
    expect(organizationAllowsWorkspace("ARCHIVED")).toBe(false);
    expect(organizationAllowsMutation("DRAFT")).toBe(true);
    expect(organizationAllowsMutation("SUSPENDED")).toBe(false);
    expect(organizationAllowsPublishing("ACTIVE")).toBe(true);
    expect(organizationAllowsPublishing("DRAFT")).toBe(false);
    expect(organizationIsPubliclyEligible("ACTIVE")).toBe(true);
    expect(organizationIsPubliclyEligible("SUSPENDED")).toBe(false);
  });

  it("normalizes safe slugs and reports profile completeness without leaking private fields", () => {
    expect(normalizeOrganizationSlug("  École Kondo 中国  ")).toBe(
      "ecole-kondo",
    );
    expect(isReservedOrganizationSlug("Admin")).toBe(true);
    expect(() => validateOrganizationSlug("admin")).toThrow(/reserved/i);
    expect(validateOrganizationSlug("Kondo Student Network")).toBe(
      "kondo-student-network",
    );

    const completeness = organizationProfileCompleteness({
      publicName: "Kondo Student Network",
      type: "STUDENT_ASSOCIATION",
      countryId: "country",
      cityId: "city",
      shortDescription: "A useful student network.",
      professionalEmail: "hello@example.org",
      website: "https://example.org",
      tagline: "Students together",
      logoMediaId: "logo",
      capabilities: ["STUDENT_SERVICES"],
    });
    expect(completeness.percentage).toBe(100);
    expect(completeness.missing).toEqual([]);

    const publicDto = publicOrganizationDto({
      id: "organization",
      slug: "kondo-student-network",
      publicName: "Kondo Student Network",
      type: "STUDENT_ASSOCIATION",
      country: { code: "CM", name: "Cameroon" },
      city: { name: "Douala" },
      lifecycleStatus: "ACTIVE",
      verificationStatus: "VERIFIED",
      isOfficialPartner: false,
    });
    expect(publicDto).not.toHaveProperty("legalName");
    expect(publicDto).not.toHaveProperty("professionalEmail");
    expect(publicDto).not.toHaveProperty("suspensionReason");
  });

  it("does not accept client-controlled verification or partner fields in profile updates", () => {
    const parsed = organizationProfileUpdateSchema.parse({
      publicName: "Trusted University",
      verificationStatus: "VERIFIED",
      isOfficialPartner: true,
      lifecycleStatus: "ACTIVE",
    });
    expect(parsed).toEqual({ publicName: "Trusted University" });
  });
});
