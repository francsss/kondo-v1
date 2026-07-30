import {
  type OrganizationPublicProfileStatus,
  type Prisma,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { serializePublicOrganizationContact } from "@/lib/organization-contact";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { revalidateOrganizationPublicSurfaces } from "@/lib/organization-cache";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { validateOrganizationSlug } from "@/lib/organization-profile";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type Actor = { id: string; role: string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };
type OrganizationReadClient = Pick<
  Prisma.TransactionClient,
  "organization" | "organizationContactChannel" | "organizationMembership"
>;

export type OrganizationPublicationReadinessInput = {
  publicName: string;
  slug: string;
  type: string | null;
  countryId: string | null;
  shortDescription: string | null;
  logoMediaId: string | null;
  lifecycleStatus: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  verificationStatus: string;
  representationConfirmed: boolean;
  publicProfileBlocked: boolean;
  publicProfileBlockReason: string | null;
  publicContactTypes: string[];
  publicMediaCount: number;
  activeOwnerCount: number;
};

const PUBLICATION_TRANSITIONS: Record<
  OrganizationPublicProfileStatus,
  readonly OrganizationPublicProfileStatus[]
> = {
  PRIVATE: ["READY"],
  READY: ["PRIVATE", "PUBLISHED"],
  PUBLISHED: ["UNPUBLISHED"],
  UNPUBLISHED: ["PUBLISHED", "PRIVATE"],
};

export function canTransitionOrganizationPublication(
  current: OrganizationPublicProfileStatus,
  next: OrganizationPublicProfileStatus,
) {
  return PUBLICATION_TRANSITIONS[current].includes(next);
}

export function assertOrganizationPublicationTransition(
  current: OrganizationPublicProfileStatus,
  next: OrganizationPublicProfileStatus,
) {
  if (!canTransitionOrganizationPublication(current, next)) {
    throw new OrganizationError(
      `Public profile cannot move from ${current} to ${next}.`,
      409,
    );
  }
}

export function evaluateOrganizationPublicationReadiness(
  organization: OrganizationPublicationReadinessInput,
) {
  const missingRequirements: Array<{ key: string; message: string }> = [];
  const blockingReasons: Array<{ key: string; message: string }> = [];
  const warnings: Array<{ key: string; message: string }> = [];

  if (!organization.publicName.trim()) {
    missingRequirements.push({
      key: "publicName",
      message: "Add a public organization name before publishing.",
    });
  }
  try {
    validateOrganizationSlug(organization.slug);
  } catch {
    missingRequirements.push({
      key: "slug",
      message: "Choose a valid, available public profile address.",
    });
  }
  if (!organization.type) {
    missingRequirements.push({
      key: "type",
      message: "Select an organization type before publishing.",
    });
  }
  if (!organization.countryId) {
    missingRequirements.push({
      key: "country",
      message: "Select the country where the organization operates.",
    });
  }
  if (!organization.shortDescription?.trim()) {
    missingRequirements.push({
      key: "description",
      message: "Add a short public description before publishing.",
    });
  }
  if (!organization.publicContactTypes.length) {
    missingRequirements.push({
      key: "contact",
      message: "Add a public contact method before publishing.",
    });
  }
  if (!organization.activeOwnerCount) {
    missingRequirements.push({
      key: "owner",
      message: "The organization must have one active owner.",
    });
  }
  if (!organization.representationConfirmed) {
    missingRequirements.push({
      key: "representation",
      message:
        "Confirm that you are authorized to represent this organization.",
    });
  }
  if (organization.lifecycleStatus !== "ACTIVE") {
    blockingReasons.push({
      key: "lifecycle",
      message:
        organization.lifecycleStatus === "SUSPENDED"
          ? "This organization is suspended and cannot be published."
          : organization.lifecycleStatus === "ARCHIVED"
            ? "Archived organizations cannot be published."
            : "Complete organization setup before publishing.",
    });
  }
  if (organization.publicProfileBlocked) {
    blockingReasons.push({
      key: "moderation",
      message:
        organization.publicProfileBlockReason ||
        "Kondo has temporarily restricted this public profile.",
    });
  }
  if (!organization.logoMediaId) {
    warnings.push({
      key: "logo",
      message: "Add a logo to make the organization easier to recognize.",
    });
  }
  if (!organization.publicContactTypes.includes("WEBSITE")) {
    warnings.push({
      key: "website",
      message: "An official website can help students verify information.",
    });
  }
  if (!organization.publicMediaCount) {
    warnings.push({
      key: "gallery",
      message: "A small gallery can make the profile more useful.",
    });
  }
  if (organization.verificationStatus !== "VERIFIED") {
    warnings.push({
      key: "verification",
      message:
        "This profile can be public without verification, but it will be clearly marked unverified.",
    });
  }
  const completedRequirements = 8 - missingRequirements.length;
  return {
    isReady: missingRequirements.length === 0 && blockingReasons.length === 0,
    missingRequirements,
    blockingReasons,
    warnings,
    profileCompletionSummary: {
      completed: Math.max(0, completedRequirements),
      total: 8,
      percentage: Math.max(0, Math.round((completedRequirements / 8) * 100)),
    },
  };
}

export async function getOrganizationPublicationReadiness(
  organizationId: string,
  client: OrganizationReadClient = prisma,
) {
  const organization = await client.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      publicName: true,
      slug: true,
      type: true,
      countryId: true,
      shortDescription: true,
      logoMediaId: true,
      lifecycleStatus: true,
      verificationStatus: true,
      representationConfirmedAt: true,
      publicProfileBlockedAt: true,
      publicProfileBlockReason: true,
      contactChannels: {
        where: { visibility: "PUBLIC" },
        select: {
          id: true,
          type: true,
          label: true,
          value: true,
          visibility: true,
        },
      },
      publicMedia: {
        where: { visibility: "PUBLIC" },
        select: { id: true },
        take: 1,
      },
      memberships: {
        where: { role: "OWNER", status: "ACTIVE" },
        select: { userId: true },
        take: 1,
      },
    },
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);

  return evaluateOrganizationPublicationReadiness({
    publicName: organization.publicName,
    slug: organization.slug,
    type: organization.type,
    countryId: organization.countryId,
    shortDescription: organization.shortDescription,
    logoMediaId: organization.logoMediaId,
    lifecycleStatus: organization.lifecycleStatus,
    verificationStatus: organization.verificationStatus,
    representationConfirmed: Boolean(organization.representationConfirmedAt),
    publicProfileBlocked: Boolean(organization.publicProfileBlockedAt),
    publicProfileBlockReason: organization.publicProfileBlockReason,
    publicContactTypes: organization.contactChannels.flatMap((channel) => {
      try {
        return serializePublicOrganizationContact(channel)
          ? [channel.type]
          : [];
      } catch {
        return [];
      }
    }),
    publicMediaCount: organization.publicMedia.length,
    activeOwnerCount: organization.memberships.length,
  });
}

