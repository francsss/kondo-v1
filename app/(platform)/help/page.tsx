import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  MessageCircleQuestion,
  Search,
  ThumbsUp,
} from "lucide-react";
import { QuestionComposer } from "@/components/features/help/QuestionComposer";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatRelativeDate } from "@/lib/presentation";
import { getHelpQuestions } from "@/lib/platform-queries";

export const metadata: Metadata = { title: "Help center" };

const categories = [
  ["VISA", "🛂"],
  ["HOUSING", "🏠"],
  ["BANK", "🏦"],
  ["UNIVERSITY", "🎓"],
  ["SCHOLARSHIP", "🏅"],
  ["TRAVEL", "✈️"],
  ["HEALTH", "🩺"],
];

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q = "" } = await searchParams;
  const questions = await getHelpQuestions();
  const visibleQuestions = questions.filter(
    (question) =>
      (!category || question.category === category) &&
      (!q ||
        question.title.toLowerCase().includes(q.toLowerCase()) ||
        question.body.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        action={<QuestionComposer />}
        description="Get practical answers from students who have already solved the problem you’re facing."
        eyebrow="No question is too small"
        title="Help center"
      />

      <section className="mt-8 rounded-4xl bg-kondo-navy p-6 text-white shadow-lift sm:p-8">
        <div className="mx-auto max-w-2xl text-center">
          <MessageCircleQuestion className="mx-auto h-8 w-8 text-kondo-lime" />
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            What do you need to figure out?
          </h2>
          <form className="mt-5 flex h-13 items-center gap-3 rounded-2xl bg-white px-4 text-left">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              aria-label="Search questions"
              className="w-full bg-transparent text-sm text-kondo-ink outline-none placeholder:text-muted-foreground"
              defaultValue={q}
              name="q"
              placeholder="Try “residence permit renewal”"
            />
            {category ? (
              <input name="category" type="hidden" value={category} />
            ) : null}
          </form>
        </div>
      </section>

      <div className="scrollbar-none mt-6 flex gap-3 overflow-x-auto pb-2">
        {categories.map(([label, emoji]) => (
          <Link
            className={
              category === label
                ? "flex min-w-fit items-center gap-2 rounded-full bg-kondo-ink px-4 py-2.5 text-sm font-bold text-white dark:bg-emerald-400 dark:text-kondo-ink"
                : "flex min-w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-muted-foreground transition hover:border-kondo-green hover:text-kondo-forest dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground"
            }
            href={`/help?category=${label}`}
            key={label}
          >
            <span>{emoji}</span>
            {label[0]}
            {label.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <section className="mt-8 grid gap-4">
        {visibleQuestions.map((question) => {
          const bestAnswer =
            question.answers.find(
              (answer) => answer.id === question.bestAnswerId,
            ) ?? question.answers[0];
          return (
            <Card
              className="transition hover:-translate-y-0.5 hover:shadow-soft"
              key={question.id}
            >
              <div className="flex items-start gap-4">
                <Avatar
                  firstName={question.author.firstName}
                  lastName={question.author.lastName}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-kondo-mint px-2.5 py-1 font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                      {question.category}
                    </span>
                    <span>
                      {question.author.firstName} {question.author.lastName}
                    </span>
                    <span>{question.author.country?.emoji}</span>
                    <span>· {formatRelativeDate(question.createdAt)}</span>
                  </div>
                  <Link href={`/help/${question.slug}`}>
                    <h2 className="mt-3 text-lg font-black tracking-tight text-kondo-ink hover:text-kondo-forest dark:text-white dark:hover:text-emerald-300">
                      {question.title}
                    </h2>
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {question.body}
                  </p>
                  {bestAnswer ? (
                    <div className="mt-4 rounded-2xl bg-emerald-50/80 p-4 dark:bg-emerald-400/5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-kondo-green">
                        <CheckCircle2 className="h-4 w-4" /> Community answer
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {bestAnswer.body}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                    <span>{question._count.answers} answers</span>
                    {bestAnswer ? (
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-3.5 w-3.5" />{" "}
                        {bestAnswer._count.votes} helpful
                      </span>
                    ) : null}
                  </div>
                </div>
                <ArrowUpRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
