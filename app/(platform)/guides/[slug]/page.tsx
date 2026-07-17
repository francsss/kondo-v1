import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock3 } from "lucide-react";
import { BookmarkButton } from "@/components/features/bookmarks/BookmarkButton";
import { GuideChecklist } from "@/components/features/guides/GuideChecklist";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { publishedGuideWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const guide = await prisma.guide.findFirst({
    where: { slug, ...publishedGuideWhere },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: {
          progress: { where: { userId: user.id }, select: { id: true } },
        },
      },
    },
  });
  if (!guide) notFound();
  const bookmark = await prisma.bookmark.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: user.id,
        targetType: "GUIDE",
        targetId: guide.id,
      },
    },
    select: { id: true },
  });
  const completed = guide.steps.filter((step) => step.progress.length).length;
  const progress = guide.steps.length
    ? Math.round((completed / guide.steps.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <div className="flex items-center justify-between">
        <Button asChild size="sm" variant="ghost">
          <Link href="/guides">
            <ChevronLeft className="h-4 w-4" /> All guides
          </Link>
        </Button>
        <BookmarkButton
          initialBookmarked={Boolean(bookmark)}
          targetId={guide.id}
          targetType="GUIDE"
        />
      </div>
      <header className="noise mt-5 overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#238164] p-7 text-white shadow-lift sm:p-10">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-kondo-lime">
          {guide.category.replaceAll("_", " ")}
        </span>
        <h1 className="mt-5 max-w-3xl text-balance text-3xl font-black tracking-[-0.045em] sm:text-5xl">
          {guide.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
          {guide.summary}
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-white/60">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-4 w-4" /> {guide.estimatedMinutes} minutes
          </span>
        </div>
        <div className="mt-8 max-w-xl">
          <div className="flex justify-between text-xs font-bold">
            <span>Your progress</span>
            <span>
              {completed}/{guide.steps.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-kondo-lime"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <GuideChecklist
          steps={guide.steps.map((step) => ({
            id: step.id,
            order: step.order,
            title: step.title,
            content: step.content,
            completed: step.progress.length > 0,
          }))}
        />
        <aside>
          <Card className="sticky top-24">
            <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
              A quick note
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Local processes can change. Kondo dates every guide and encourages
              you to verify official requirements with your university.
            </p>
            <p className="mt-4 text-xs font-semibold text-slate-400">
              Updated{" "}
              {guide.updatedAt.toLocaleDateString("en", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
