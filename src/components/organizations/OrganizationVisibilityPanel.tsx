import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ExternalLink, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Whether this organization can be found, and the one thing to do next.
 *
 * An organization that finishes onboarding is `ACTIVE` but still `PRIVATE`:
 * publishing is a separate, deliberate step. Nothing said so. Owners were
 * building a profile, adding products, and having no way to know the whole
 * thing was invisible — the only way to find out was to make a second account
 * and search for yourself.
 *
 * This is now the single setup surface. The dashboard used to stack four:
 * this panel, a "Continue setup" banner, a profile-completion percentage and a
 * verification status tile, each nagging about a different slice of the same
 * question. Four gauges pointing at one problem is not more information, it is
 * less — none of them said what to actually do.
 *
 * So it answers three things in order: are we public, how far along are we, and
 * what is the next single step. The step is named — "Add a public contact
 * method", not "your profile is incomplete" — and its button goes to the page
 * that fixes it, so nobody has to go looking through Settings and Verification
 * to find out what Kondo wants.
 *
 * Verification is deliberately absent. An organization is publicly visible
 * without being verified; verification governs the trust badge, not
 * discoverability, and the domain agrees — it is a warning there, never a
 * publication requirement. Showing it here would teach the owner that they
 * must be verified to exist publicly, which is not true.
 */

export type OrganizationVisibilityState = {
  slug: string;
  publicProfileStatus: string;
  /** Requirements still unmet, already phrased for a person. */
  missing: ReadonlyArray<{ key: string; message: string }>;
  /** Moderation or lifecycle problems, which outrank missing fields. */
  blocking: ReadonlyArray<{ key: string; message: string }>;
  canPublish: boolean;
  /** How many publication requirements are already satisfied. */
  progress?: { completed: number; total: number };
};

/**
 * Where each requirement is actually fixed.
 *
 * Sending everyone to the profile page and letting them hunt is the behaviour
 * this replaces. Keys match `evaluateOrganizationPublicationReadiness`.
 */
const REQUIREMENT_DESTINATION: Record<
  string,
  { path: string; action: string }
> = {
  publicName: { path: "profile", action: "Add a name" },
  slug: { path: "profile", action: "Choose an address" },
  type: { path: "profile", action: "Choose a type" },
  country: { path: "profile", action: "Add a country" },
  description: { path: "profile", action: "Add a description" },
  contact: { path: "profile", action: "Add a contact method" },
  representation: { path: "profile", action: "Confirm authorization" },
  owner: { path: "team", action: "Assign an owner" },
};

export function OrganizationVisibilityPanel({
  state,
}: {
  state: OrganizationVisibilityState;
}) {
  const published = state.publicProfileStatus === "PUBLISHED";
  const blocked = state.blocking.length > 0;
  const ready = !published && !blocked && state.missing.length === 0;
  const remaining = state.missing.length;
  // One step, not a checklist. The rest are counted, not listed.
  const next = state.missing[0];
  const destination = next ? REQUIREMENT_DESTINATION[next.key] : undefined;

  const tone = published
    ? "border-kondo-green/40 bg-kondo-mint dark:bg-emerald-400/10"
    : blocked
      ? "border-destructive/40 bg-destructive/5"
      : "border-border bg-card";

  return (
    <section
      aria-labelledby="org-visibility-heading"
      className={cn("rounded-2xl border p-4 sm:p-5", tone)}
    >
      <div className="flex items-start gap-3">
        {published ? (
          <Eye
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-kondo-green"
          />
        ) : (
          <EyeOff
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2
            className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground"
            id="org-visibility-heading"
          >
            Public status
          </h2>
          <p className="mt-1 text-base font-black text-foreground">
            {published
              ? "Live"
              : blocked
                ? "Publication blocked"
                : ready
                  ? "Ready to publish"
                  : "Not published"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {published
              ? "Anyone on Kondo can find this organization in search and open its public page."
              : blocked
                ? (state.blocking[0]?.message ??
                  "This profile cannot be published right now.")
                : ready
                  ? "Everything needed is in place. Publishing makes it findable in search."
                  : `${remaining} ${remaining === 1 ? "step" : "steps"} left before this organization can be published.`}
          </p>

          {/*
           * Progress, only while it is still being worked on. A published
           * organization does not need a completion bar; it is done.
           */}
          {!published && !blocked && state.progress ? (
            <div className="mt-3">
              <div
                aria-label={`${state.progress.completed} of ${state.progress.total} publication requirements complete`}
                aria-valuemax={state.progress.total}
                aria-valuemin={0}
                aria-valuenow={state.progress.completed}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-kondo-green transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${Math.round((state.progress.completed / state.progress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs font-bold text-muted-foreground">
                {state.progress.completed} of {state.progress.total} complete
              </p>
            </div>
          ) : null}

          {/* The single next thing, named. */}
          {next && !published && !blocked ? (
            <p className="mt-3 text-sm font-bold text-foreground">
              Next: {next.message}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {published ? (
              <Link
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-black text-foreground transition hover:border-kondo-green/40"
                href={`/organizations/${state.slug}`}
              >
                View public page
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            ) : ready && state.canPublish ? (
              <Link
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-kondo-green px-4 text-sm font-black text-white transition"
                href={`/organizations/${state.slug}/profile`}
              >
                <Rocket aria-hidden="true" className="h-4 w-4" />
                Publish organization
              </Link>
            ) : next ? (
              <Link
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-kondo-green px-4 text-sm font-black text-white transition"
                href={`/organizations/${state.slug}/${destination?.path ?? "profile"}`}
              >
                {destination?.action ?? "Complete setup"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
