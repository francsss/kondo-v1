import type {
  OrganizationLifecycleStatus,
  OrganizationPublicProfileStatus,
  Prisma,
} from "@prisma/client";

export const organizationPublicVisibilityWhere = {
  lifecycleStatus: "ACTIVE",
  publicProfileStatus: "PUBLISHED",
  publicProfileBlockedAt: null,
} satisfies Prisma.OrganizationWhereInput;

export function canExposeOrganizationPublicly(input: {
  lifecycleStatus: OrganizationLifecycleStatus | string;
  publicProfileStatus: OrganizationPublicProfileStatus | string;
  publicProfileBlockedAt?: Date | string | null;
}) {
  return (
    input.lifecycleStatus === "ACTIVE" &&
    input.publicProfileStatus === "PUBLISHED" &&
    !input.publicProfileBlockedAt
  );
}
