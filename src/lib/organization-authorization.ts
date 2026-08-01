import type {
  OrganizationLifecycleStatus,
  OrganizationMembershipRole,
  OrganizationMembershipStatus,
} from "@prisma/client";
import { isAdminRole } from "@/lib/authorization";

export const ORGANIZATION_PERMISSIONS = [
  "ORGANIZATION_VIEW_DASHBOARD",
  "ORGANIZATION_EDIT_PROFILE",
  "ORGANIZATION_MANAGE_PUBLICATION",
  "ORGANIZATION_MANAGE_PUBLIC_MEDIA",
  "ORGANIZATION_MANAGE_CAPABILITIES",
  "ORGANIZATION_MANAGE_TEAM",
  "ORGANIZATION_INVITE_MEMBERS",
  "ORGANIZATION_CHANGE_MEMBER_ROLE",
  "ORGANIZATION_REMOVE_MEMBER",
  "ORGANIZATION_MANAGE_VERIFICATION",
  "ORGANIZATION_VIEW_PRIVATE_VERIFICATION",
  "ORGANIZATION_VIEW_ACTIVITY",
  "ORGANIZATION_VIEW_ANALYTICS",
  "ORGANIZATION_CREATE_CONTENT",
  "ORGANIZATION_EDIT_CONTENT",
  "ORGANIZATION_PUBLISH_CONTENT",
  "ORGANIZATION_MANAGE_HOUSING",
  "ORGANIZATION_CREATE_HOUSING",
  "ORGANIZATION_EDIT_HOUSING",
  "ORGANIZATION_PUBLISH_HOUSING",
  "ORGANIZATION_VIEW_HOUSING_INQUIRIES",
  "ORGANIZATION_MODERATE_HOUSING_TEAM",
  "ORGANIZATION_VIEW_OPPORTUNITIES",
  "ORGANIZATION_CREATE_OPPORTUNITIES",
  "ORGANIZATION_EDIT_OPPORTUNITIES",
  "ORGANIZATION_SUBMIT_OPPORTUNITIES",
  "ORGANIZATION_PUBLISH_OPPORTUNITIES",
  "ORGANIZATION_ARCHIVE_OPPORTUNITIES",
  // Applicant data is more sensitive than ordinary organization content, so the
  // application permissions are deliberately separate from the opportunity
  // publishing ones. Enabling a capability never grants them, and EDITOR does
  // not receive them by default.
  "ORGANIZATION_VIEW_APPLICATIONS",
  "ORGANIZATION_REVIEW_APPLICATIONS",
  "ORGANIZATION_CHANGE_APPLICATION_STATUS",
  "ORGANIZATION_EXPORT_APPLICATIONS",
  "ORGANIZATION_MANAGE_APPLICATION_QUESTIONS",
  "ORGANIZATION_MANAGE_APPLICATION_DOCUMENTS",
  "ORGANIZATION_CONTACT_APPLICANTS",
  "ORGANIZATION_VIEW_CATALOG",
  "ORGANIZATION_CREATE_PRODUCTS",
  "ORGANIZATION_EDIT_PRODUCTS",
  "ORGANIZATION_PUBLISH_PRODUCTS",
  "ORGANIZATION_ARCHIVE_PRODUCTS",
  "ORGANIZATION_CREATE_SERVICES",
  "ORGANIZATION_EDIT_SERVICES",
  "ORGANIZATION_PUBLISH_SERVICES",
  "ORGANIZATION_ARCHIVE_SERVICES",
  "ORGANIZATION_VIEW_CATALOG_INQUIRIES",
  "ORGANIZATION_RESPOND_CATALOG_INQUIRIES",
  "ORGANIZATION_ARCHIVE",
  "ORGANIZATION_TRANSFER_OWNERSHIP",
] as const;

export type OrganizationPermission = (typeof ORGANIZATION_PERMISSIONS)[number];

export type OrganizationMembershipContext = {
  role: OrganizationMembershipRole;
  status: OrganizationMembershipStatus;
};

