import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommunityManagePanel } from "@/components/features/community/CommunityManagePanel";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Manage community" };

export default async function ManageCommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const community = await prisma.community.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      joinPolicy: true,
      isPrivate: true,
      isOfficial: true,
      coverMediaId: true,
      ownerId: true,
      members: {
        where: { userId: user.id },
        select: { role: true },
      },
    },
  });
  if (!community) redirect("/communities");
  const membershipRole = community.members[0]?.role;
  const globalManager = hasAdminPermission(user.role, "COMMUNITY_CMS_MANAGE");
  if (
    !globalManager &&
    membershipRole !== "OWNER" &&
    membershipRole !== "MODERATOR"
  ) {
    redirect(`/communities/${community.slug}`);
  }

  const detail = await prisma.community.findUniqueOrThrow({
    where: { id: community.id },
    select: {
      members: {
        select: {
          id: true,
          role: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        take: 100,
      },
      accessRequests: {
        where: { status: "PENDING" },
        select: {
          id: true,
          type: true,
          note: true,
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
      posts: {
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          content: true,
          eventAt: true,
          eventValidatedAt: true,
          pinnedAt: true,
          author: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
      },
    },
  });

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild className="mb-5" size="sm" variant="ghost">
        <Link href={`/communities/${community.slug}`}>
          <ArrowLeft className="h-4 w-4" /> Back to community
        </Link>
      </Button>
      <PageHeader
        description="Manage membership, access, content and community settings with every action recorded in the audit trail."
        eyebrow="Community operations"
        title={community.name}
      />
      <CommunityManagePanel
        canArchive={globalManager || membershipRole === "OWNER"}
        canChangeRoles={globalManager || membershipRole === "OWNER"}
        canEditSettings={
          membershipRole === "OWNER" || (globalManager && community.isOfficial)
        }
        community={{
          id: community.id,
          name: community.name,
          description: community.description,
          joinPolicy: community.joinPolicy,
          isPrivate: community.isPrivate,
          coverMediaId: community.coverMediaId,
        }}
        members={detail.members.map((member) => ({
          id: member.id,
          role: member.role,
          user: {
            id: member.user.id,
            fullName: `${member.user.firstName} ${member.user.lastName}`,
            email: member.user.email,
          },
        }))}
        posts={detail.posts.map((post) => ({
          id: post.id,
          type: post.type,
          status: post.status,
          title: post.title,
          content: post.content,
          eventAt: post.eventAt?.toISOString() ?? null,
          eventValidatedAt: post.eventValidatedAt?.toISOString() ?? null,
          pinnedAt: post.pinnedAt?.toISOString() ?? null,
          authorName: `${post.author.firstName} ${post.author.lastName}`,
        }))}
        requests={detail.accessRequests.map((request) => ({
          id: request.id,
          type: request.type,
          note: request.note,
          user: {
            fullName: `${request.user.firstName} ${request.user.lastName}`,
            email: request.user.email,
          },
        }))}
      />
    </div>
  );
}
