import type { StoryStatus } from "@prisma/client";
import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { StoryAdminManager } from "@/components/features/admin/StoryAdminManager";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";
import { listAdminStories } from "@/lib/stories";
import { storyStatuses } from "@/lib/story-validation";

export const metadata: Metadata = { title: "Admin Student Stories" };

export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("STORY_CMS_VIEW");
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const status = storyStatuses.includes(
    rawStatus as (typeof storyStatuses)[number],
  )
    ? (rawStatus as StoryStatus)
    : undefined;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const [result, categories, creators, pendingCount, publishedCount] =
    await Promise.all([
      listAdminStories(user, { status, query, page: Number(params.page ?? 1) }),
      prisma.storyCategory.findMany({
        include: { _count: { select: { stories: true } } },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { stories: { some: {} } },
            { storyCreatorStatus: { not: "STANDARD" } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          storyCreatorStatus: true,
          officialProfileStatus: true,
          _count: { select: { stories: true } },
        },
        orderBy: [{ storyCreatorStatus: "asc" }, { firstName: "asc" }],
        take: 200,
      }),
      prisma.story.count({
        where: { status: { in: ["PENDING_REVIEW", "RESUBMITTED"] } },
      }),
      prisma.story.count({ where: { status: "PUBLISHED" } }),
    ]);
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review useful videos, protect students, manage editorial categories and control publishing trust."
        eyebrow="Kondo operations"
        title="Student Stories"
      />
      <AdminNav currentPath="/admin/stories" role={user.role} />
      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-3xl font-black">{pendingCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Awaiting review</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{publishedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Published</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{categories.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">CMS categories</p>
        </Card>
      </section>
      <StoryAdminManager
        categories={categories}
        creators={creators}
        stories={result.records}
      />
    </main>
  );
}
