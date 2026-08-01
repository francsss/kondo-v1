import { writeAuditLog } from "@/lib/audit";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { revalidateCatalogResource } from "@/lib/organization-catalog-cache";
import type { CatalogKind } from "@/lib/organization-catalog-permissions";
import { requireCatalogPublisher } from "@/lib/organization-catalog-permissions";
import { OrganizationCatalogError } from "@/lib/organization-catalog";
import { prisma } from "@/lib/prisma";

export async function attachCatalogMedia(input: {
  kind: CatalogKind;
  userId: string;
  organizationId: string;
  resourceId: string;
  mediaId: string;
  mediaKind: "COVER" | "GALLERY";
  altText: string;
}) {
  const context = await requireCatalogPublisher({ ...input, action: "edit" });
  const record =
    input.kind === "product"
      ? await prisma.organizationProduct.findFirst({
          where: { id: input.resourceId, organizationId: input.organizationId },
          select: { id: true, slug: true, city: { select: { slug: true } } },
        })
      : await prisma.organizationService.findFirst({
          where: { id: input.resourceId, organizationId: input.organizationId },
          select: { id: true, slug: true, city: { select: { slug: true } } },
        });
  if (!record)
    throw new OrganizationCatalogError("Catalog item not found.", 404);
  try {
    await prisma.$transaction(async (tx) => {
      const count =
        input.kind === "product"
          ? await tx.organizationProductMedia.count({
              where: { productId: record.id },
            })
          : await tx.organizationServiceMedia.count({
              where: { serviceId: record.id },
            });
      if (count >= 8) {
        throw new OrganizationCatalogError(
          "A catalog item can contain up to 8 images.",
          400,
        );
      }
      if (input.mediaKind === "COVER") {
        const existing =
          input.kind === "product"
            ? await tx.organizationProductMedia.findFirst({
                where: { productId: record.id, kind: "COVER" },
                select: { id: true, mediaId: true },
              })
            : await tx.organizationServiceMedia.findFirst({
                where: { serviceId: record.id, kind: "COVER" },
                select: { id: true, mediaId: true },
              });
        if (existing) {
          if (input.kind === "product") {
            await tx.organizationProductMedia.delete({
              where: { id: existing.id },
            });
          } else {
            await tx.organizationServiceMedia.delete({
              where: { id: existing.id },
            });
          }
          await tx.mediaAsset.updateMany({
            where: { id: existing.mediaId },
            data: {
              attachmentType: null,
              attachmentId: null,
              attachedAt: null,
            },
          });
        }
      }
      await attachMediaAsset(tx, {
        ownerId: input.userId,
        assetId: input.mediaId,
        purpose:
          input.kind === "product"
            ? "ORGANIZATION_PRODUCT_IMAGE"
            : "ORGANIZATION_SERVICE_IMAGE",
        attachmentType:
          input.kind === "product"
            ? "ORGANIZATION_PRODUCT"
            : "ORGANIZATION_SERVICE",
        attachmentId: record.id,
      });
      if (input.kind === "product") {
        const sortOrder = await tx.organizationProductMedia.count({
          where: { productId: record.id },
        });
        await tx.organizationProductMedia.create({
          data: {
            productId: record.id,
            mediaId: input.mediaId,
            kind: input.mediaKind,
            altText: input.altText,
            sortOrder,
          },
        });
      } else {
        const sortOrder = await tx.organizationServiceMedia.count({
          where: { serviceId: record.id },
        });
        await tx.organizationServiceMedia.create({
          data: {
            serviceId: record.id,
            mediaId: input.mediaId,
            kind: input.mediaKind,
            altText: input.altText,
            sortOrder,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof MediaError) {
      throw new OrganizationCatalogError(error.message, error.status);
    }
    throw error;
  }
  await writeAuditLog({
    actorId: input.userId,
    organizationId: input.organizationId,
    action: `ORGANIZATION_${input.kind.toUpperCase()}_MEDIA_ATTACHED`,
    entityType:
      input.kind === "product" ? "OrganizationProduct" : "OrganizationService",
    entityId: record.id,
  });
  revalidateCatalogResource({
    kind: input.kind,
    slug: record.slug,
    organizationSlug: context.organization.slug,
    citySlug: record.city?.slug,
  });
  return { mediaId: input.mediaId };
}
