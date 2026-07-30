import type { Prisma } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { revalidateOrganizationPublicSurfaces } from "@/lib/organization-cache";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; role: string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

async function organizationContext(
  tx: Prisma.TransactionClient,
  actorId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    actorId,
    { id: organizationId },
    "ORGANIZATION_MANAGE_PUBLIC_MEDIA",
    tx,
  );
  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
    select: {
      slug: true,
      lifecycleStatus: true,
      city: { select: { slug: true } },
    },
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);
  if (
    organization.lifecycleStatus === "SUSPENDED" ||
    organization.lifecycleStatus === "ARCHIVED"
  ) {
    throw new OrganizationError(
      "Public media cannot be changed in the current organization state.",
      409,
    );
  }
  return organization;
}

export async function addOrganizationGalleryMedia(
  actor: Actor,
  organizationId: string,
  input: {
    mediaId: string;
    caption?: string;
    altText: string;
    visibility: "PUBLIC" | "PRIVATE";
  },
  meta: RequestMeta = {},
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await organizationContext(
        tx,
        actor.id,
        organizationId,
      );
      const count = await tx.organizationMedia.count({
        where: { organizationId },
      });
      if (count >= 12) {
        throw new OrganizationError(
          "A public organization gallery can contain up to 12 images.",
          409,
        );
      }
      await attachMediaAsset(tx, {
        ownerId: actor.id,
        assetId: input.mediaId,
        purpose: "ORGANIZATION_GALLERY_IMAGE",
        attachmentType: "ORGANIZATION_GALLERY",
        attachmentId: organizationId,
      });
      const item = await tx.organizationMedia.create({
        data: {
          organizationId,
          mediaId: input.mediaId,
          caption: input.caption,
          altText: input.altText,
          visibility: input.visibility,
          sortOrder: count,
          createdById: actor.id,
        },
      });
      await tx.mediaAsset.update({
        where: { id: input.mediaId },
        data: { altText: input.altText },
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        organizationId,
        action: "ORGANIZATION_PUBLIC_MEDIA_ADDED",
        entityType: "OrganizationMedia",
        entityId: item.id,
        newValue: { visibility: item.visibility, sortOrder: item.sortOrder },
        ...meta,
      });
      return {
        item,
        slug: organization.slug,
        citySlug: organization.city?.slug ?? null,
      };
    });
    revalidateOrganizationPublicSurfaces(result);
    return result.item;
  } catch (error) {
    if (error instanceof MediaError) {
      throw new OrganizationError(error.message, error.status);
    }
    throw error;
  }
}

export async function updateOrganizationGalleryMedia(
  actor: Actor,
  organizationId: string,
  itemId: string,
  input: {
    caption?: string;
    altText?: string;
    visibility?: "PUBLIC" | "PRIVATE";
    sortOrder?: number;
  },
  meta: RequestMeta = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    const organization = await organizationContext(
      tx,
      actor.id,
      organizationId,
    );
    const existing = await tx.organizationMedia.findFirst({
      where: { id: itemId, organizationId },
    });
    if (!existing) throw new OrganizationError("Gallery image not found.", 404);
    const item = await tx.organizationMedia.update({
      where: { id: itemId },
      data: input,
    });
    if (input.altText) {
      await tx.mediaAsset.update({
        where: { id: existing.mediaId },
        data: { altText: input.altText },
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_PUBLIC_MEDIA_UPDATED",
      entityType: "OrganizationMedia",
      entityId: item.id,
      newValue: {
        visibility: item.visibility,
        sortOrder: item.sortOrder,
      },
      ...meta,
    });
    return {
      item,
      slug: organization.slug,
      citySlug: organization.city?.slug ?? null,
    };
  });
  revalidateOrganizationPublicSurfaces(result);
  return result.item;
}

export async function removeOrganizationGalleryMedia(
  actor: Actor,
  organizationId: string,
  itemId: string,
  meta: RequestMeta = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    const organization = await organizationContext(
      tx,
      actor.id,
      organizationId,
    );
    const existing = await tx.organizationMedia.findFirst({
      where: { id: itemId, organizationId },
    });
    if (!existing) throw new OrganizationError("Gallery image not found.", 404);
    await tx.organizationMedia.delete({ where: { id: itemId } });
    await tx.mediaAsset.updateMany({
      where: {
        id: existing.mediaId,
        attachmentType: "ORGANIZATION_GALLERY",
        attachmentId: organizationId,
      },
      data: {
        attachedAt: null,
        attachmentType: null,
        attachmentId: null,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_PUBLIC_MEDIA_REMOVED",
      entityType: "OrganizationMedia",
      entityId: itemId,
      oldValue: { visibility: existing.visibility },
      ...meta,
    });
    return {
      removed: true,
      slug: organization.slug,
      citySlug: organization.city?.slug ?? null,
    };
  });
  revalidateOrganizationPublicSurfaces(result);
  return { removed: true };
}

export async function reorderOrganizationGalleryMedia(
  actor: Actor,
  organizationId: string,
  mediaIds: string[],
  meta: RequestMeta = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    const organization = await organizationContext(
      tx,
      actor.id,
      organizationId,
    );
    const items = await tx.organizationMedia.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const current = new Set(items.map(({ id }) => id));
    if (
      current.size !== mediaIds.length ||
      mediaIds.some((id) => !current.has(id))
    ) {
      throw new OrganizationError(
        "Gallery order must include every current image exactly once.",
      );
    }
    await Promise.all(
      mediaIds.map((id, sortOrder) =>
        tx.organizationMedia.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_PUBLIC_MEDIA_REORDERED",
      entityType: "Organization",
      entityId: organizationId,
      newValue: { itemCount: mediaIds.length },
      ...meta,
    });
    return {
      slug: organization.slug,
      citySlug: organization.city?.slug ?? null,
    };
  });
  revalidateOrganizationPublicSurfaces(result);
  return { reordered: true };
}