const OWNER_PERMISSIONS = ORGANIZATION_PERMISSIONS;
const ADMIN_PERMISSIONS: readonly OrganizationPermission[] = [
  "ORGANIZATION_VIEW_DASHBOARD",
  "ORGANIZATION_EDIT_PROFILE",
  "ORGANIZATION_MANAGE_PUBLICATION",
  "ORGANIZATION_MANAGE_PUBLIC_MEDIA",
  "ORGANIZATION_MANAGE_CAPABILITIES",
  "ORGANIZATION_MANAGE_TEAM",
  "ORGANIZATION_INVITE_MEMBERS",
  "ORGANIZATION_CHANGE_MEMBER_ROLE",
  "ORGANIZATION_REMOVE_MEMBER",
  "ORGANIZATION_MANAGE_VERIFICATION",
  "ORGANIZATION_VIEW_PRIVATE_VERIFICATION",
  "ORGANIZATION_VIEW_ACTIVITY",
  "ORGANIZATION_VIEW_ANALYTICS",
  "ORGANIZATION_CREATE_CONTENT",
  "ORGANIZATION_EDIT_CONTENT",
  "ORGANIZATION_PUBLISH_CONTENT",
  "ORGANIZATION_MANAGE_HOUSING",
  "ORGANIZATION_CREATE_HOUSING",
  "ORGANIZATION_EDIT_HOUSING",
  "ORGANIZATION_PUBLISH_HOUSING",
  "ORGANIZATION_VIEW_HOUSING_INQUIRIES",
  "ORGANIZATION_MODERATE_HOUSING_TEAM",
  "ORGANIZATION_VIEW_OPPORTUNITIES",
  "ORGANIZATION_CREATE_OPPORTUNITIES",
  "ORGANIZATION_EDIT_OPPORTUNITIES",
  "ORGANIZATION_SUBMIT_OPPORTUNITIES",
  "ORGANIZATION_PUBLISH_OPPORTUNITIES",
  "ORGANIZATION_ARCHIVE_OPPORTUNITIES",
  "ORGANIZATION_VIEW_APPLICATIONS",
  "ORGANIZATION_REVIEW_APPLICATIONS",
  "ORGANIZATION_CHANGE_APPLICATION_STATUS",
  "ORGANIZATION_EXPORT_APPLICATIONS",
  "ORGANIZATION_MANAGE_APPLICATION_QUESTIONS",
  "ORGANIZATION_MANAGE_APPLICATION_DOCUMENTS",
  "ORGANIZATION_CONTACT_APPLICANTS",
  "ORGANIZATION_VIEW_CATALOG",
  "ORGANIZATION_CREATE_PRODUCTS",
  "ORGANIZATION_EDIT_PRODUCTS",
  "ORGANIZATION_PUBLISH_PRODUCTS",
  "ORGANIZATION_ARCHIVE_PRODUCTS",
  "ORGANIZATION_CREATE_SERVICES",
  "ORGANIZATION_EDIT_SERVICES",
  "ORGANIZATION_PUBLISH_SERVICES",
  "ORGANIZATION_ARCHIVE_SERVICES",
  "ORGANIZATION_VIEW_CATALOG_INQUIRIES",
  "ORGANIZATION_RESPOND_CATALOG_INQUIRIES",
];
const EDITOR_PERMISSIONS: readonly OrganizationPermission[] = [
  "ORGANIZATION_VIEW_DASHBOARD",
  "ORGANIZATION_EDIT_PROFILE",
  "ORGANIZATION_MANAGE_PUBLIC_MEDIA",
  "ORGANIZATION_VIEW_ACTIVITY",
  "ORGANIZATION_CREATE_CONTENT",
  "ORGANIZATION_EDIT_CONTENT",
  "ORGANIZATION_CREATE_HOUSING",
  "ORGANIZATION_EDIT_HOUSING",
  // EDITOR may author and submit opportunities but deliberately receives no
  // application access: reading applicant documents and answers requires an
  // explicit ADMIN/OWNER grant.
  "ORGANIZATION_VIEW_OPPORTUNITIES",
  "ORGANIZATION_CREATE_OPPORTUNITIES",
  "ORGANIZATION_EDIT_OPPORTUNITIES",
  "ORGANIZATION_SUBMIT_OPPORTUNITIES",
  "ORGANIZATION_VIEW_CATALOG",
  "ORGANIZATION_CREATE_PRODUCTS",
  "ORGANIZATION_EDIT_PRODUCTS",
  "ORGANIZATION_CREATE_SERVICES",
  "ORGANIZATION_EDIT_SERVICES",
];
const VIEWER_PERMISSIONS: readonly OrganizationPermission[] = [
  "ORGANIZATION_VIEW_DASHBOARD",
  "ORGANIZATION_VIEW_ACTIVITY",
  "ORGANIZATION_VIEW_OPPORTUNITIES",
  "ORGANIZATION_VIEW_CATALOG",
];

