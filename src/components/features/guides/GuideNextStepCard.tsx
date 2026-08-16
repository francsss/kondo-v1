import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import type { GuideNextStep } from "@/lib/guide-journey";

/**
 * The one thing worth doing next, from the Guide.
 *
 * Home already knew the student's Journey stage and the Guide already recorded
 * which steps they had ticked; nothing joined the two, so a student who had
 * finished six of eight arrival steps still had to remember that and go
 * looking. This closes that gap with the data that already existed.
 *
 * One action, not a list. A student opening Home wants to know what to do next,
 * and three equally weighted suggestions answer a different, worse question.
 * The progress line is there so the step feels like part of something with an
 * end, rather than an isolated nag.
 */
export function GuideNextStepCard({ step }: { step: GuideNextStep }) {
  return (
    <Link
      className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-4 transition hover:border-kondo-green/40 active:scale-[0.99] motion-reduce:transform-none sm:p-5"
      href={step.href}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
        <ListChecks aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Your next step
        </span>
        <span className="mt-0.5 block truncate text-sm font-black text-foreground">
          {step.stepTitle ?? step.guideTitle}
        </span>
        <span className="mt-0.5 block truncate text-xs font-bold text-muted-foreground">
          {step.guideTitle} · {step.completed} of {step.total} done
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-kondo-green"
      />
    </Link>
  );
}
