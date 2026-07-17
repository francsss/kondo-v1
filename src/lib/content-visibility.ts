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

export const publishedQuestionWhere = {
  status: "PUBLISHED",
} satisfies Prisma.QuestionWhereInput;

export const publishedAnswerWhere = {
  status: "PUBLISHED",
  question: publishedQuestionWhere,
} satisfies Prisma.AnswerWhereInput;

export const publishedGuideWhere = {
  published: true,
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
