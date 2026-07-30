import type {
  OrganizationLifecycleStatus,
  OrganizationMembershipRole,
  OrganizationMembershipStatus,
} from "@prisma/client";
import { isAdminRole } from "@/lib/authorization";

export const ORGANIZATION_PERMISSIONS = [
  "ORGANIZATION_VIEW_DASHBOARD",
  "ORGANIZATION_EDIT_PROFILE",
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
];
const EDITOR_PERMISSIONS: readonly OrganizationPermission[] = [
  "ORGANIZATION_VIEW_DASHBOARD",
  "ORGANIZATION_EDIT_PROFILE",
  "ORGANIZATION_VIEW_ACTIVITY",
  "ORGANIZATION_CREATE_CONTENT",
  "ORGANIZATION_EDIT_CONTENT",
];
const VIEWER_PERMISSIONS: readonly OrganizationPermission[] = [
  "ORGANIZATION_VIEW_DASHBOARD",
  "ORGANIZATION_VIEW_ACTIVITY",
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