async function enqueuePublicationNotice(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    organizationId: string;
    organizationName: string;
    slug: string;
    outcome: string;
    eventKey: string;
  },
) {
  const members = await tx.organizationMembership.findMany({
    where: { organizationId: input.organizationId, status: "ACTIVE" },
    select: { userId: true },
  });
  for (const member of members) {
    await enqueueNotificationJobWithClient(tx, {
      recipientId: member.userId,
      actorId: input.actorId,
      type: "ACCOUNT",
      templateKey: "ORGANIZATION_PUBLIC_PROFILE_STATUS",
      data: {
        organizationName: input.organizationName,
        outcome: input.outcome,
      },
      href: `/organizations/${input.slug}/public-profile`,
      dedupeKey: `${input.eventKey}:${input.organizationId}:${member.userId}`,
    });
  }
}

export async function publishOrganizationPublicProfile(
  actor: Actor,
  organizationId: string,
  meta: RequestMeta = {},
) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await requireOrganizationPermission(
      actor.id,
      { id: organizationId },
      "ORGANIZATION_MANAGE_PUBLICATION",
      tx,
    );
    const current = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        slug: true,
        publicName: true,
        publicProfileStatus: true,
        publicationVersion: true,
        city: { select: { slug: true } },
      },
    });
    if (!current) throw new OrganizationError("Organization not found.", 404);
    const readiness = await getOrganizationPublicationReadiness(
      organizationId,
      tx,
    );
    if (!readiness.isReady) {
      throw new OrganizationError(
        readiness.blockingReasons[0]?.message ||
          readiness.missingRequirements[0]?.message ||
          "Complete the public profile before publishing.",
        409,
      );
    }
    if (current.publicProfileStatus === "PRIVATE") {
      assertOrganizationPublicationTransition("PRIVATE", "READY");
    } else if (current.publicProfileStatus !== "READY") {
      assertOrganizationPublicationTransition(
        current.publicProfileStatus,
        "PUBLISHED",
      );
    }
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: {
        publicProfileStatus: "PUBLISHED",
        publishedAt: now,
        unpublishedAt: null,
        lastPublicUpdateAt: now,
        publicationVersion: { increment: 1 },
      },
      select: {
        id: true,
        slug: true,
        publicName: true,
        publicProfileStatus: true,
        publishedAt: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_PUBLIC_PROFILE_PUBLISHED",
      entityType: "Organization",
      entityId: organizationId,
      oldValue: { publicProfileStatus: current.publicProfileStatus },
      newValue: {
        publicProfileStatus: updated.publicProfileStatus,
        publicationVersion: current.publicationVersion + 1,
      },
      ...meta,
    });
    await enqueuePublicationNotice(tx, {
      actorId: actor.id,
      organizationId,
      organizationName: current.publicName,
      slug: current.slug,
      outcome: "Your organization profile is now public",
      eventKey: `organization-published:${now.getTime()}`,
    });
    return { ...updated, citySlug: current.city?.slug ?? null };
  });
  revalidateOrganizationPublicSurfaces(result);
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_PUBLIC_PROFILE_PUBLISHED,
    properties: { organization_id: result.id },
  });
  return result;
}

