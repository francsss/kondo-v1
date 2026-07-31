import Link from "next/link";
import type { PublicOpportunityCard } from "@/lib/opportunities";

const WINDOW_TONE: Record<string, string> = {
  OPEN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300",
  CLOSING_SOON:
    "bg-amber-100 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200",
  ROLLING: "bg-sky-100 text-sky-800 dark:bg-sky-400/10 dark:text-sky-300",
  EXTERNAL_ONLY:
    "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300",
  NOT_OPEN:
    "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300",
  CLOSED:
    "bg-slate-100 text-slate-600 dark:bg-slate-400/10 dark:text-slate-400",
  INFORMATION_ONLY:
    "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300",
};

const WINDOW_LABEL: Record<string, string> = {
  OPEN: "Open",
  CLOSING_SOON: "Closing soon",
  ROLLING: "Rolling",
  EXTERNAL_ONLY: "Apply externally",
  NOT_OPEN: "Not open yet",
  CLOSED: "Closed",
  INFORMATION_ONLY: "Information only",
};

function formatDeadline(deadline: string | null, timezone: string) {
  if (!deadline) return null;
  // A fixed date plus its timezone, never a live countdown that a sleeping
  // device or a timezone change could render incorrect.
  const formatted = new Date(deadline).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });
  return `${formatted} (${timezone})`;
}

export function OpportunityCard({ item }: { item: PublicOpportunityCard }) {
  const deadline = formatDeadline(
    item.applicationWindow.deadline,
    item.applicationWindow.timezone,
  );
  const state = item.applicationWindow.state;

  return (
    <article className="flex h-full flex-col rounded-3xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-kondo-green/10 px-2.5 py-1 text-xs font-bold text-kondo-green">
          {item.typeLabel}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${WINDOW_TONE[state] ?? WINDOW_TONE.CLOSED}`}
        >
          {WINDOW_LABEL[state] ?? "Closed"}
        </span>
      </div>

      <h3 className="mt-3 text-base font-black leading-snug tracking-[-0.02em]">
        <Link href={item.href} className="hover:underline">
          {item.title}
        </Link>
      </h3>

      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {item.summary}
      </p>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="sr-only">Publisher</dt>
          <dd className="font-semibold">
            {item.publisher.name}
            {item.publisher.verified ? (
              <span className="ml-1.5 text-xs font-bold text-kondo-green">
                Verified
              </span>
            ) : null}
          </dd>
        </div>
        {item.location ? (
          <div className="flex gap-2 text-muted-foreground">
            <dt className="sr-only">Location</dt>
            <dd>{item.location}</dd>
          </div>
        ) : null}
        <div className="flex gap-2 text-muted-foreground">
          <dt className="sr-only">Compensation</dt>
          {/* Never a fabricated range: absent data is stated as absent. */}
          <dd>{item.compensationSummary ?? "Compensation not specified"}</dd>
        </div>
      </dl>

      {deadline ? (
        <p className="mt-4 border-t border-black/5 pt-3 text-xs font-semibold text-muted-foreground dark:border-white/10">
          Deadline: {deadline}
        </p>
      ) : item.applicationWindow.rolling ? (
        <p className="mt-4 border-t border-black/5 pt-3 text-xs font-semibold text-muted-foreground dark:border-white/10">
          Rolling applications
        </p>
      ) : null}
    </article>
  );
}
