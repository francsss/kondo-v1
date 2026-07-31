import type {
  OrganizationCapabilityKey,
  OrganizationContactType,
  OrganizationPublicProfileStatus,
  OrganizationType,
  OrganizationVerificationStatus,
  Prisma,
} from "@prisma/client";
import {
  ORGANIZATION_HOUSING_PUBLIC_SECTION,
  ORGANIZATION_PUBLIC_SECTION_PROVIDERS,
  ORGANIZATION_JOBS_PUBLIC_SECTION,
  ORGANIZATION_SCHOLARSHIPS_PUBLIC_SECTION,
  visibleOrganizationSections,
  type OrganizationPublicProjection,
} from "@/features/organizations/public-sections";
import { organizationTypeLabel } from "@/features/organizations/registry";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission } from "@/lib/authorization";
import {
  normalizeOrganizationContact,
  OrganizationContactError,
  serializePublicOrganizationContact,
  type OrganizationContactInput,
} from "@/lib/organization-contact";
import { revalidateOrganizationPublicSurfaces } from "@/lib/organization-cache";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { getOrganizationPublicationReadiness } from "@/lib/organization-publication";
import { organizationPublicVisibilityWhere } from "@/lib/organization-public-visibility";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type Actor = { id: string; role: string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

const publicOrganizationSelect = {
  id: true,
  slug: true,
  publicName: true,
  type: true,
  tagline: true,
  shortDescription: true,
  extendedDescription: true,
  foundingYear: true,
  sizeRange: true,
  publicAddress: true,
  serviceAreas: true,
  supportedLanguages: true,
  logoMediaId: true,
  coverMediaId: true,
  lifecycleStatus: true,
  publicProfileStatus: true,
  publicProfileBlockedAt: true,
  verificationStatus: true,
  isOfficialPartner: true,
  publishedAt: true,
  lastPublicUpdateAt: true,
  country: { select: { id: true, code: true, name: true, emoji: true } },
  city: {
    select: { id: true, slug: true, name: true, province: true },
  },
  capabilities: {
    where: { status: "ENABLED" as const },
    select: { key: true },
    orderBy: { createdAt: "asc" as const },
  },
  contactChannels: {
    where: { visibility: "PUBLIC" as const },
    select: {
      id: true,
      type: true,
      label: true,
      value: true,
      visibility: true,
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    take: 12,
  },
  publicMedia: {
    where: {
      visibility: "PUBLIC" as const,
      media: { status: "ACTIVE" as const, scanStatus: "CLEAN" as const },
    },
    select: {
      id: true,
      mediaId: true,
      caption: true,
      altText: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    take: 12,
  },
} satisfies Prisma.OrganizationSelect;

type PublicOrganizationRecord = Prisma.OrganizationGetPayload<{
  select: typeof publicOrganizationSelect;
}>;

function date(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function organizationTrustPresentation(input: {
  verificationStatus: OrganizationVerificationStatus;
  isOfficialPartner: boolean;
}) {
  const verified = input.verificationStatus === "VERIFIED";
  return {
    verification: verified
      ? {
          state: "VERIFIED" as const,
          label: "Verified organization",
          explanation:
            "Kondo reviewed information supporting this organization’s identity. This does not guarantee every external service or claim.",
        }
      : {
          state: "UNVERIFIED" as const,
          label: "Unverified organization",
          explanation:
            "Kondo has not completed an identity verification for this organization.",
        },
    partner:
      verified && input.isOfficialPartner
        ? {
            active: true,
            label: "Official Kondo partner",
            explanation:
              "Kondo has an active official partnership relationship with this verified organization.",
          }
        : {
            active: false,
            label: null,
            explanation: null,
          },
  };
}

async function publicProjections(
  organizationId: string,
  capabilities: readonly { key: OrganizationCapabilityKey }[],
) {
  const enabled = new Set(capabilities.map(({ key }) => key));
  const projections = new Map<string, OrganizationPublicProjection>();
  await Promise.all(
    ORGANIZATION_PUBLIC_SECTION_PROVIDERS.map(async (provider) => {
      if (!enabled.has(provider.capability)) return;
      const projection = await provider.getProjection(organizationId);
      if (
        projection.available &&
        projection.visibility === "PUBLIC" &&
        projection.itemCount > 0
      ) {
        projections.set(provider.key, projection);
      }
    }),
  );
  return Object.fromEntries(projections);
}

export async function serializeOrganizationPublicProfile(
  organization: PublicOrganizationRecord,
) {
  const contacts = organization.contactChannels.flatMap((channel) => {
    try {
      const serialized = serializePublicOrganizationContact(channel);
      return serialized ? [serialized] : [];
    } catch {
      return [];
    }
  });
  const projections = await publicProjections(
    organization.id,
    organization.capabilities,
  );
  const baseVisibleSections = visibleOrganizationSections({
    hasOverview: Boolean(
      organization.shortDescription ||
      organization.serviceAreas.length ||
      organization.supportedLanguages.length,
    ),
    hasAbout: Boolean(
      organization.extendedDescription || organization.foundingYear,
    ),
    capabilityCount: organization.capabilities.length,
    galleryCount: organization.publicMedia.length,
    contactCount: contacts.length,
    hasCity: Boolean(organization.city),
  });
  // A domain section appears only when its provider reported real public
  // content, so an enabled capability alone never produces an empty section.
  const domainSections = [
    projections.housing ? ORGANIZATION_HOUSING_PUBLIC_SECTION : null,
    projections.scholarships ? ORGANIZATION_SCHOLARSHIPS_PUBLIC_SECTION : null,
    projections.jobs ? ORGANIZATION_JOBS_PUBLIC_SECTION : null,
  ].filter((section) => section !== null);
  const visibleSections = domainSections.length
    ? [...baseVisibleSections, ...domainSections].sort(
        (first, second) => first.order - second.order,
      )
    : baseVisibleSections;
  return {
    id: organization.id,
    slug: organization.slug,
    publicName: organization.publicName,
    organizationType: organization.type,
    organizationTypeLabel: organizationTypeLabel(organization.type),
    tagline: organization.tagline,
    shortDescription: organization.shortDescription,
    extendedDescription: organization.extendedDescription,
    foundedYear: organization.foundingYear,
    organizationSizeRange: organization.sizeRange,
    publicGeneralAddress: organization.publicAddress,
    serviceAreas: organization.serviceAreas,
    supportedLanguages: organization.supportedLanguages,
    country: organization.country,
    city: organization.city,
    logo: organization.logoMediaId
      ? {
          url: `/api/media/${organization.logoMediaId}`,
          altText: `${organization.publicName} logo`,
        }
      : null,
    cover: organization.coverMediaId
      ? {
          url: `/api/media/${organization.coverMediaId}`,
          altText: `${organization.publicName} cover image`,
        }
      : null,
    gallery: organization.publicMedia.map((item) => ({
      id: item.id,
      url: `/api/media/${item.mediaId}`,
      caption: item.caption,
      altText: item.altText,
    })),
    publicContactChannels: contacts,
    publicCapabilities: organization.capabilities.map(({ key }) => key),
    trust: organizationTrustPresentation(organization),
    publicationDate: date(organization.publishedAt),
    lastPublicUpdate: date(organization.lastPublicUpdateAt),
    visibleSections,
    projections,
    reportTarget: { type: "Organization" as const, id: organization.id },
    relatedCity: organization.city
      ? {
          name: organization.city.name,
          href: `/explore/${organization.city.slug}`,
        }
      : null,
  };
}

export type OrganizationPublicProfileDTO = Awaited<
  ReturnType<typeof serializeOrganizationPublicProfile>
>;

export async function getOrganizationPublicProfile(slug: string) {
  const organization = await prisma.organization.findFirst({
    where: { slug, ...organizationPublicVisibilityWhere },
    select: publicOrganizationSelect,
  });
  if (organization) {
    return {
      profile: await serializeOrganizationPublicProfile(organization),
      redirectSlug: null,
    };
  }
  const alias = await prisma.organizationSlugAlias.findUnique({
    where: { slug },
    select: {
      organization: { select: publicOrganizationSelect },
    },
  });
  if (
    !alias ||
    alias.organization.publicProfileStatus !== "PUBLISHED" ||
    alias.organization.lifecycleStatus !== "ACTIVE" ||
    alias.organization.publicProfileBlockedAt
  ) {
    return null;
  }
  return {
    profile: await serializeOrganizationPublicProfile(alias.organization),
    redirectSlug: alias.organization.slug,
  };
}

export type OrganizationDirectoryFilters = {
  query?: string;
  type?: OrganizationType;
  capability?: OrganizationCapabilityKey;
  cityId?: string;
  countryId?: string;
  verification?: "VERIFIED" | "UNVERIFIED";
  partner?: boolean;
  page?: number;
};

export async function listPublicOrganizations(
  input: OrganizationDirectoryFilters = {},
) {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = 18;
  const query = input.query?.trim().slice(0, 100);
  const where: Prisma.OrganizationWhereInput = {
    ...organizationPublicVisibilityWhere,
    type: input.type,
    cityId: input.cityId,
    countryId: input.countryId,
    verificationStatus:
      input.verification === "VERIFIED"
        ? "VERIFIED"
        : input.verification === "UNVERIFIED"
          ? { not: "VERIFIED" }
          : undefined,
    isOfficialPartner: input.partner ? true : undefined,
    capabilities: input.capability
      ? { some: { key: input.capability, status: "ENABLED" } }
      : undefined,
    ...(query
      ? {
          OR: [
            { publicName: { contains: query, mode: "insensitive" } },
            { tagline: { contains: query, mode: "insensitive" } },
            { shortDescription: { contains: query, mode: "insensitive" } },
            { city: { name: { contains: query, mode: "insensitive" } } },
            { country: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, records] = await prisma.$transaction([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      select: publicOrganizationSelect,
      orderBy: [
        { verificationStatus: "desc" },
        { isOfficialPartner: "desc" },
        { lastPublicUpdateAt: "desc" },
        { publicName: "asc" },
        { id: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    organizations: await Promise.all(
      records.map(serializeOrganizationPublicProfile),
    ),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function listPublicOrganizationsForCity(
  cityId: string,
  limit = 6,
) {
  const records = await prisma.organization.findMany({
    where: {
      ...organizationPublicVisibilityWhere,
      cityId,
    },
    select: publicOrganizationSelect,
    orderBy: [
      { verificationStatus: "desc" },
      { isOfficialPartner: "desc" },
      { lastPublicUpdateAt: "desc" },
      { id: "asc" },
    ],
    take: Math.min(8, Math.max(1, limit)),
  });
  return Promise.all(records.map(serializeOrganizationPublicProfile));
}

export async function getOrganizationPublicProfileManagement(
  actor: Actor,
  organizationId: string,
) {
  await requireOrganizationPermission(
    actor.id,
    { id: organizationId },
    "ORGANIZATION_EDIT_PROFILE",
  );
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      slug: true,
      publicName: true,
      tagline: true,
      shortDescription: true,
      extendedDescription: true,
      publicAddress: true,
      serviceAreas: true,
      supportedLanguages: true,
      publicProfileStatus: true,
      representationConfirmedAt: true,
      publishedAt: true,
      unpublishedAt: true,
      lastPublicUpdateAt: true,
      verificationStatus: true,
      isOfficialPartner: true,
      contactChannels: {
        select: {
          id: true,
          type: true,
          label: true,
          value: true,
          visibility: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      publicMedia: {
        select: {
          id: true,
          mediaId: true,
          caption: true,
          altText: true,
          visibility: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);
  return {
    organization: {
      ...organization,
      representationConfirmed: Boolean(organization.representationConfirmedAt),
      representationConfirmedAt: date(organization.representationConfirmedAt),
      publishedAt: date(organization.publishedAt),
      unpublishedAt: date(organization.unpublishedAt),
      lastPublicUpdateAt: date(organization.lastPublicUpdateAt),
    },
    readiness: await getOrganizationPublicationReadiness(organizationId),
  };
}

export async function getOrganizationPublicProfilePreview(
  actor: Actor,
  organizationId: string,
) {
  await requireOrganizationPermission(
    actor.id,
    { id: organizationId },
    "ORGANIZATION_EDIT_PROFILE",
  );
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: publicOrganizationSelect,
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);
  return serializeOrganizationPublicProfile(organization);
}

export async function getOrganizationPublicProfilePreviewAsAdmin(
  actor: Actor,
  organizationId: string,
) {
  if (!hasAdminPermission(actor.role, "ORGANIZATION_PUBLIC_PROFILES_VIEW")) {
    throw new OrganizationError("Access denied.", 403);
  }
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: publicOrganizationSelect,
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);
  return serializeOrganizationPublicProfile(organization);
}

export async function updateOrganizationPublicProfile(
  actor: Actor,
  organizationId: string,
  input: {
    tagline?: string | null;
    shortDescription?: string | null;
    extendedDescription?: string | null;
    publicAddress?: string | null;
    serviceAreas: string[];
    supportedLanguages: string[];
    representationConfirmed: boolean;
    contacts: OrganizationContactInput[];
  },
  meta: RequestMeta = {},
) {
  let contacts: OrganizationContactInput[];
  try {
    contacts = input.contacts.map(normalizeOrganizationContact);
  } catch (error) {
    if (error instanceof OrganizationContactError) {
      throw new OrganizationError(error.message);
    }
    throw error;
  }
  const result = await prisma.$transaction(async (tx) => {
    await requireOrganizationPermission(
      actor.id,
      { id: organizationId },
      "ORGANIZATION_EDIT_PROFILE",
      tx,
    );
    const current = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        slug: true,
        lifecycleStatus: true,
        publicProfileStatus: true,
        city: { select: { slug: true } },
      },
    });
    if (!current) throw new OrganizationError("Organization not found.", 404);
    if (
      current.lifecycleStatus === "SUSPENDED" ||
      current.lifecycleStatus === "ARCHIVED"
    ) {
      throw new OrganizationError(
        "This public profile cannot be edited in its current state.",
        409,
      );
    }
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        tagline: input.tagline,
        shortDescription: input.shortDescription,
        extendedDescription: input.extendedDescription,
        publicAddress: input.publicAddress,
        serviceAreas: [...new Set(input.serviceAreas)],
        supportedLanguages: [...new Set(input.supportedLanguages)],
        representationConfirmedAt: input.representationConfirmed
          ? new Date()
          : null,
        lastPublicUpdateAt:
          current.publicProfileStatus === "PUBLISHED" ? new Date() : undefined,
        publicationVersion:
          current.publicProfileStatus === "PUBLISHED"
            ? { increment: 1 }
            : undefined,
      },
    });
    await tx.organizationContactChannel.deleteMany({
      where: { organizationId },
    });
    if (contacts.length) {
      await tx.organizationContactChannel.createMany({
        data: contacts.map((contact, sortOrder) => ({
          organizationId,
          type: contact.type,
          label: contact.label,
          value: contact.value,
          visibility: contact.visibility,
          sortOrder,
        })),
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_PUBLIC_PROFILE_UPDATED",
      entityType: "Organization",
      entityId: organizationId,
      newValue: {
        publicContactCount: contacts.filter(
          ({ visibility }) => visibility === "PUBLIC",
        ).length,
        representationConfirmed: input.representationConfirmed,
      },
      ...meta,
    });
    return {
      slug: current.slug,
      citySlug: current.city?.slug ?? null,
      previousStatus: current.publicProfileStatus,
    };
  });

  const readiness = await getOrganizationPublicationReadiness(organizationId);
  let nextStatus: OrganizationPublicProfileStatus | null = null;
  if (
    (result.previousStatus === "PRIVATE" ||
      result.previousStatus === "READY") &&
    readiness.isReady
  ) {
    nextStatus = "READY";
  } else if (result.previousStatus === "READY" && !readiness.isReady) {
    nextStatus = "PRIVATE";
  } else if (result.previousStatus === "PUBLISHED" && !readiness.isReady) {
    nextStatus = "UNPUBLISHED";
  }
  if (nextStatus && nextStatus !== result.previousStatus) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        publicProfileStatus: nextStatus,
        unpublishedAt: nextStatus === "UNPUBLISHED" ? new Date() : undefined,
      },
    });
  }
  revalidateOrganizationPublicSurfaces(result);
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_PROFILE_UPDATED,
    properties: { surface: "public_profile" },
  });
  return {
    publicProfileStatus: nextStatus ?? result.previousStatus,
    readiness,
  };
}

export function organizationContactTypeLabel(type: OrganizationContactType) {
  return type.toLowerCase().replaceAll("_", " ");
}
