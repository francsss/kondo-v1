import type {
  HousingListingStatus,
  HousingRequestStatus,
  HousingRequestVisibility,
  OrganizationLifecycleStatus,
  Prisma,
  RoommateProfileStatus,
  RoommateProfileVisibility,
  UserStatus,
} from "@prisma/client";

export function publicHousingListingWhere(
  now = new Date(),
): Prisma.HousingListingWhereInput {
  return {
    status: "PUBLISHED",
    publicationBlockedAt: null,
    availableFrom: { lte: new Date(now.getTime() + 365 * 24 * 60 * 60_000) },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    AND: [
      {
        OR: [
          {
            publisherType: "PERSONAL",
            publisherUser: { status: "ACTIVE" },
          },
          {
            publisherType: "ORGANIZATION",
            publisherOrganization: {
              lifecycleStatus: "ACTIVE",
              capabilities: {
                some: { key: "HOUSING", status: "ENABLED" },
              },
            },
          },
        ],
      },
    ],
  };
}

export function canExposeHousingListingPublicly(input: {
  status: HousingListingStatus | string;
  publicationBlockedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  publisherType: string;
  publisherUserStatus?: UserStatus | string | null;
  organizationLifecycleStatus?: OrganizationLifecycleStatus | string | null;
  organizationHousingCapability?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return (
    input.status === "PUBLISHED" &&
    !input.publicationBlockedAt &&
    (!input.expiresAt || new Date(input.expiresAt) > now) &&
    ((input.publisherType === "PERSONAL" &&
      input.publisherUserStatus === "ACTIVE") ||
      (input.publisherType === "ORGANIZATION" &&
        input.organizationLifecycleStatus === "ACTIVE" &&
        input.organizationHousingCapability === "ENABLED"))
  );
}

export function canExposeHousingRequest(input: {
  status: HousingRequestStatus | string;
  visibility: HousingRequestVisibility | string;
  expiresAt: Date | string;
  authenticated: boolean;
  owner: boolean;
  now?: Date;
}) {
  if (input.owner) return input.status !== "REMOVED";
  if (
    input.status !== "PUBLISHED" ||
    new Date(input.expiresAt) <= (input.now ?? new Date())
  ) {
    return false;
  }
  if (input.visibility === "PUBLIC") return true;
  return input.authenticated && input.visibility === "MEMBERS_ONLY";
}

export function canExposeRoommateProfile(input: {
  status: RoommateProfileStatus | string;
  visibility: RoommateProfileVisibility | string;
  owner: boolean;
  authenticated: boolean;
  blocked: boolean;
  allowInterests: boolean;
}) {
  if (input.owner) return true;
  return (
    input.authenticated &&
    !input.blocked &&
    input.status === "ACTIVE" &&
    input.visibility === "MEMBERS_ONLY" &&
    input.allowInterests
  );
}
