import { ExternalLink, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { GuideTrust } from "@/lib/guide-trust";

/**
 * Where this guide's information came from, and when anyone last checked it.
 *
 * A student reads Kondo's residence-permit page at an airport or in a queue at
 * an office, and acts on it. So the page has to be honest about its own
 * standing: whether Kondo has actually checked this against a source, when, and
 * which source. Information that looks official but is not is worse than no
 * page at all — it is how someone misses a legal deadline believing they were
 * being careful.
 *
 * The treatment stays quiet on purpose. A large green VERIFIED badge would make
 * every unreviewed guide look broken and would put the loudest thing on the
 * page on something other than the instructions. Transparency, not decoration.
 *
 * External sources are marked as leaving Kondo, because a reader must never
 * mistake a government page for part of this app.
 */
export function GuideTrustPanel({
  trust,
  sources,
}: {
  trust: GuideTrust;
  sources: ReadonlyArray<{
    id: string;
    title: string;
    url: string;
    organization: string | null;
    isOfficial: boolean;
  }>;
}) {
  const Icon = trust.verified ? ShieldCheck : ShieldQuestion;

  return (
    <section
      aria-labelledby="guide-trust-heading"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <h2
        className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground"
        id="guide-trust-heading"
      >
        <Icon
          aria-hidden="true"
          className={`h-4 w-4 ${trust.verified ? "text-kondo-green" : "text-muted-foreground"}`}
        />
        {trust.verified ? "Checked information" : "Not yet reviewed"}
      </h2>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {trust.note}
      </p>

      {trust.reviewedLabel ? (
        <p className="mt-2 text-xs font-bold text-muted-foreground">
          {trust.reviewedLabel}
          {trust.reviewOverdue ? " · due for review" : ""}
        </p>
      ) : null}

      {sources.length ? (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            Sources
          </p>
          <ul className="mt-2 space-y-2">
            {sources.map((source) => (
              <li key={source.id}>
                <a
                  className="inline-flex items-start gap-1.5 text-sm font-bold text-kondo-green underline underline-offset-2"
                  href={source.url}
                  // Leaves Kondo, so it opens away and cannot reach back.
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  <span className="min-w-0">
                    {source.title}
                    {source.organization ? (
                      <span className="font-bold text-muted-foreground">
                        {" "}
                        · {source.organization}
                      </span>
                    ) : null}
                    {source.isOfficial ? (
                      <span className="ml-1.5 rounded-full bg-kondo-mint px-1.5 py-0.5 text-[10px] font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                        Official
                      </span>
                    ) : null}
                  </span>
                  <ExternalLink
                    aria-hidden="true"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            External sites, not part of Kondo.
          </p>
        </div>
      ) : null}
    </section>
  );
}
