import { writeAuditLog } from "@/lib/audit";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { revalidateOpportunity } from "@/lib/opportunity-cache";
import {
  requireOpportunityPublisher,
  OpportunityAccessError,
} from "@/lib/opportunity-permissions";
import { prisma } from "@/lib/prisma";

async function ownedOpportunity(input: {
  opportunityId: string;
  organizationId: string;
}) {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: input.opportunityId,
      publisherOrganizationId: input.organizationId,
    },
    select: {
      id: true,
      slug: true,
      type: true,
      publisherOrganization: { select: { slug: true } },
    },
  });
  if (!opportunity) {
    throw new OpportunityAccessError("Opportunity not found.", 404);
  }
  return opportunity;
}

export async function setOpportunityCover(input: {
  userId: string;
  organizationId: string;
  opportunityId: string;
  mediaId: string;
  altText: string;
}) {
  const opportunity = await ownedOpportunity(input);
  await requireOpportunityPublisher({
    userId: input.userId,
    organizationId: input.organizationId,
    type: opportunity.type,
    permission: "ORGANIZATION_EDIT_OPPORTUNITIES",
  });

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.opportunityMedia.findFirst({
        where: { opportunityId: opportunity.id, isCover: true },
        select: { id: true, mediaId: true },
      });
      if (existing?.mediaId === input.mediaId) {
        await tx.opportunityMedia.update({
          where: { id: existing.id },
          data: { altText: input.altText },
        });
        return;
      }
      if (existing) {
        await tx.opportunityMedia.delete({ where: { id: existing.id } });
        await tx.mediaAsset.updateMany({
          where: {
            id: existing.mediaId,
            attachmentType: "OPPORTUNITY_COVER",
            attachmentId: opportunity.id,
          },
          data: { attachmentType: null, attachmentId: null, attachedAt: null },
        });
      }
      await attachMediaAsset(tx, {
        ownerId: input.userId,
        assetId: input.mediaId,
        purpose: "OPPORTUNITY_COVER_IMAGE",
        attachmentType: "OPPORTUNITY_COVER",
        attachmentId: opportunity.id,
      });
      await tx.opportunityMedia.create({
        data: {
          opportunityId: opportunity.id,
          mediaId: input.mediaId,
          kind: "COVER",
          isCover: true,
          altText: input.altText,
        },
      });
    });
  } catch (error) {
    if (error instanceof MediaError) {
      throw new OpportunityAccessError(error.message, error.status);
    }
    throw error;
  }

  await writeAuditLog({
    actorId: input.userId,
    organizationId: input.organizationId,
    action: "OPPORTUNITY_COVER_UPDATED",
    entityType: "Opportunity",
    entityId: opportunity.id,
  });
  revalidateOpportunity({
    opportunityId: opportunity.id,
    slug: opportunity.slug,
    organizationSlug: opportunity.publisherOrganization?.slug,
  });
  return { mediaId: input.mediaId, altText: input.altText };
}
