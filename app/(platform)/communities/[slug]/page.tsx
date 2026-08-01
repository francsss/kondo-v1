import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { CommunityExperience } from "@/components/features/community/CommunityExperience";
import { CommunityJoinButton } from "@/components/features/community/CommunityJoinButton";
import { CommunityPostFocus } from "@/components/features/community/CommunityPostFocus";
import { CommunityRequestsPanel } from "@/components/features/community/CommunityRequestsPanel";
import { ContentReportButton } from "@/components/features/community/ContentReportButton";
import { FeedPost } from "@/components/features/community/FeedPost";
import { PostComposer } from "@/components/features/community/PostComposer";
import { StoryPreviewRail } from "@/components/features/stories/StoryPreviewRail";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { communityVisibilityWhere } from "@/lib/content-visibility";
import { getCommunityRequestOverview } from "@/lib/community-requests";
import { prisma } from "@/lib/prisma";
import { toSafePublicOfficialFields } from "@/lib/serializers";
import { getCurrentUser, requireUser } from "@/lib/server-auth";
import { getContextualStories } from "@/lib/stories";

function postIncludeFor(userId: string) {
  return {
    author: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarKey: true,
        avatarMediaId: true,
        officialProfileStatus: true,
        officialOrganizationType: true,
        officialOrganizationName: true,
        officialVerifiedAt: true,
        country: { select: { emoji: true } },
        university: { select: { shortName: true, name: true } },
      },
    },
    community: {
      select: { name: true, slug: true, icon: true, isVerified: true },
    },
    media: {
      orderBy: { order: "asc" as const },
      select: { media: { select: { id: true, altText: true } } },
    },
    reactions: {
      where: { userId, type: "HELPFUL" as const },
      select: { id: true },
    },
    _count: {
      select: {
        comments: { where: { status: "PUBLISHED" as const } },
        reactions: true,
      },
    },
  } satisfies Prisma.PostInclude;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return { title: "Community" };
  const community = await prisma.community.findFirst({
    where: {
      AND: [
        { slug },
        communityVisibilityWhere(user, { moderatorOverride: true }),
      ],
    },
    select: { name: true, description: true },
  });
  return community
    ? { title: community.name, description: community.description }
    : { title: "Community" };
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ post?: string; page?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const query = await searchParams;
  const activeSection = ["requests", "about", "members", "guidelines"].includes(
    query.tab ?? "",
  )
    ? (query.tab as "requests" | "about" | "members" | "guidelines")
    : "feed";
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = 12;
  const community = await prisma.community.findFirst({
    where: {
      AND: [
        { slug },
        communityVisibilityWhere(user, { moderatorOverride: true }),
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarMediaId: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
        take: 6,
      },
      posts: {
        where: { status: "PUBLISHED" },
        include: postIncludeFor(user.id),
        orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
        skip: activeSection === "feed" ? (page - 1) * pageSize : 0,
        take: activeSection === "feed" ? pageSize : 0,
      },
      accessRequests: {
        where: { userId: user.id, status: "PENDING" },
        select: { id: true, type: true },
      },
      _count: {
        select: {
          members: true,
          posts: { where: { status: "PUBLISHED" } },
        },
      },
    },
  });
  if (!community) notFound();

  const membership = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: { communityId: community.id, userId: user.id },
    },
  });
  const joined = Boolean(membership);
  const canModerate = ["OWNER", "MODERATOR"].includes(membership?.role ?? "");
  const [requestOverview, communityStories] = await Promise.all([
    joined
      ? getCommunityRequestOverview({
          communityId: community.id,
          userId: user.id,
          includeLists: activeSection === "requests",
        })
      : Promise.resolve({
          communityRequests: [],
          myRequests: [],
          urgentCount: 0,
          spotlightRequest: null,
        }),
    getContextualStories(user, {
      communityId: community.id,
      limit: 5,
    }),
  ]);
  const selectedPost =
    query.post && activeSection === "feed"
      ? await prisma.post.findFirst({
          where: {
            id: query.post,
            communityId: community.id,
            status: "PUBLISHED",
          },
          include: postIncludeFor(user.id),
        })
      : null;
  const comments = selectedPost
    ? await prisma.comment.findMany({
        where: { postId: selectedPost.id, status: "PUBLISHED" },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarMediaId: true,
              officialProfileStatus: true,
              officialOrganizationType: true,
              officialOrganizationName: true,
              officialVerifiedAt: true,
              country: { select: { emoji: true } },
              university: { select: { shortName: true } },
            },
          },
          reactions: {
            where: { userId: user.id, type: "HELPFUL" },
            select: { id: true },
          },
          _count: { select: { reactions: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      })
    : [];
  const pageCount = Math.max(1, Math.ceil(community._count.posts / pageSize));
  const safePosts = community.posts.map((post) => ({
    ...post,
    author: {
      ...post.author,
      ...toSafePublicOfficialFields(post.author),
    },
  }));
  const safeSelectedPost = selectedPost
    ? {
        ...selectedPost,
        author: {
          ...selectedPost.author,
          ...toSafePublicOfficialFields(selectedPost.author),
        },
      }
    : null;
  const safeComments = comments.map((comment) => ({
    ...comment,
    author: {
      ...comment.author,
      ...toSafePublicOfficialFields(comment.author),
    },
  }));

  return (
    <CommunityExperience
      activeSection={activeSection}
      canModerate={canModerate}
      community={{
        name: community.name,
        slug: community.slug,
        description: community.description,
        icon: community.icon,
        coverMediaId: community.coverMediaId,
        isVerified: community.isVerified,
        isOfficial: community.isOfficial,
        status: community.status,
        joinPolicy: community.joinPolicy,
        memberCount: community._count.members,
        postCount: community._count.posts,
      }}
      primaryActions={
        <>
          {canModerate ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/communities/${community.slug}/manage`}>
                <Settings aria-hidden="true" className="h-4 w-4" />
                Manage
              </Link>
            </Button>
          ) : null}
          {community.status === "ACTIVE" ? (
            <CommunityJoinButton
              communityId={community.id}
              initialJoined={joined}
              initialPending={Boolean(community.accessRequests.length)}
              joinPolicy={community.joinPolicy}
            />
          ) : null}
          {!canModerate ? (
            <ContentReportButton
              endpoint={`/api/communities/${community.id}/report`}
            />
          ) : null}
        </>
      }
      spotlightRequest={requestOverview.spotlightRequest}
      urgentRequestCount={requestOverview.urgentCount}
    >
      {activeSection === "feed" ? (
        <main className="mx-auto max-w-[1480px] px-3 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10">
          <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,860px)_340px] xl:justify-center xl:gap-9">
            <section
              aria-labelledby="community-feed-heading"
              className="min-w-0 scroll-mt-24"
              id="feed"
            >
              <div className="mb-5 flex items-end justify-between gap-4 px-1">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
                    Community feed
                  </p>
                  <h2
                    className="mt-1 text-2xl font-black tracking-[-0.035em] text-kondo-ink dark:text-white sm:text-3xl"
                    id="community-feed-heading"
                  >
                    Latest conversations
                  </h2>
                </div>
                <p className="hidden text-xs font-semibold text-muted-foreground sm:block">
                  {community._count.posts.toLocaleString()}{" "}
                  {community._count.posts === 1 ? "post" : "posts"}
                </p>
              </div>

              <Card className="mb-5 flex items-center gap-3 rounded-[1.75rem] p-3.5 shadow-sm sm:p-4">
                <Avatar
                  className="h-10 w-10"
                  firstName={user.firstName}
                  lastName={user.lastName}
                  mediaId={user.avatarMediaId}
                  seed={user.id}
                />
                {joined && community.status === "ACTIVE" ? (
                  <PostComposer
                    communities={[
                      {
                        id: community.id,
                        name: community.name,
                        icon: community.icon,
                        canAnnounce: canModerate,
                      },
                    ]}
                    defaultCommunityId={community.id}
                    triggerLabel={`Start a conversation in ${community.name}…`}
                    triggerVariant="composer"
                  />
                ) : (
                  <p className="px-2 text-sm text-muted-foreground">
                    Join this active community to start a conversation.
                  </p>
                )}
              </Card>

              {communityStories.length ? (
                <div className="mb-5">
                  <StoryPreviewRail
                    compact
                    entryPoint="community"
                    eyebrow={`Stories in ${community.name}`}
                    stories={communityStories}
                    title="Watch what members want others to know."
                  />
                </div>
              ) : null}

              <div className="space-y-5">
                {safePosts.map((post) => (
                  <div key={post.id}>
                    <FeedPost
                      canModerate={canModerate}
                      currentUserId={user.id}
                      focused={safeSelectedPost?.id === post.id}
                      immersive
                      post={post}
                    />
                  </div>
                ))}
              </div>

              {!community.posts.length ? (
                <Card className="py-16 text-center">
                  <p className="text-base font-black text-foreground">
                    The conversation starts here.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Be the first member to share something useful.
                  </p>
                </Card>
              ) : null}

              {pageCount > 1 ? (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Page {page} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        href={`/communities/${slug}?page=${Math.max(1, page - 1)}`}
                      >
                        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                        Previous
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        href={`/communities/${slug}?page=${Math.min(pageCount, page + 1)}`}
                      >
                        Next
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="space-y-5 xl:sticky xl:top-24">
              <Card className="scroll-mt-24 rounded-[1.75rem] p-6" id="about">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
                  About
                </p>
                <h2 className="mt-2 text-xl font-black text-kondo-ink dark:text-white">
                  A space built on trust
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {community.description}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-muted/60 p-3.5">
                    <p className="text-xl font-black text-foreground">
                      {community._count.members.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      Members
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-3.5">
                    <p className="text-xl font-black text-foreground">
                      {community._count.posts.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      Posts
                    </p>
                  </div>
                </div>
                <div className="mt-5 border-t border-border pt-5">
                  <p className="text-sm font-black text-foreground">
                    Community care
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    Be generous, protect privacy, and keep advice grounded in
                    lived experience.
                  </p>
                  <Link
                    className="mt-3 inline-flex text-xs font-black text-kondo-green hover:underline"
                    href="/guidelines"
                  >
                    Read the guidelines
                  </Link>
                </div>
              </Card>

              <Card className="scroll-mt-24 rounded-[1.75rem] p-6" id="members">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
                      Members
                    </p>
                    <h2 className="mt-1 text-lg font-black text-kondo-ink dark:text-white">
                      New around here
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">
                    {community._count.members.toLocaleString()} total
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {community.members.map((member) => (
                    <div className="flex items-center gap-3" key={member.id}>
                      <Avatar
                        className="h-10 w-10"
                        firstName={member.user.firstName}
                        lastName={member.user.lastName}
                        mediaId={member.user.avatarMediaId}
                        seed={member.user.id}
                      />
                      <p className="min-w-0 truncate text-sm font-bold text-foreground">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </aside>
          </div>
        </main>
      ) : activeSection === "requests" ? (
        <CommunityRequestsPanel
          canCreate={joined && community.status === "ACTIVE"}
          communityId={community.id}
          communityName={community.name}
          communityRequests={requestOverview.communityRequests}
          isMember={joined}
          myRequests={requestOverview.myRequests}
        />
      ) : activeSection === "about" ? (
        <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">
          <Card className="rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
              About this community
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">
              A space built on trust
            </h2>
            <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-muted-foreground">
              {community.description}
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-muted/60 p-5">
                <p className="text-2xl font-black">
                  {community._count.members.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Members</p>
              </div>
              <div className="rounded-3xl bg-muted/60 p-5">
                <p className="text-2xl font-black">
                  {community._count.posts.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Posts</p>
              </div>
            </div>
          </Card>
        </main>
      ) : activeSection === "members" ? (
        <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">
          <Card className="rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
              Members
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">
              New around here
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {community._count.members.toLocaleString()} members in this
              community
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {community.members.map((member) => (
                <div
                  className="flex items-center gap-3 rounded-3xl border border-border p-4"
                  key={member.id}
                >
                  <Avatar
                    className="h-11 w-11"
                    firstName={member.user.firstName}
                    lastName={member.user.lastName}
                    mediaId={member.user.avatarMediaId}
                    seed={member.user.id}
                  />
                  <p className="min-w-0 truncate font-bold">
                    {member.user.firstName} {member.user.lastName}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </main>
      ) : (
        <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">
          <Card className="rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
              Community care
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">
              Share generously. Protect each other.
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Keep advice grounded in lived experience, protect personal
              information, and report anything unsafe or misleading privately to
              Kondo.
            </p>
            <Button asChild className="mt-6">
              <Link href="/guidelines">Read the full Kondo guidelines</Link>
            </Button>
          </Card>
        </main>
      )}
      {safeSelectedPost ? (
        <CommunityPostFocus
          canComment={joined}
          canModerate={canModerate}
          closeHref={
            page > 1
              ? `/communities/${community.slug}?page=${page}`
              : `/communities/${community.slug}`
          }
          comments={safeComments}
          currentUserId={user.id}
          post={safeSelectedPost}
        />
      ) : null}
    </CommunityExperience>
  );
}
