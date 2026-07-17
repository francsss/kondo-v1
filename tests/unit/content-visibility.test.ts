import { describe, expect, it } from "vitest";
import {
  canViewAnswer,
  canViewCommunity,
  canViewGuide,
  canViewListing,
  canViewPost,
  canViewQuestion,
  communityVisibilityWhere,
  activeListingWhere,
  publishedPostVisibilityWhere,
} from "@/lib/content-visibility";

describe("content visibility policy", () => {
  it("shows public communities and member-only private communities", () => {
    expect(canViewCommunity({ isPrivate: false, isMember: false })).toBe(true);
    expect(canViewCommunity({ isPrivate: true, isMember: true })).toBe(true);
    expect(canViewCommunity({ isPrivate: true, isMember: false })).toBe(false);
  });

  it("keeps the existing moderation override limited to explicit direct access", () => {
    expect(
      canViewCommunity({
        isPrivate: true,
        isMember: false,
        viewerRole: "MODERATOR",
        moderatorOverride: true,
      }),
    ).toBe(true);
    expect(
      canViewCommunity({
        isPrivate: true,
        isMember: false,
        viewerRole: "MODERATOR",
      }),
    ).toBe(false);
  });

  it("requires published posts and an accessible community", () => {
    expect(
      canViewPost({
        status: "PUBLISHED",
        communityIsPrivate: false,
        isCommunityMember: false,
      }),
    ).toBe(true);
    expect(
      canViewPost({
        status: "PUBLISHED",
        communityIsPrivate: true,
        isCommunityMember: false,
      }),
    ).toBe(false);
    expect(
      canViewPost({
        status: "REMOVED",
        communityIsPrivate: false,
        isCommunityMember: false,
      }),
    ).toBe(false);
  });

  it.each(["DRAFT", "RESERVED", "SOLD", "ARCHIVED", "REMOVED"])(
    "rejects non-active marketplace status %s",
    (status) => {
      expect(canViewListing(status)).toBe(false);
    },
  );

  it("accepts only active marketplace listings", () => {
    expect(canViewListing("ACTIVE")).toBe(true);
    const now = new Date("2026-07-16T12:00:00.000Z");
    expect(activeListingWhere(now)).toEqual({
      status: "ACTIVE",
      expiresAt: { gt: now },
      category: { isActive: true },
    });
  });

  it("requires published questions, answers, and parent questions", () => {
    expect(canViewQuestion("PUBLISHED")).toBe(true);
    expect(canViewQuestion("PENDING_REVIEW")).toBe(false);
    expect(
      canViewAnswer({
        status: "PUBLISHED",
        questionStatus: "PUBLISHED",
      }),
    ).toBe(true);
    expect(
      canViewAnswer({
        status: "PUBLISHED",
        questionStatus: "REMOVED",
      }),
    ).toBe(false);
    expect(
      canViewAnswer({
        status: "REMOVED",
        questionStatus: "PUBLISHED",
      }),
    ).toBe(false);
  });

  it("requires a published guide", () => {
    expect(canViewGuide(true)).toBe(true);
    expect(canViewGuide(false)).toBe(false);
  });

  it("builds member-scoped Prisma filters for communities and posts", () => {
    expect(communityVisibilityWhere({ id: "viewer-1" })).toEqual({
      AND: [
        { status: { not: "REMOVED" } },
        {
          OR: [
            { status: "ACTIVE", isPrivate: false },
            { members: { some: { userId: "viewer-1" } } },
            {
              accessRequests: {
                some: {
                  userId: "viewer-1",
                  type: "INVITATION",
                  status: "PENDING",
                },
              },
            },
          ],
        },
      ],
    });
    expect(publishedPostVisibilityWhere({ id: "viewer-1" })).toEqual({
      status: "PUBLISHED",
      community: communityVisibilityWhere({ id: "viewer-1" }),
    });
  });
});