const ROLE_PERMISSIONS: Record<
  OrganizationMembershipRole,
  readonly OrganizationPermission[]
> = {
  OWNER: OWNER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  EDITOR: EDITOR_PERMISSIONS,
  VIEWER: VIEWER_PERMISSIONS,
  // Part 1 compatibility. The migration converts stored values explicitly,
  // while an older application binary can still read both legacy values.
  MANAGER: EDITOR_PERMISSIONS,
  MEMBER: VIEWER_PERMISSIONS,
};

export function visibleOrganizationRole(
  role: OrganizationMembershipRole,
): "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" {
  if (role === "MANAGER") return "EDITOR";
  if (role === "MEMBER") return "VIEWER";
  return role;
}

export function organizationPermissionsFor(
  membership: OrganizationMembershipContext | null | undefined,
) {
  if (membership?.status !== "ACTIVE") return [];
  return ROLE_PERMISSIONS[membership.role];
}

export function hasOrganizationPermission(
  membership: OrganizationMembershipContext | null | undefined,
  permission: OrganizationPermission,
) {
  return organizationPermissionsFor(membership).includes(permission);
}

export function canViewOrganizationDraft(input: {
  membership?: OrganizationMembershipContext | null;
  globalRole?: string | null;
}) {
  return (
    hasOrganizationPermission(
      input.membership,
      "ORGANIZATION_VIEW_DASHBOARD",
    ) || isAdminRole(input.globalRole)
  );
}

export function canEditOrganization(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return hasOrganizationPermission(membership, "ORGANIZATION_EDIT_PROFILE");
}

export function canManageOrganizationMembers(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return hasOrganizationPermission(membership, "ORGANIZATION_MANAGE_TEAM");
}

export function canSubmitOrganizationForVerification(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return hasOrganizationPermission(
    membership,
    "ORGANIZATION_MANAGE_VERIFICATION",
  );
}

export function canDeleteOrArchiveOrganization(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return hasOrganizationPermission(membership, "ORGANIZATION_ARCHIVE");
}

export function canManageOrganizationMember(input: {
  actor: OrganizationMembershipContext | null | undefined;
  target: OrganizationMembershipContext;
  nextRole?: OrganizationMembershipRole;
}) {
  if (
    !hasOrganizationPermission(
      input.actor,
      "ORGANIZATION_CHANGE_MEMBER_ROLE",
    ) ||
    input.target.role === "OWNER" ||
    input.nextRole === "OWNER"
  ) {
    return false;
  }
  if (input.actor?.role === "ADMIN" && input.target.role === "ADMIN") {
    return false;
  }
  return true;
}

export function canTransferOrganizationOwnership(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return hasOrganizationPermission(
    membership,
    "ORGANIZATION_TRANSFER_OWNERSHIP",
  );
}

export function canLeaveOrganization(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return membership?.status === "ACTIVE" && membership.role !== "OWNER";
}

export function canArchiveOrganization(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return hasOrganizationPermission(membership, "ORGANIZATION_ARCHIVE");
}

export function canResumeOrganizationSetup(input: {
  membership?: OrganizationMembershipContext | null;
  lifecycleStatus: OrganizationLifecycleStatus;
  setupCompletedAt?: Date | null;
}) {
  return (
    input.lifecycleStatus === "DRAFT" &&
    !input.setupCompletedAt &&
    canEditOrganization(input.membership)
  );
}
