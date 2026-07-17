import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  answerFindFirst: vi.fn(),
  answerVoteDeleteMany: vi.fn(),
  answerVoteUpsert: vi.fn(),
  bookmarkUpsert: vi.fn(),
  getCurrentUser: vi.fn(),
  guideProgressDeleteMany: vi.fn(),
  guideProgressUpsert: vi.fn(),
  guideStepFindFirst: vi.fn(),
  listingFavoriteDeleteMany: vi.fn(),
  listingFavoriteUpsert: vi.fn(),
  listingFindFirst: vi.fn(),
  postFindFirst: vi.fn(),
  reactionDeleteMany: vi.fn(),
  reactionUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    answer: { findFirst: mocks.answerFindFirst },
    answerVote: {
      deleteMany: mocks.answerVoteDeleteMany,
      upsert: mocks.answerVoteUpsert,
    },
    bookmark: { upsert: mocks.bookmarkUpsert },
    guide: { findFirst: vi.fn() },
    guideProgress: {
      deleteMany: mocks.guideProgressDeleteMany,
      upsert: mocks.guideProgressUpsert,
    },
    guideStep: { findFirst: mocks.guideStepFindFirst },
    marketplaceListing: { findFirst: mocks.listingFindFirst },
    listingFavorite: {
      deleteMany: mocks.listingFavoriteDeleteMany,
      upsert: mocks.listingFavoriteUpsert,
    },
    post: { findFirst: mocks.postFindFirst },
    question: { findFirst: vi.fn() },
    reaction: {
      deleteMany: mocks.reactionDeleteMany,
      upsert: mocks.reactionUpsert,
    },
  },
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/request", () => ({
  hasTrustedOrigin: () => true,
  jsonError: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
}));

import { PUT as voteForAnswer } from "../../app/api/answers/[id]/votes/route";
import { PUT as saveBookmark } from "../../app/api/bookmarks/[targetType]/[targetId]/route";
import { PUT as completeGuideStep } from "../../app/api/guides/progress/[stepId]/route";
import { POST as favoriteListing } from "../../app/api/marketplace/[id]/favorites/route";
import { POST as reactToPost } from "../../app/api/posts/[id]/reactions/route";

