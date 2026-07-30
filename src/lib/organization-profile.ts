const RESERVED_ORGANIZATION_SLUGS = new Set([
  "new",
  "admin",
  "api",
  "settings",
  "invite",
  "invitations",
  "verification",
  "dashboard",
  "team",
  "activity",
  "profile",
  "public-profile",
  "preview",
  "login",
  "register",
  "onboarding",
  "search",
  "messages",
  "marketplace",
  "communities",
  "student-hub",
  "explore",
  "notifications",
  "help",
  "stories",
  "kondo",
  "support",
  "security",
]);

export function normalizeOrganizationSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export function isReservedOrganizationSlug(value: string) {
  return RESERVED_ORGANIZATION_SLUGS.has(normalizeOrganizationSlug(value));
}

export function validateOrganizationSlug(value: string) {
  const normalized = normalizeOrganizationSlug(value);
  if (normalized.length < 3) {
    throw new Error("Organization slug must contain at least 3 characters.");
  }
  if (isReservedOrganizationSlug(normalized)) {
    throw new Error("This organization address is reserved by Kondo.");
  }
  return normalized;
}

type CompletenessOrganization = {
  publicName: string;
  type: string;
  countryId: string;
  cityId?: string | null;
  tagline?: string | null;
  shortDescription?: string | null;
  website?: string | null;
  professionalEmail?: string | null;
  logoMediaId?: string | null;
  capabilities?: readonly unknown[];
};

const COMPLETENESS_ITEMS = [
  [
    "logo",
    "Upload a logo",
    (value: CompletenessOrganization) => value.logoMediaId,
  ],
  [
    "identity",
    "Confirm the public identity",
    (value: CompletenessOrganization) => value.publicName && value.type,
  ],
  [
    "location",
    "Add a location",
    (value: CompletenessOrganization) => value.countryId && value.cityId,
  ],
  [
    "description",
    "Write an introduction",
    (value: CompletenessOrganization) => value.shortDescription,
  ],
  [
    "contact",
    "Add a professional contact",
    (value: CompletenessOrganization) => value.professionalEmail,
  ],
  [
    "website",
    "Add an official website",
    (value: CompletenessOrganization) => value.website,
  ],
  [
    "tagline",
    "Add a public tagline",
    (value: CompletenessOrganization) => value.tagline,
  ],
  [
    "capabilities",
    "Select activity areas",
    (value: CompletenessOrganization) => Boolean(value.capabilities?.length),
  ],
] as const;

export function organizationProfileCompleteness(
  organization: CompletenessOrganization,
) {
  const completed = COMPLETENESS_ITEMS.filter(([, , test]) =>
    Boolean(test(organization)),
  );
  const missing = COMPLETENESS_ITEMS.filter(
    ([, , test]) => !test(organization),
  ).map(([key, label]) => ({ key, label }));
  return {
    completed: completed.length,
    total: COMPLETENESS_ITEMS.length,
    percentage: Math.round(
      (completed.length / COMPLETENESS_ITEMS.length) * 100,
    ),
    missing,
  };
}

export function publicOrganizationDto(input: {
  id: string;
  slug: string;
  publicName: string;
  type: string;
  tagline?: string | null;
  shortDescription?: string | null;
  country?: { code: string; name: string } | null;
  city?: { name: string } | null;
  logoMediaId?: string | null;
  coverMediaId?: string | null;
  lifecycleStatus: string;
  verificationStatus: string;
  isOfficialPartner: boolean;
}) {
  return {
    id: input.id,
    slug: input.slug,
    publicName: input.publicName,
    type: input.type,
    tagline: input.tagline ?? null,
    shortDescription: input.shortDescription ?? null,
    country: input.country ?? null,
    city: input.city ?? null,
    logoMediaId: input.logoMediaId ?? null,
    coverMediaId: input.coverMediaId ?? null,
    lifecycleStatus: input.lifecycleStatus,
    verificationStatus: input.verificationStatus,
    isOfficialPartner: input.isOfficialPartner,
  };
}
