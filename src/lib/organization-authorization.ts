import type {
  OrganizationLifecycleStatus,
  OrganizationMembershipRole,
  OrganizationMembershipStatus,
} from "@prisma/client";
import { isAdminRole } from "@/lib/authorization";

export type OrganizationMembershipContext = {
  role: OrganizationMembershipRole;
  status: OrganizationMembershipStatus;
};

function activeRole(
  membership: OrganizationMembershipContext | null | undefined,
  roles: readonly OrganizationMembershipRole[],
) {
  return Boolean(
    membership?.status === "ACTIVE" && roles.includes(membership.role),
  );
}

export function canViewOrganizationDraft(input: {
  membership?: OrganizationMembershipContext | null;
  globalRole?: string | null;
}) {
  return (
    activeRole(input.membership, ["OWNER", "ADMIN", "MANAGER", "MEMBER"]) ||
    isAdminRole(input.globalRole)
  );
}

export function canEditOrganization(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return activeRole(membership, ["OWNER", "ADMIN", "MANAGER"]);
}

export function canManageOrganizationMembers(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return activeRole(membership, ["OWNER", "ADMIN"]);
}

export function canSubmitOrganizationForVerification(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return activeRole(membership, ["OWNER", "ADMIN"]);
}

export function canDeleteOrArchiveOrganization(
  membership: OrganizationMembershipContext | null | undefined,
) {
  return activeRole(membership, ["OWNER"]);
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
