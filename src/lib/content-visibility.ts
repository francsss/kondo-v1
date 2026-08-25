import type {
  BookmarkTargetType,
  ContentStatus,
  ListingStatus,
  Prisma,
} from "@prisma/client";
import { canAccessAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export type VisibilityViewer = {
  id: string;
  role?: string | null;
};

type CommunityVisibilityOptions = {
  moderatorOverride?: boolean;
};

export function communityVisibilityWhere(
  viewer: VisibilityViewer,
  options: CommunityVisibilityOptions = {},
): Prisma.CommunityWhereInput {
  if (options.moderatorOverride && canAccessAdmin(viewer.role)) return {};

  return {
    AND: [
      { status: { not: "REMOVED" } },
      {
        OR: [
          { status: "ACTIVE", isPrivate: false },
          { members: { some: { userId: viewer.id } } },
          {
            accessRequests: {
              some: {
                userId: viewer.id,
                type: "INVITATION",
                status: "PENDING",
              },
            },
          },
        ],
      },
    ],
  };
}

export function publishedPostVisibilityWhere(
  viewer: VisibilityViewer,
  options: CommunityVisibilityOptions = {},
): Prisma.PostWhereInput {
  return {
    status: "PUBLISHED",
    community: communityVisibilityWhere(viewer, options),
  };
}

export function activeListingWhere(
  now = new Date(),
): Prisma.MarketplaceListingWhereInput {
  return {
    status: "ACTIVE",
    expiresAt: { gt: now },
    category: { isActive: true },
  };
}

/**
 * The condition a media asset must meet before a page may point an `<img>` at
 * it — the same one `getMediaForDelivery` enforces on `/api/media/[id]`.
 *
 * A card asks for an image by id and the media route decides whether to serve
 * it. When the two disagree, nothing errors: the page renders an `<img>` whose
 * request 404s, and the reader sees an item with a blank square where its
 * photo should be. That is what "the image sometimes does not appear" was —
 * the association was never lost, the asset behind it simply was not
 * deliverable, most often because an upload was abandoned before it validated
 * and the row it left behind was still the first one the query took.
 *
 * Selecting through this makes the query agree with the route by construction.
 */
export const deliverableMediaWhere = {
  status: "ACTIVE",
  scanStatus: "CLEAN",
} satisfies Prisma.MediaAssetWhereInput;

/**
 * Listing images that can actually be drawn, in gallery order.
 *
 * `take` cannot be applied before the filter, so a query that asked for the
 * first image row and no more could hand back an abandoned upload while the
 * real photo sat behind it. Every surface that shows a listing selects through
 * this, so "the first image" always means "the first image that exists".
 */
export function listingImagesSelect(take?: number) {
  return {
    where: { mediaId: { not: null }, media: deliverableMediaWhere },
    orderBy: { order: "asc" as const },
    select: { id: true, mediaId: true, altText: true },
    ...(take ? { take } : {}),
  } satisfies Prisma.MarketplaceListing$imagesArgs;
}

export const publishedQuestionWhere = {
  status: "PUBLISHED",
} satisfies Prisma.QuestionWhereInput;

export const publishedAnswerWhere = {
  status: "PUBLISHED",
  question: publishedQuestionWhere,
} satisfies Prisma.AnswerWhereInput;

/*
 * A guide is readable when it is published *and* its content status allows it.
 *
 * Publication and verification answer different questions — visible, versus
 * vouched for — but DRAFT and ARCHIVED must never reach a reader through any
 * route. Enforcing that here rather than at each call site means search, the
 * Student Hub, the platform lists and the visibility checks all inherit it,
 * and a new query cannot forget.
 */
export const publishedGuideWhere = {
  published: true,
  contentStatus: { in: ["VERIFIED", "NEEDS_REVIEW"] },
} satisfies Prisma.GuideWhereInput;

export const publishedGuideStepWhere = {
  guide: publishedGuideWhere,
} satisfies Prisma.GuideStepWhereInput;

export function canViewCommunity(args: {
  status?: string;
  isPrivate: boolean;
  isMember: boolean;
  isInvited?: boolean;
  viewerRole?: string | null;
  moderatorOverride?: boolean;
}) {
  if (args.status === "REMOVED") return false;
  if (args.status && args.status !== "ACTIVE" && !args.isMember) return false;
  return (
    !args.isPrivate ||
    args.isMember ||
    args.isInvited ||
    Boolean(args.moderatorOverride && canAccessAdmin(args.viewerRole))
  );
}

export function canViewPost(args: {
  status: ContentStatus | string;
  communityIsPrivate: boolean;
  isCommunityMember: boolean;
  viewerRole?: string | null;
  moderatorOverride?: boolean;
}) {
  return (
    args.status === "PUBLISHED" &&
    canViewCommunity({
      isPrivate: args.communityIsPrivate,
      isMember: args.isCommunityMember,
      viewerRole: args.viewerRole,
      moderatorOverride: args.moderatorOverride,
    })
  );
}

export function canViewListing(status: ListingStatus | string) {
  return status === "ACTIVE";
}

export function canViewQuestion(status: ContentStatus | string) {
  return status === "PUBLISHED";
}

export function canViewAnswer(args: {
  status: ContentStatus | string;
  questionStatus: ContentStatus | string;
}) {
  return args.status === "PUBLISHED" && args.questionStatus === "PUBLISHED";
}

export function canViewGuide(published: boolean) {
  return published;
}

export async function bookmarkTargetIsVisible(
  viewer: VisibilityViewer,
  targetType: BookmarkTargetType,
  targetId: string,
) {
  switch (targetType) {
    case "POST":
      return Boolean(
        await prisma.post.findFirst({
          where: {
            id: targetId,
            ...publishedPostVisibilityWhere(viewer),
          },
          select: { id: true },
        }),
      );
    case "LISTING":
      return Boolean(
        await prisma.marketplaceListing.findFirst({
          where: { id: targetId, ...activeListingWhere() },
          select: { id: true },
        }),
      );
    case "GUIDE":
      return Boolean(
        await prisma.guide.findFirst({
          where: { id: targetId, ...publishedGuideWhere },
          select: { id: true },
        }),
      );
    case "QUESTION":
      return Boolean(
        await prisma.question.findFirst({
          where: { id: targetId, ...publishedQuestionWhere },
          select: { id: true },
        }),
      );
  }
}
