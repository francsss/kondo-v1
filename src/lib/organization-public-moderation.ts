import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission } from "@/lib/authorization";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { revalidateOrganizationPublicSurfaces } from "@/lib/organization-cache";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; role: string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export async function moderateOrganizationPublicProfile(
  actor: Actor,
  organizationId: string,
  input: {
    action: "REQUEST_CORRECTION" | "UNPUBLISH" | "RESTORE";
    reason: string;
  },
  meta: RequestMeta = {},
) {
  const permission =
    input.action === "UNPUBLISH"
      ? "ORGANIZATION_PUBLIC_PROFILES_UNPUBLISH"
      : input.action === "RESTORE"
        ? "ORGANIZATION_PUBLIC_PROFILES_RESTORE"
        : "ORGANIZATION_PUBLIC_PROFILES_MODERATE";
  if (!hasAdminPermission(actor.role, permission)) {
    throw new OrganizationError("Access denied.", 403);
  }
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        slug: true,
        publicName: true,
        publicProfileStatus: true,
        publicProfileBlockedAt: true,
        city: { select: { slug: true } },
        memberships: {
          where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
          select: { userId: true },
        },
      },
    });
    if (!current) throw new OrganizationError("Organization not found.", 404);
    if (
      input.action === "UNPUBLISH" &&
      current.publicProfileStatus !== "PUBLISHED"
    ) {
      throw new OrganizationError(
        "Only a published organization profile can be unpublished.",
        409,
      );
    }
    if (input.action === "RESTORE" && !current.publicProfileBlockedAt) {
      throw new OrganizationError(
        "This public profile has no moderation restriction to restore.",
        409,
      );
    }
    const data =
      input.action === "REQUEST_CORRECTION"
        ? { correctionRequestedAt: now }
        : input.action === "UNPUBLISH"
          ? {
              publicProfileStatus: "UNPUBLISHED" as const,
              unpublishedAt: now,
              publicProfileBlockedAt: now,
              publicProfileBlockReason: input.reason,
              correctionRequestedAt: now,
              publicationVersion: { increment: 1 },
            }
          : {
              publicProfileBlockedAt: null,
              publicProfileBlockReason: null,
              correctionRequestedAt: null,
            };
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data,
      select: { id: true, slug: true, publicProfileStatus: true },
    });
    for (const member of current.memberships) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: member.userId,
        actorId: actor.id,
        type: "MODERATION_UPDATE",
        templateKey: "ORGANIZATION_PUBLIC_PROFILE_CORRECTION",
        data: {
          organizationName: current.publicName,
          outcome: input.reason,
        },
        href: `/organizations/${current.slug}/public-profile`,
        dedupeKey: `organization-public-moderation:${organizationId}:${input.action}:${now.getTime()}:${member.userId}`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: `ORGANIZATION_PUBLIC_PROFILE_${input.action}`,
      entityType: "Organization",
      entityId: organizationId,
      oldValue: {
        publicProfileStatus: current.publicProfileStatus,
        blocked: Boolean(current.publicProfileBlockedAt),
      },
      newValue: {
        publicProfileStatus: updated.publicProfileStatus,
        reason: input.reason,
      },
      ...meta,
    });
    return { ...updated, citySlug: current.city?.slug ?? null };
  });
  revalidateOrganizationPublicSurfaces(result);
  return result;
}
