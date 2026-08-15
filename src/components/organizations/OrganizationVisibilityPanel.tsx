import Link from "next/link";
import { Eye, EyeOff, ExternalLink, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Whether this organization can actually be found, said plainly.
 *
 * An organization that finishes onboarding is `ACTIVE` but still `PRIVATE`:
 * publishing is a separate, deliberate step. Nothing said so. Owners were
 * building a profile, adding products, and having no way to know the whole
 * thing was invisible to everyone else — the only way to find out was to make a
 * second account and search for yourself.
 *
 * So the state is stated, in the workspace, in the owner's words rather than
 * the schema's: visible, ready to publish, or not published and here is what is
 * missing. Publishing stays an explicit action because it genuinely is one —
 * this does not invent a button, it reveals the one that already exists.
 *
 * Verification is deliberately absent. An organization is publicly visible
 * without being verified; verification governs the trust badge, not
 * discoverability, and conflating them here would teach the owner something
 * untrue about their own profile.
 */

export type OrganizationVisibilityState = {
  slug: string;
  publicProfileStatus: string;
  /** Requirements still unmet, already phrased for a person. */
  missing: ReadonlyArray<{ key: string; message: string }>;
  /** Moderation or lifecycle problems, which outrank missing fields. */
  blocking: ReadonlyArray<{ key: string; message: string }>;
  canPublish: boolean;
};

export function OrganizationVisibilityPanel({
  state,
}: {
  state: OrganizationVisibilityState;
}) {
  const published = state.publicProfileStatus === "PUBLISHED";
  const blocked = state.blocking.length > 0;
  const ready = !published && !blocked && state.missing.length === 0;

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
            Public visibility
          </h2>
          <p className="mt-1 text-base font-black text-foreground">
            {published
              ? "Visible"
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
                  : "This organization is not findable in search yet."}
          </p>

          {/* Only when there is something to do about it. */}
          {!published && !blocked && state.missing.length ? (
            <ul className="mt-3 space-y-1">
              {state.missing.slice(0, 3).map((requirement) => (
                <li
                  className="text-sm text-muted-foreground"
                  key={requirement.key}
                >
                  · {requirement.message}
                </li>
              ))}
            </ul>
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
            ) : (
              <Link
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-black transition",
                  ready && state.canPublish
                    ? "bg-kondo-green text-white"
                    : "border border-border bg-card text-foreground hover:border-kondo-green/40",
                )}
                href={`/organizations/${state.slug}/profile`}
              >
                {ready && state.canPublish ? (
                  <>
                    <Rocket aria-hidden="true" className="h-4 w-4" />
                    Publish organization
                  </>
                ) : (
                  "Complete profile"
                )}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
