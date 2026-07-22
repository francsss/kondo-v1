import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  MessageCircleQuestion,
  Search,
  ThumbsUp,
} from "lucide-react";
import { QuestionComposer } from "@/components/features/help/QuestionComposer";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { formatRelativeDate } from "@/lib/presentation";
import { getHelpQuestions } from "@/lib/platform-queries";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Student Help" };

const categories = [
  ["VISA", "🛂"],
  ["HOUSING", "🏠"],
  ["BANK", "🏦"],
  ["UNIVERSITY", "🎓"],
  ["SCHOLARSHIP", "🏅"],
  ["TRAVEL", "✈️"],
  ["HEALTH", "🩺"],
] as const;

export default async function StudentHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; filter?: string }>;
}) {
  const user = await requireUser();
  const { category, q = "", filter = "recent" } = await searchParams;
  const questions = await getHelpQuestions();
  const visible = questions
    .filter(
      (question) =>
        (!category || question.category === category) &&
        (!q ||
          `${question.title} ${question.body}`
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (filter !== "unanswered" || question._count.answers === 0) &&
        (filter !== "mine" || question.author.id === user.id),
    )
    .sort((a, b) =>
      filter === "popular"
        ? (b.answers[0]?._count.votes ?? 0) - (a.answers[0]?._count.votes ?? 0)
        : b.createdAt.getTime() - a.createdAt.getTime(),
    );
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
            Help
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            Answers from students who have been there.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ask clearly, share context and learn from the Kondo student
            community.
          </p>
        </div>
        <QuestionComposer basePath="/student-hub/help" />
      </div>
      <section className="mt-7 rounded-4xl bg-kondo-navy p-6 text-white shadow-lift sm:p-8">
        <MessageCircleQuestion className="h-7 w-7 text-kondo-lime" />
        <h2 className="mt-3 text-2xl font-black">
          What do you need to figure out?
        </h2>
        <form className="mt-5 flex h-12 max-w-2xl items-center gap-3 rounded-2xl bg-white px-4 text-kondo-ink">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            aria-label="Search questions"
            className="w-full bg-transparent text-sm outline-none"
            defaultValue={q}
            name="q"
            placeholder="Try “residence permit renewal”"
          />
          {category ? (
            <input name="category" type="hidden" value={category} />
          ) : null}
        </form>
      </section>
      <div className="scrollbar-none mt-6 flex gap-2 overflow-x-auto pb-1">
        {categories.map(([value, emoji]) => (
          <Link
            className={
              category === value
                ? "whitespace-nowrap rounded-full bg-kondo-ink px-4 py-2 text-sm font-black text-white dark:bg-emerald-400 dark:text-kondo-ink"
                : "whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground"
            }
            href={`/student-hub/help?category=${value}`}
            key={value}
          >
            {emoji} {value[0]}
            {value.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>
      <div className="mt-5 flex gap-4 border-b border-border text-sm">
        {[
          ["recent", "Recent"],
          ["popular", "Popular"],
          ["unanswered", "Unanswered"],
          ["mine", "My questions"],
        ].map(([value, label]) => (
          <Link
            className={
              filter === value
                ? "border-b-2 border-kondo-green px-1 pb-3 font-black text-kondo-green"
                : "px-1 pb-3 font-bold text-muted-foreground"
            }
            href={`/student-hub/help?filter=${value}`}
            key={value}
          >
            {label}
          </Link>
        ))}
      </div>
      <section className="mt-6 space-y-4">
        {visible.map((question) => {
          const answer =
            question.answers.find(
              (item) => item.id === question.bestAnswerId,
            ) ?? question.answers[0];
          return (
            <Card key={question.id}>
              <div className="flex items-start gap-4">
                <Avatar
                  firstName={question.author.firstName}
                  lastName={question.author.lastName}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-kondo-mint px-2.5 py-1 font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                      {question.category}
                    </span>
                    <span>
                      {question.author.firstName} {question.author.lastName}{" "}
                      {question.author.country?.emoji}
                    </span>
                    <span>· {formatRelativeDate(question.createdAt)}</span>
                  </div>
                  <Link href={`/student-hub/help/${question.slug}`}>
                    <h2 className="mt-3 text-lg font-black hover:text-kondo-green">
                      {question.title}
                    </h2>
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {question.body}
                  </p>
                  {answer ? (
                    <div className="mt-4 rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-400/5">
                      <p className="flex items-center gap-1.5 text-xs font-black text-kondo-green">
                        <CheckCircle2 className="h-4 w-4" />
                        Community answer
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {answer.body}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-4 flex gap-4 text-xs font-bold text-muted-foreground">
                    <span>{question._count.answers} answers</span>
                    {answer ? (
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {answer._count.votes}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </section>
      {!visible.length ? (
        <Card className="mt-6 py-14 text-center text-sm text-muted-foreground">
          No question matches this view.
        </Card>
      ) : null}
    </div>
  );
}
