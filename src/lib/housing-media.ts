import type { HousingListingMediaKind, MediaPurpose } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { revalidateHousing } from "@/lib/housing-cache";
import { assertHousingListingOwner } from "@/lib/housing-permissions";
import {
  attachMediaAsset,
  removeOwnedMedia,
  updateMediaAltText,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class HousingMediaError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "HousingMediaError";
  }
}

function purposeForKind(kind: HousingListingMediaKind): MediaPurpose {
  if (kind === "FLOOR_PLAN") return "HOUSING_FLOOR_PLAN";
  if (kind === "PROOF_DOCUMENT") return "HOUSING_PROOF_DOCUMENT";
  return "HOUSING_LISTING_IMAGE";
}

export async function attachHousingListingMedia(input: {
  actorId: string;
  actorRole: string;
  listingId: string;
  mediaId: string;
  kind: HousingListingMediaKind;
  altText: string;
  caption?: string | null;
  isCover?: boolean;
  meta?: RequestMeta;
}) {
  const listing = await assertHousingListingOwner({
    userId: input.actorId,
    listingId: input.listingId,
  });
  if (!["DRAFT", "PAUSED", "REJECTED", "EXPIRED"].includes(listing.status)) {
    throw new HousingMediaError(
      "Pause this listing before changing its media.",
      409,
    );
  }
  const altText = input.altText.trim();
  if (input.kind !== "PROOF_DOCUMENT" && altText.length < 2) {
    throw new HousingMediaError("Describe this Housing image.");
  }
  const attached = await prisma.$transaction(async (tx) => {
    const kindCount = await tx.housingListingMedia.count({
      where: {
        listingId: input.listingId,
        kind:
          input.kind === "PROOF_DOCUMENT"
            ? "PROOF_DOCUMENT"
            : { not: "PROOF_DOCUMENT" },
      },
    });
    const limit = input.kind === "PROOF_DOCUMENT" ? 5 : 16;
    if (kindCount >= limit) {
      throw new HousingMediaError(
        input.kind === "PROOF_DOCUMENT"
          ? "A listing can contain up to five private proof documents."
          : "A listing can contain up to sixteen public images.",
        409,
      );
    }
    const sortOrder = await tx.housingListingMedia.count({
      where: { listingId: input.listingId },
    });
    await attachMediaAsset(tx, {
      ownerId: input.actorId,
      assetId: input.mediaId,
      purpose: purposeForKind(input.kind),
      attachmentType: "HOUSING_LISTING",
      attachmentId: input.listingId,
    });
    if (input.isCover) {
      await tx.housingListingMedia.updateMany({
        where: { listingId: input.listingId, isCover: true },
        data: { isCover: false },
      });
    }
    const media = await tx.housingListingMedia.create({
      data: {
        listingId: input.listingId,
        mediaId: input.mediaId,
        kind: input.kind,
        altText: altText || "Private Housing proof",
        caption: input.caption?.trim() || null,
        sortOrder,
        isCover:
          input.kind !== "PROOF_DOCUMENT" &&
          (input.isCover ||
            (await tx.housingListingMedia.count({
              where: {
                listingId: input.listingId,
                kind: { not: "PROOF_DOCUMENT" },
              },
            })) === 0),
      },
      select: {
        id: true,
        mediaId: true,
        kind: true,
        altText: true,
        caption: true,
        sortOrder: true,
        isCover: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      organizationId: listing.publisherOrganizationId,
      action: "HOUSING_LISTING_MEDIA_ATTACHED",
      entityType: "HousingListing",
      entityId: input.listingId,
      newValue: { mediaId: input.mediaId, kind: input.kind },
      ...input.meta,
    });
    return media;
  });
  revalidateHousing({ listingId: input.listingId });
  return attached;
}

export async function updateHousingListingMedia(input: {
  actorId: string;
  actorRole: string;
  listingId: string;
  mediaId: string;
  altText?: string;
  caption?: string | null;
  isCover?: boolean;
  meta?: RequestMeta;
}) {
  await assertHousingListingOwner({
    userId: input.actorId,
    listingId: input.listingId,
  });
  const media = await prisma.housingListingMedia.findFirst({
    where: { listingId: input.listingId, id: input.mediaId },
    select: { id: true, mediaId: true, kind: true },
  });
  if (!media) throw new HousingMediaError("Housing media not found.", 404);
  if (input.altText != null && media.kind !== "PROOF_DOCUMENT") {
    await updateMediaAltText(
      { id: input.actorId, role: input.actorRole },
      media.mediaId,
      input.altText,
      input.meta,
    );
  }
  await prisma.$transaction(async (tx) => {
    if (input.isCover && media.kind !== "PROOF_DOCUMENT") {
      await tx.housingListingMedia.updateMany({
        where: { listingId: input.listingId, isCover: true },
        data: { isCover: false },
      });
    }
    await tx.housingListingMedia.update({
      where: { id: media.id },
      data: {
        altText: input.altText?.trim(),
        caption:
          input.caption === undefined
            ? undefined
            : input.caption?.trim() || null,
        isCover: media.kind === "PROOF_DOCUMENT" ? false : input.isCover,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: "HOUSING_LISTING_MEDIA_UPDATED",
      entityType: "HousingListing",
      entityId: input.listingId,
      newValue: { mediaId: media.id, isCover: input.isCover ?? null },
      ...input.meta,
    });
  });
  revalidateHousing({ listingId: input.listingId });
  return { updated: true };
}

export async function reorderHousingListingMedia(input: {
  actorId: string;
  listingId: string;
  orderedIds: string[];
  meta?: RequestMeta;
}) {
  await assertHousingListingOwner({
    userId: input.actorId,
    listingId: input.listingId,
  });
  const existing = await prisma.housingListingMedia.findMany({
    where: {
      listingId: input.listingId,
      kind: { not: "PROOF_DOCUMENT" },
    },
    select: { id: true },
  });
  const existingIds = new Set(existing.map(({ id }) => id));
  if (
    input.orderedIds.length !== existingIds.size ||
    new Set(input.orderedIds).size !== existingIds.size ||
    input.orderedIds.some((id) => !existingIds.has(id))
  ) {
    throw new HousingMediaError("Media order does not match this listing.");
  }
  await prisma.$transaction(async (tx) => {
    for (const [sortOrder, id] of input.orderedIds.entries()) {
      await tx.housingListingMedia.update({
        where: { id },
        data: { sortOrder: sortOrder + 100 },
      });
    }
    for (const [sortOrder, id] of input.orderedIds.entries()) {
      await tx.housingListingMedia.update({
        where: { id },
        data: { sortOrder },
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: "HOUSING_LISTING_MEDIA_REORDERED",
      entityType: "HousingListing",
      entityId: input.listingId,
      newValue: { mediaIds: input.orderedIds },
      ...input.meta,
    });
  });
  revalidateHousing({ listingId: input.listingId });
  return { reordered: true };
}

export async function removeHousingListingMedia(input: {
  actorId: string;
  actorRole: string;
  listingId: string;
  mediaId: string;
  meta?: RequestMeta;
}) {
  await assertHousingListingOwner({
    userId: input.actorId,
    listingId: input.listingId,
  });
  const item = await prisma.housingListingMedia.findFirst({
    where: { id: input.mediaId, listingId: input.listingId },
    select: { id: true, mediaId: true, isCover: true },
  });
  if (!item) throw new HousingMediaError("Housing media not found.", 404);
  await prisma.housingListingMedia.delete({ where: { id: item.id } });
  await removeOwnedMedia(
    { id: input.actorId, role: input.actorRole },
    item.mediaId,
    input.meta,
  );
  if (item.isCover) {
    const next = await prisma.housingListingMedia.findFirst({
      where: {
        listingId: input.listingId,
        kind: { not: "PROOF_DOCUMENT" },
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (next) {
      await prisma.housingListingMedia.update({
        where: { id: next.id },
        data: { isCover: true },
      });
    }
  }
  revalidateHousing({ listingId: input.listingId });
  return { removed: true };
}
