import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { OrganizationPublicChrome } from "@/components/organizations/OrganizationPublicChrome";

export default function OrganizationPublicProfileNotFound() {
  return (
    <div className="min-h-dvh bg-background">
      <OrganizationPublicChrome
        backHref="/organizations"
        backLabel="All organizations"
        overCover={false}
      />
      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[760px] place-items-center px-4 pb-12 pt-28 sm:px-6">
        <section className="w-full rounded-[2rem] border border-border bg-card p-7 text-center shadow-sm sm:p-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[1.4rem] bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
            <Building2 className="h-7 w-7" />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-kondo-green">
            Public organizations
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-kondo-ink dark:text-white sm:text-4xl">
            Organization profile unavailable
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
            This public profile may have moved or may no longer be available.
            Private and unpublished organization information is never shown
            here.
          </p>
          <Link
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-kondo-forest px-6 text-sm font-black text-white transition hover:bg-kondo-green"
            href="/organizations"
          >
            <Search className="h-4 w-4" />
            Explore public organizations
          </Link>
        </section>
      </main>
    </div>
  );
}