const request = (method: string, body?: object) =>
  new NextRequest("http://localhost:3000/api/test", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("protected mutation targets", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "viewer-1",
      role: "MEMBER",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(["DRAFT", "RESERVED", "SOLD", "ARCHIVED", "REMOVED"])(
    "rejects favoriting a %s listing",
    async () => {
      mocks.listingFindFirst.mockResolvedValue(null);
      const response = await favoriteListing(request("POST"), {
        params: Promise.resolve({ id: "listing-1" }),
      });

      expect(response.status).toBe(404);
      expect(mocks.listingFavoriteUpsert).not.toHaveBeenCalled();
      expect(mocks.listingFindFirst).toHaveBeenCalledWith({
        where: { id: "listing-1", status: "ACTIVE" },
        select: { id: true },
      });
    },
  );

  it("allows favoriting an active listing", async () => {
    mocks.listingFindFirst.mockResolvedValue({ id: "listing-1" });
    mocks.listingFavoriteUpsert.mockResolvedValue({ id: "favorite-1" });
    const response = await favoriteListing(request("POST"), {
      params: Promise.resolve({ id: "listing-1" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.listingFavoriteUpsert).toHaveBeenCalledOnce();
  });

  it.each([
    "answer pending",
    "answer removed",
    "parent question pending",
    "parent question removed",
    "answer missing",
  ])("rejects a vote when the target is not publishable: %s", async () => {
    mocks.answerFindFirst.mockResolvedValue(null);
    const response = await voteForAnswer(request("PUT"), {
      params: Promise.resolve({ id: "answer-1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.answerVoteUpsert).not.toHaveBeenCalled();
    expect(mocks.answerFindFirst).toHaveBeenCalledWith({
      where: {
        id: "answer-1",
        status: "PUBLISHED",
        question: { status: "PUBLISHED" },
      },
      select: { id: true },
    });
  });

  it("allows voting on a published answer to a published question", async () => {
    mocks.answerFindFirst.mockResolvedValue({ id: "answer-1" });
    mocks.answerVoteUpsert.mockResolvedValue({ id: "vote-1" });
    const response = await voteForAnswer(request("PUT"), {
      params: Promise.resolve({ id: "answer-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.answerVoteUpsert).toHaveBeenCalledOnce();
  });

  it.each(["unpublished guide", "unknown step"])(
    "rejects guide progress for an %s",
    async () => {
      mocks.guideStepFindFirst.mockResolvedValue(null);
      const response = await completeGuideStep(request("PUT"), {
        params: Promise.resolve({ stepId: "step-1" }),
      });

      expect(response.status).toBe(404);
      expect(mocks.guideProgressUpsert).not.toHaveBeenCalled();
      expect(mocks.guideStepFindFirst).toHaveBeenCalledWith({
        where: { id: "step-1", guide: { published: true } },
        select: { id: true },
      });
    },
  );

  it("allows progress on a step from a published guide", async () => {
    mocks.guideStepFindFirst.mockResolvedValue({ id: "step-1" });
    mocks.guideProgressUpsert.mockResolvedValue({ id: "progress-1" });
    const response = await completeGuideStep(request("PUT"), {
      params: Promise.resolve({ stepId: "step-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.guideProgressUpsert).toHaveBeenCalledOnce();
  });

  it.each(["unpublished post", "private non-member post", "unknown post"])(
    "rejects reactions for an inaccessible target: %s",
    async () => {
      mocks.postFindFirst.mockResolvedValue(null);
      const response = await reactToPost(request("POST", { type: "HELPFUL" }), {
        params: Promise.resolve({ id: "post-1" }),
      });

      expect(response.status).toBe(404);
      expect(mocks.reactionUpsert).not.toHaveBeenCalled();
      expect(mocks.postFindFirst).toHaveBeenCalledWith({
        where: {
          id: "post-1",
          status: "PUBLISHED",
          community: {
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
          },
        },
        select: { id: true },
      });
    },
  );

  it("keeps reaction upsert for an accessible published post", async () => {
    mocks.postFindFirst.mockResolvedValue({ id: "post-1" });
    mocks.reactionUpsert.mockResolvedValue({ id: "reaction-1" });
    const response = await reactToPost(request("POST", { type: "HELPFUL" }), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.reactionUpsert).toHaveBeenCalledOnce();
  });

  it("rejects bookmarking an inaccessible private-community post", async () => {
    mocks.postFindFirst.mockResolvedValue(null);
    const response = await saveBookmark(request("PUT"), {
      params: Promise.resolve({
        targetType: "POST",
        targetId: "post-1",
      }),
    });

    expect(response.status).toBe(404);
    expect(mocks.bookmarkUpsert).not.toHaveBeenCalled();
  });

  it("does not let a global moderator bookmark a private post without membership", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "moderator-1",
      role: "MODERATOR",
    });
    mocks.postFindFirst.mockResolvedValue(null);

    const response = await saveBookmark(request("PUT"), {
      params: Promise.resolve({
        targetType: "POST",
        targetId: "private-post",
      }),
    });

    expect(response.status).toBe(404);
    expect(mocks.postFindFirst).toHaveBeenCalledWith({
      where: {
        id: "private-post",
        status: "PUBLISHED",
        community: {
          AND: [
            { status: { not: "REMOVED" } },
            {
              OR: [
                { status: "ACTIVE", isPrivate: false },
                { members: { some: { userId: "moderator-1" } } },
                {
                  accessRequests: {
                    some: {
                      userId: "moderator-1",
                      type: "INVITATION",
                      status: "PENDING",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      select: { id: true },
    });
    expect(mocks.bookmarkUpsert).not.toHaveBeenCalled();
  });

  it("allows bookmarking an active listing", async () => {
    mocks.listingFindFirst.mockResolvedValue({ id: "listing-1" });
    mocks.bookmarkUpsert.mockResolvedValue({ id: "bookmark-1" });
    const response = await saveBookmark(request("PUT"), {
      params: Promise.resolve({
        targetType: "LISTING",
        targetId: "listing-1",
      }),
    });

    expect(response.status).toBe(201);
    expect(mocks.bookmarkUpsert).toHaveBeenCalledOnce();
  });
});
