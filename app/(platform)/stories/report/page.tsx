import { notFound } from "next/navigation";
import { StoryReportForm } from "@/components/features/stories/StoryReportForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export default async function StoryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const storyId = Array.isArray(params.story) ? params.story[0] : params.story;
  if (!storyId) notFound();
  const story = await prisma.story.findFirst({
    where: { id: storyId, status: "PUBLISHED" },
    select: { id: true, title: true },
  });
  if (!story) notFound();
  return (
    <main className="mx-auto max-w-[1000px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Reports are confidential and reviewed by Kondo's moderation team."
        eyebrow="Student Stories safety"
        title="Report a concern"
      />
      <StoryReportForm storyId={story.id} storyTitle={story.title} />
    </main>
  );
}
