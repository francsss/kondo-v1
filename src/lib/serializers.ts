import type { Prisma } from "@prisma/client";

export function toSafeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string | null;
  avatarKey?: string | null;
  avatarMediaId?: string | null;
  role: string;
  status: string;
  onboardingCompletedAt?: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username ?? null,
    avatarKey: user.avatarKey ?? null,
    avatarMediaId: user.avatarMediaId ?? null,
    role: user.role,
    status: user.status,
    onboardingComplete: Boolean(user.onboardingCompletedAt),
    fullName: `${user.firstName} ${user.lastName}`,
  };
}

export const safePublicUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  officialProfileStatus: true,
  officialOrganizationType: true,
  officialOrganizationName: true,
  officialVerifiedAt: true,
} satisfies Prisma.UserSelect;

type SafePublicUserSource = Prisma.UserGetPayload<{
  select: typeof safePublicUserSelect;
}>;

export type SafePublicUser = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  officialProfileStatus: string;
  officialOrganizationType: string | null;
  officialOrganizationName: string | null;
  officialVerifiedAt: Date | null;
};

export function toSafePublicOfficialFields(input: {
  officialProfileStatus: string;
  officialOrganizationType: string | null;
  officialOrganizationName: string | null;
  officialVerifiedAt: Date | null;
}) {
  const approved = input.officialProfileStatus === "APPROVED";
  return {
    officialProfileStatus: approved ? ("APPROVED" as const) : "NOT_VERIFIED",
    officialOrganizationType: approved ? input.officialOrganizationType : null,
    officialOrganizationName: approved ? input.officialOrganizationName : null,
    officialVerifiedAt: approved ? input.officialVerifiedAt : null,
  };
}

export function toSafePublicUser(user: SafePublicUserSource): SafePublicUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    ...toSafePublicOfficialFields(user),
  };
}

export type SearchResultsDto = {
  communities: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    memberCount: number;
    isOfficial: boolean;
    isVerified: boolean;
  }>;
  listings: Array<{
    id: string;
    slug: string;
    title: string;
    priceFen: number;
    cityName: string;
  }>;
  guides: Array<{
    id: string;
    slug: string;
    title: string;
    estimatedMinutes: number;
  }>;
  questions: Array<{
    id: string;
    slug: string;
    title: string;
    answerCount: number;
  }>;
  users: Array<
    SafePublicUser & {
      countryEmoji: string | null;
      affiliation: string | null;
    }
  >;
  posts: Array<{
    id: string;
    title: string | null;
    content: string;
    community: {
      slug: string;
      name: string;
    };
    author: SafePublicUser;
  }>;
  universities: Array<{
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
    cityName: string;
  }>;
  countries: Array<{
    id: string;
    code: string;
    name: string;
    emoji: string | null;
  }>;
  cities: Array<{
    id: string;
    slug: string;
    name: string;
    province: string | null;
  }>;
  opportunities: Array<{
    id: string;
    slug: string;
    title: string;
    provider: string;
    status: string;
  }>;
};
