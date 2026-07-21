import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";

const categoryEmoji: Record<string, string> = {
  BEFORE_DEPARTURE: "🧳",
  ARRIVAL: "🛬",
  RESIDENCY: "🪪",
  DAILY_LIFE: "🏙️",
  MONEY: "💳",
  TRANSPORT: "🚇",
  HEALTH: "🩺",
  UNIVERSITY: "🎓",
};

export function GuideCard({
  guide,
}: {
  guide: {
    slug: string;
    title: string;
    summary: string;
    category: string;
    estimatedMinutes: number;
    coverMediaId?: string | null;
    steps: Array<{ progress: Array<{ id: string }> }>;
  };
}) {
  const completed = guide.steps.filter(
    (step) => step.progress.length > 0,
  ).length;
  const progress = guide.steps.length
    ? Math.round((completed / guide.steps.length) * 100)
    : 0;

  return (
    <Card className="group flex h-full flex-col transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      {guide.coverMediaId ? (
        <MediaImage
          alt={`${guide.title} guide cover`}
          className="mb-5 h-32 w-full rounded-2xl object-cover"
          height={256}
          mediaId={guide.coverMediaId}
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 90vw"
          width={640}
        />
      ) : null}
      <div className="flex items-start justify-between">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-kondo-mint text-2xl dark:bg-emerald-400/10">
          {categoryEmoji[guide.category] ?? "📘"}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="h-5 w-5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-kondo-green"
        />
      </div>
      <Link className="mt-5" href={`/guides/${guide.slug}`}>
        <h2 className="text-lg font-black tracking-[-0.025em] text-kondo-ink group-hover:text-kondo-forest dark:text-white dark:group-hover:text-emerald-300">
          {guide.title}
        </h2>
      </Link>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {guide.summary}
      </p>
      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />{" "}
            {guide.estimatedMinutes} min
          </span>
          <span className="inline-flex items-center gap-1 text-kondo-green">
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />{" "}
            {completed}/{guide.steps.length}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-kondo-green transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
