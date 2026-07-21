import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import { CommentThread } from "@/components/features/community/CommentThread";
import { CommunityJoinButton } from "@/components/features/community/CommunityJoinButton";
import { ContentReportButton } from "@/components/features/community/ContentReportButton";
import { FeedPost } from "@/components/features/community/FeedPost";
import { PostComposer } from "@/components/features/community/PostComposer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { communityVisibilityWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/lib/server-auth";

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
  searchParams: Promise<{ post?: string; page?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const query = await searchParams;
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
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { joinedAt: "desc" },
        take: 6,
      },
      posts: {
        where: { status: "PUBLISHED" },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarKey: true,
              country: { select: { emoji: true } },
              university: { select: { shortName: true, name: true } },
            },
          },
          community: {
            select: { name: true, slug: true, icon: true, isVerified: true },
          },
          media: {
            orderBy: { order: "asc" },
            select: { media: { select: { id: true, altText: true } } },
          },
          reactions: {
            where: { userId: user.id, type: "HELPFUL" },
            select: { id: true },
          },
          _count: {
            select: {
              comments: { where: { status: "PUBLISHED" } },
              reactions: true,
            },
          },
        },
        orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
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
  const selectedPost = query.post
    ? await prisma.post.findFirst({
        where: {
          id: query.post,
          communityId: community.id,
          status: "PUBLISHED",
        },
        select: { id: true },
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

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <section className="noise relative overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#238164] p-7 text-white shadow-lift sm:p-10">
        {community.coverMediaId ? (
          <>
            <MediaImage
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
              height={720}
              mediaId={community.coverMediaId}
              priority
              sizes="(min-width: 1180px) 1180px, 100vw"
              width={1440}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-kondo-navy/95 via-kondo-forest/85 to-kondo-forest/40" />
          </>
        ) : null}
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-28 h-80 w-80 rounded-full border-[52px] border-white/5"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-3xl shadow-lg">
                {community.icon}
              </span>
              {community.status !== "ACTIVE" ? (
                <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-black text-amber-200">
                  {community.status.replaceAll("_", " ")}
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex items-center gap-2">
              <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                {community.name}
              </h1>
              {community.isVerified ? (
                <BadgeCheck
                  aria-label="Verified"
                  className="h-6 w-6 text-kondo-lime"
                />
              ) : null}
              {community.isOfficial ? (
                <span className="rounded-full bg-kondo-lime/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-kondo-lime">
                  Official
                </span>
              ) : null}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              {community.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {community._count.members.toLocaleString()} members
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" />
                {community._count.posts} posts
              </span>
              <span>{community.joinPolicy.replaceAll("_", " ")}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canModerate ? (
              <Button
                asChild
                className="bg-white/10 text-white shadow-none hover:bg-white/20"
                size="sm"
              >
                <Link href={`/communities/${community.slug}/manage`}>
                  <Settings className="h-4 w-4" /> Manage
                </Link>
              </Button>
            ) : null}
            {community.status === "ACTIVE" ? (
              <CommunityJoinButton
                communityId={community.id}
                initialJoined={joined}
                initialPending={Boolean(community.accessRequests.length)}
                inverse
                joinPolicy={community.joinPolicy}
              />
            ) : null}
            {!canModerate ? (
              <ContentReportButton
                endpoint={`/api/communities/${community.id}/report`}
                inverse
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-5">
          <Card className="flex items-center gap-3 p-4">
            <Avatar firstName={user.firstName} lastName={user.lastName} />
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
              <p className="text-sm text-muted-foreground">
                Join this active community to start a conversation.
              </p>
            )}
          </Card>
          {community.posts.map((post) => (
            <FeedPost
              canModerate={canModerate}
              currentUserId={user.id}
              key={post.id}
              post={post}
            />
          ))}
          {!community.posts.length ? (
            <Card className="py-14 text-center text-sm text-muted-foreground">
              No published posts on this page.
            </Card>
          ) : null}
          {pageCount > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {pageCount}
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={`/communities/${slug}?page=${Math.max(1, page - 1)}`}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={`/communities/${slug}?page=${Math.min(pageCount, page + 1)}`}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
          {selectedPost ? (
            <Card id="comments">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
                Post conversation
              </p>
              <h2 className="mt-1 text-lg font-black text-kondo-ink dark:text-white">
                {comments.length}{" "}
                {comments.length === 1 ? "comment" : "comments"}
              </h2>
              <CommentThread
                canComment={joined}
                canModerate={canModerate}
                comments={comments}
                currentUserId={user.id}
                postId={selectedPost.id}
              />
            </Card>
          ) : null}
        </div>
        <aside className="space-y-5">
          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Community care
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Be generous, protect privacy, and keep advice grounded in lived
              experience.
            </p>
            <Link
              className="mt-3 inline-flex text-xs font-black text-kondo-green hover:underline"
              href="/guidelines"
            >
              Read the guidelines
            </Link>
          </Card>
          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              New members
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {community.members.map((member) => (
                <Avatar
                  className="h-11 w-11"
                  firstName={member.user.firstName}
                  key={member.id}
                  lastName={member.user.lastName}
                />
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
