import type {
  OrganizationCapabilityKey,
  OrganizationSizeRange,
  OrganizationType,
  Prisma,
  ProfileAudience,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { organizationAllowsMutation } from "@/lib/organization-lifecycle";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import {
  normalizeOrganizationSlug,
  validateOrganizationSlug,
} from "@/lib/organization-profile";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type Actor = { id: string; role: string };
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ProfileInput = {
  publicName?: string;
  legalName?: string;
  slug?: string;
  type?: OrganizationType;
  tagline?: string;
  shortDescription?: string;
  extendedDescription?: string;
  foundingYear?: number;
  sizeRange?: OrganizationSizeRange;
  countryId?: string;
  cityId?: string;
  website?: string;
  professionalEmail?: string;
  professionalPhone?: string;
  websiteWechat?: string;
  publicAddress?: string;
  serviceAreas?: string[];
  supportedLanguages?: string[];
  contactAudience?: ProfileAudience;
  logoMediaId?: string;
  coverMediaId?: string;
};

async function validateLocation(
  tx: Prisma.TransactionClient,
  countryId: string,
  cityId?: string | null,
) {
  const country = await tx.country.findFirst({
    where: { id: countryId, isActive: true },
    select: { id: true },
  });
  if (!country) throw new OrganizationError("Select an active country.");
  if (cityId) {
    const city = await tx.city.findFirst({
      where: { id: cityId, countryId, isActive: true },
      select: { id: true },
    });
    if (!city) {
      throw new OrganizationError(
        "Select an active city in the chosen country.",
      );
    }
  }
}

async function replaceOrganizationMedia(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    organizationId: string;
    nextId: string;
    previousId?: string | null;
    purpose: "ORGANIZATION_LOGO" | "ORGANIZATION_COVER";
  },
) {
  if (input.nextId === input.previousId) return;
  await attachMediaAsset(tx, {
    ownerId: input.actorId,
    assetId: input.nextId,
    purpose: input.purpose,
    attachmentType: input.purpose,
    attachmentId: input.organizationId,
  });
  if (input.previousId) {
    await tx.mediaAsset.updateMany({
      where: {
        id: input.previousId,
        attachmentType: input.purpose,
        attachmentId: input.organizationId,
      },
      data: {
        attachedAt: null,
        attachmentType: null,
        attachmentId: null,
      },
    });
  }
}

