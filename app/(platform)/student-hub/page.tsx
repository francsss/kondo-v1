import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  CheckSquare,
  CircleHelp,
  GraduationCap,
  Lightbulb,
  PlaneLanding,
} from "lucide-react";
import { GuideCard } from "@/components/features/guides/GuideCard";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { publishedPostVisibilityWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { formatDate, formatRelativeDate } from "@/lib/presentation";
import { getGuideLibrary, getHelpQuestions } from "@/lib/platform-queries";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Student Hub" };

const resources = [
  {
    title: "Arrival Guide",
    description: "The essentials for your first days, in the right order.",
    href: "/guides?category=ARRIVAL",
    icon: PlaneLanding,
    accent:
      "bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300",
  },
  {
    title: "Student Resources",
    description:
      "Practical guides for university, health, money and daily life.",
    href: "/guides",
    icon: GraduationCap,
    accent:
      "bg-emerald-100 text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  {
    title: "Questions & Answers",
    description: "Ask the community and learn from students who solved it.",
    href: "/help",
    icon: CircleHelp,
    accent: "bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
  },
  {
    title: "Checklists",
    description: "Track every important step without missing a deadline.",
    href: "/guides",
    icon: CheckSquare,
    accent:
      "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
  },
  {
    title: "Student Tips",
    description: "Short, local advice that makes everyday student life easier.",
    href: "/guides?category=DAILY_LIFE",
    icon: Lightbulb,
    accent:
      "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  },
  {
    title: "Helpful Articles",
    description: "Student-tested explanations you can save and revisit.",
    href: "/guides?saved=1",
    icon: BookOpenText,
    accent: "bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
  },
];

export default async function StudentHubPage() {
  const user = await requireUser();
  const [guides, questions, events] = await Promise.all([
    getGuideLibrary(user.id),
    getHelpQuestions(),
    prisma.post.findMany({
      where: {
        ...publishedPostVisibilityWhere(user),
        type: "EVENT",
        eventAt: { gte: new Date() },
      },
      select: {
        id: true,
        title: true,
        content: true,
        eventAt: true,
        eventLocation: true,
        community: { select: { name: true, slug: true } },
      },
      orderBy: { eventAt: "asc" },
      take: 3,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Guides, answers, checklists, tips and events—everything students need, now in one place."
        eyebrow="Your student life, organized"
        title="Student Hub"
      />

      <section className="noise relative mt-8 overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-emerald-700 p-7 text-white shadow-lift sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-black text-kondo-lime">
            One hub. Every next step.
          </span>
          <h2 className="mt-5 text-balance text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            Spend less time searching and more time belonging.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/75">
            Continue the same student guides and community help you already use,
            brought together without removing any feature.
          </p>
        </div>
        <GraduationCap
          aria-hidden="true"
          className="absolute -bottom-8 right-8 hidden h-48 w-48 rotate-[-8deg] text-white/10 lg:block"
        />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resources.map(({ accent, description, href, icon: Icon, title }) => (
          <Link className="group" href={href} key={title}>
            <Card className="h-full transition group-hover:-translate-y-1 group-hover:border-emerald-200 group-hover:shadow-soft dark:group-hover:border-emerald-400/20">
              <div
                className={`grid h-11 w-11 place-items-center rounded-2xl ${accent}`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-black tracking-tight text-kondo-ink dark:text-white">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-black text-kondo-green">
                Open{" "}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <div className="mt-12 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
            Helpful articles
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-kondo-ink dark:text-white">
            Continue with a practical guide
          </h2>
        </div>
        <Link className="text-sm font-black text-kondo-green" href="/guides">
          All guides →
        </Link>
      </div>
      <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {guides.slice(0, 3).map((guide) => (
          <GuideCard guide={guide} key={guide.id} />
        ))}
      </section>

      <section className="mt-12 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
                Questions & Answers
              </p>
              <h2 className="mt-2 text-xl font-black text-kondo-ink dark:text-white">
                Recently answered by students
              </h2>
            </div>
            <Link className="text-sm font-black text-kondo-green" href="/help">
              Ask or browse →
            </Link>
          </div>
          <div className="mt-5 divide-y divide-slate-100 dark:divide-white/10">
            {questions.slice(0, 4).map((question) => (
              <Link
                className="block py-4 first:pt-0 last:pb-0"
                href={`/help/${question.slug}`}
                key={question.id}
              >
                <p className="font-bold text-kondo-ink hover:text-kondo-green dark:text-white">
                  {question.title}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {question._count.answers} answers · asked{" "}
                  {formatRelativeDate(question.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                Student events
              </p>
              <h2 className="text-xl font-black text-kondo-ink dark:text-white">
                Coming up
              </h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {events.length ? (
              events.map((event) => (
                <Link
                  className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-kondo-mint dark:bg-white/5 dark:hover:bg-emerald-400/10"
                  href={`/communities/${event.community.slug}?post=${event.id}`}
                  key={event.id}
                >
                  <p className="font-bold text-kondo-ink dark:text-white">
                    {event.title ?? event.content.slice(0, 70)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {event.eventAt
                      ? formatDate(event.eventAt)
                      : "Date to be confirmed"}
                    {event.eventLocation ? ` · ${event.eventLocation}` : ""}
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                New university and community events will appear here as soon as
                they are published.
              </p>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
