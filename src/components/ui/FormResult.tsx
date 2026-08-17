import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";

/**
 * What happened, and what to do next.
 *
 * Finishing a form used to drop the student back on a list with no
 * confirmation — the work vanished and you inferred success from the absence of
 * an error. This says the outcome and offers the two things anyone wants
 * afterwards: look at it, or go back and carry on.
 *
 * The wording follows the actual state, never the hoped-for one. Submitting a
 * catalog item creates a `PENDING_REVIEW` record, so it says "submitted for
 * review"; only something genuinely public is called published. Claiming
 * otherwise would teach the owner their listing is live when nobody can see it,
 * which is the same class of mistake that made organizations invisible.
 */

export type FormResultState = {
  /** `review` and `draft` are deliberately not called published. */
  kind: "published" | "review" | "draft";
  /** What was created, in the owner's words: "Product", "Service"… */
  noun: string;
  title?: string;
  /** Where the finished thing can be seen, when it can be. */
  viewHref?: string;
  viewLabel?: string;
  backHref: string;
  backLabel: string;
};

const HEADLINE: Record<FormResultState["kind"], (noun: string) => string> = {
  published: (noun) => `${noun} published`,
  review: (noun) => `${noun} submitted for review`,
  draft: (noun) => `${noun} draft saved`,
};

const DETAIL: Record<FormResultState["kind"], string> = {
  published: "It is live and can be found by anyone on Kondo.",
  review:
    "Kondo checks it before it appears publicly. You can keep editing it in the meantime.",
  draft: "Only your organization can see it. Nothing is public yet.",
};

export function FormResult({ state }: { state: FormResultState }) {
  const published = state.kind === "published";
  const Icon = published ? CheckCircle2 : Clock3;

  return (
    <section
      aria-live="polite"
      className="mx-auto max-w-[520px] rounded-3xl border border-border bg-card p-6 text-center sm:p-8"
    >
      <span
        className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${
          published
            ? "bg-kondo-mint text-kondo-green dark:bg-emerald-400/10"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-xl font-black tracking-[-0.03em]">
        {HEADLINE[state.kind](state.noun)}
      </h2>
      {state.title ? (
        <p className="mt-1 truncate text-sm font-bold text-foreground">
          {state.title}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {DETAIL[state.kind]}
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {state.viewHref ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-kondo-green px-5 text-sm font-black text-white"
            href={state.viewHref}
          >
            {state.viewLabel ?? `View ${state.noun.toLowerCase()}`}
          </Link>
        ) : null}
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-black text-foreground transition hover:border-kondo-green/40"
          href={state.backHref}
        >
          {state.backLabel}
        </Link>
      </div>
    </section>
  );
}