export async function updateOrganizationProfile(
  actor: Actor,
  organizationId: string,
  input: ProfileInput,
  meta: RequestMeta = {},
) {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await requireOrganizationPermission(
        actor.id,
        { id: organizationId },
        "ORGANIZATION_EDIT_PROFILE",
        tx,
      );
      const current = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!current) throw new OrganizationError("Organization not found.", 404);
      if (!organizationAllowsMutation(current.lifecycleStatus)) {
        throw new OrganizationError(
          "This organization cannot be edited in its current state.",
          409,
        );
      }
      const countryId = input.countryId ?? current.countryId;
      const cityId =
        input.cityId === undefined ? current.cityId : input.cityId || null;
      if (input.countryId !== undefined || input.cityId !== undefined) {
        await validateLocation(tx, countryId, cityId);
      }

      let nextSlug: string | undefined;
      if (input.slug && input.slug !== current.slug) {
        nextSlug = validateOrganizationSlug(input.slug);
        const conflict = await tx.organization.findFirst({
          where: {
            OR: [
              { slug: nextSlug },
              { slugAliases: { some: { slug: nextSlug } } },
            ],
            id: { not: organizationId },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new OrganizationError(
            "This organization address is already in use.",
            409,
          );
        }
        await tx.organizationSlugAlias.upsert({
          where: { slug: current.slug },
          create: { organizationId, slug: current.slug },
          update: { organizationId },
        });
      }

      if (input.logoMediaId) {
        await replaceOrganizationMedia(tx, {
          actorId: actor.id,
          organizationId,
          nextId: input.logoMediaId,
          previousId: current.logoMediaId,
          purpose: "ORGANIZATION_LOGO",
        });
      }
      if (input.coverMediaId) {
        await replaceOrganizationMedia(tx, {
          actorId: actor.id,
          organizationId,
          nextId: input.coverMediaId,
          previousId: current.coverMediaId,
          purpose: "ORGANIZATION_COVER",
        });
      }

      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          publicName: input.publicName,
          legalName: input.legalName,
          slug: nextSlug,
          type: input.type,
          tagline: input.tagline,
          shortDescription: input.shortDescription,
          extendedDescription: input.extendedDescription,
          foundingYear: input.foundingYear,
          sizeRange: input.sizeRange,
          countryId: input.countryId,
          cityId: input.cityId === undefined ? undefined : input.cityId || null,
          website: input.website,
          professionalEmail: input.professionalEmail,
          professionalPhone: input.professionalPhone,
          websiteWechat: input.websiteWechat,
          publicAddress: input.publicAddress,
          serviceAreas: input.serviceAreas
            ? [...new Set(input.serviceAreas)]
            : undefined,
          supportedLanguages: input.supportedLanguages
            ? [...new Set(input.supportedLanguages)]
            : undefined,
          contactAudience: input.contactAudience,
          logoMediaId: input.logoMediaId,
          coverMediaId: input.coverMediaId,
        },
        select: {
          id: true,
          slug: true,
          publicName: true,
          updatedAt: true,
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        organizationId,
        action: "ORGANIZATION_PROFILE_UPDATED",
        entityType: "Organization",
        entityId: organizationId,
        oldValue: {
          slug: current.slug,
          publicName: current.publicName,
          type: current.type,
        },
        newValue: {
          slug: updated.slug,
          publicName: updated.publicName,
          type: input.type ?? current.type,
        },
        ...meta,
      });
      return {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
    await captureServerProductEvent({
      distinctId: actor.id,
      event: PRODUCT_EVENTS.ORGANIZATION_PROFILE_UPDATED,
      properties: { slug_changed: Boolean(input.slug) },
    });
    return updated;
  } catch (error) {
    if (error instanceof MediaError) {
      throw new OrganizationError(error.message, error.status);
    }
    if (
      error instanceof Error &&
      error.message.startsWith("Organization slug")
    ) {
      throw new OrganizationError(error.message);
    }
    throw error;
  }
}

export async function updateOrganizationCapabilities(
  actor: Actor,
  organizationId: string,
  capabilities: OrganizationCapabilityKey[],
  meta: RequestMeta = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    await requireOrganizationPermission(
      actor.id,
      { id: organizationId },
      "ORGANIZATION_MANAGE_CAPABILITIES",
      tx,
    );
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { lifecycleStatus: true },
    });
    if (!organization)
      throw new OrganizationError("Organization not found.", 404);
    if (!organizationAllowsMutation(organization.lifecycleStatus)) {
      throw new OrganizationError(
        "Activity areas cannot be changed in the current organization state.",
        409,
      );
    }
    const selected = new Set(capabilities);
    for (const key of capabilities) {
      await tx.organizationCapability.upsert({
        where: { organizationId_key: { organizationId, key } },
        create: { organizationId, key, status: "ENABLED" },
        update: { status: "ENABLED" },
      });
    }
    await tx.organizationCapability.updateMany({
      where: { organizationId, key: { notIn: [...selected] } },
      data: { status: "DISABLED" },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_CAPABILITIES_UPDATED",
      entityType: "Organization",
      entityId: organizationId,
      newValue: { capabilities: [...selected] },
      ...meta,
    });
    return { capabilities: [...selected] };
  });
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_CAPABILITIES_UPDATED,
    properties: { capability_count: result.capabilities.length },
  });
  return result;
}

export function normalizedOrganizationSlug(value: string) {
  return normalizeOrganizationSlug(value);
}
