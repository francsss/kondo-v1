import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { AnswerComposer } from "@/components/features/help/AnswerComposer";
import { HelpfulButton } from "@/components/features/help/HelpfulButton";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { publishedQuestionWhere } from "@/lib/content-visibility";
import { formatRelativeDate } from "@/lib/presentation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentUser = await requireUser();
  const question = await prisma.question.findFirst({
    where: { slug, ...publishedQuestionWhere },
    include: {
      author: { include: { country: true, university: true } },
      answers: {
        where: { status: "PUBLISHED" },
        include: {
          author: { include: { country: true, university: true } },
          _count: { select: { votes: true } },
          votes: { where: { userId: currentUser.id }, select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!question) notFound();

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <Button asChild size="sm" variant="ghost">
        <Link href="/help">
          <ChevronLeft className="h-4 w-4" /> Help center
        </Link>
      </Button>
      <Card className="mt-5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Avatar
            firstName={question.author.firstName}
            lastName={question.author.lastName}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-kondo-ink dark:text-white">
              {question.author.firstName} {question.author.lastName}{" "}
              {question.author.country?.emoji}
            </p>
            <p className="text-xs text-slate-400">
              {question.author.university?.shortName ?? "Kondo member"} ·{" "}
              {formatRelativeDate(question.createdAt)}
            </p>
          </div>
          <MessageUserButton
            compact
            currentUserId={currentUser.id}
            userId={question.author.id}
          />
        </div>
        <span className="mt-6 inline-flex rounded-full bg-kondo-mint px-3 py-1.5 text-xs font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
          {question.category}
        </span>
        <h1 className="mt-4 text-balance text-3xl font-black tracking-[-0.04em] text-kondo-ink dark:text-white">
          {question.title}
        </h1>
        <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-slate-600 dark:text-slate-300">
          {question.body}
        </p>
      </Card>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xl font-black text-kondo-ink dark:text-white">
          {question.answers.length} community answers
        </h2>
        <AnswerComposer questionId={question.id} />
      </div>
      <div className="mt-4 space-y-4">
        {question.answers.map((answer) => {
          const best = answer.id === question.bestAnswerId;
          return (
            <Card
              className={
                best
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-400/20 dark:bg-emerald-400/5"
                  : undefined
              }
              key={answer.id}
            >
              {best ? (
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-kondo-green px-3 py-1 text-xs font-black text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Best answer
                </div>
              ) : null}
              <div className="flex gap-3">
                <Avatar
                  firstName={answer.author.firstName}
                  lastName={answer.author.lastName}
                />
                <div>
                  <p className="text-sm font-bold text-kondo-ink dark:text-white">
                    {answer.author.firstName} {answer.author.lastName}{" "}
                    {answer.author.country?.emoji}
                  </p>
                  <p className="text-xs text-slate-400">
                    {answer.author.university?.shortName ?? "Student"} ·{" "}
                    {formatRelativeDate(answer.createdAt)}
                  </p>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">
                {answer.body}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <HelpfulButton
                  answerId={answer.id}
                  initialCount={answer._count.votes}
                  initialHelpful={answer.votes.length > 0}
                />
                <MessageUserButton
                  compact
                  currentUserId={currentUser.id}
                  userId={answer.author.id}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