export async function unpublishOrganizationPublicProfile(
  actor: Actor,
  organizationId: string,
  meta: RequestMeta = {},
) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await requireOrganizationPermission(
      actor.id,
      { id: organizationId },
      "ORGANIZATION_MANAGE_PUBLICATION",
      tx,
    );
    const current = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        slug: true,
        publicName: true,
        publicProfileStatus: true,
        city: { select: { slug: true } },
      },
    });
    if (!current) throw new OrganizationError("Organization not found.", 404);
    assertOrganizationPublicationTransition(
      current.publicProfileStatus,
      "UNPUBLISHED",
    );
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: {
        publicProfileStatus: "UNPUBLISHED",
        unpublishedAt: now,
        lastPublicUpdateAt: now,
        publicationVersion: { increment: 1 },
      },
      select: { id: true, slug: true, publicProfileStatus: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_PUBLIC_PROFILE_UNPUBLISHED",
      entityType: "Organization",
      entityId: organizationId,
      oldValue: { publicProfileStatus: current.publicProfileStatus },
      newValue: { publicProfileStatus: updated.publicProfileStatus },
      ...meta,
    });
    await enqueuePublicationNotice(tx, {
      actorId: actor.id,
      organizationId,
      organizationName: current.publicName,
      slug: current.slug,
      outcome: "Your public profile was unpublished; its data was preserved",
      eventKey: `organization-unpublished:${now.getTime()}`,
    });
    return { ...updated, citySlug: current.city?.slug ?? null };
  });
  revalidateOrganizationPublicSurfaces(result);
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_PUBLIC_PROFILE_UNPUBLISHED,
    properties: { organization_id: result.id },
  });
  return result;
}
