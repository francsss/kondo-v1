import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, ChevronRight, SearchX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { listUnifiedSaved, type SavedContentType } from "@/lib/saved-content";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Saved" };
export const dynamic = "force-dynamic";

const filters: Array<{ value: "all" | SavedContentType; label: string }> = [
  { value: "all", label: "All" },
  { value: "opportunity", label: "Opportunities" },
  { value: "housing", label: "Housing" },
  { value: "product", label: "Products" },
  { value: "service", label: "Services" },
  { value: "marketplace", label: "Marketplace" },
];

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const type = filters.some((item) => item.value === params.type)
    ? (params.type as "all" | SavedContentType)
    : "all";
  const sort = params.sort === "oldest" ? "oldest" : "newest";
  const items = await listUnifiedSaved({ userId: user.id, type, sort });
  return (
    <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
            <Bookmark className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-kondo-green">
              Private to you
            </p>
            <h1 className="text-3xl font-black tracking-tight">Saved</h1>
          </div>
        </div>
        <div className="flex rounded-full border border-border bg-card p-1 text-xs font-bold">
          <Link
            className={`rounded-full px-3 py-2 ${sort === "newest" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
            href={`/saved?type=${type}&sort=newest`}
            scroll={false}
          >
            Newest
          </Link>
          <Link
            className={`rounded-full px-3 py-2 ${sort === "oldest" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
            href={`/saved?type=${type}&sort=oldest`}
            scroll={false}
          >
            Oldest
          </Link>
        </div>
      </div>
      <nav
        aria-label="Saved item filters"
        className="-mx-1 mt-7 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        {filters.map((filter) => (
          <Link
            aria-current={type === filter.value ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${type === filter.value ? "border-kondo-green bg-kondo-green text-white" : "border-border bg-card text-muted-foreground hover:border-kondo-green/40"}`}
            href={`/saved?type=${filter.value}&sort=${sort}`}
            key={filter.value}
            scroll={false}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      {items.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card className="flex min-h-44 flex-col" key={item.key}>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-kondo-green">
                {item.eyebrow}
              </p>
              <h2 className="mt-2 text-lg font-black tracking-tight text-kondo-ink dark:text-white">
                {item.title}
              </h2>
              {item.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              <div className="mt-auto pt-5">
                {item.href ? (
                  <Link
                    className="inline-flex items-center gap-1 text-sm font-black text-kondo-green"
                    href={item.href}
                  >
                    Open <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    This saved item is no longer publicly available.
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <section className="mt-8 rounded-4xl border border-dashed border-border p-12 text-center">
          <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-black">
            No saved items in this view
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Save useful housing, opportunities, products, services or
            marketplace items and find them here.
          </p>
          <Link
            className="mt-5 inline-flex rounded-full bg-kondo-green px-5 py-3 text-sm font-black text-white"
            href="/discover"
          >
            Open Discover
          </Link>
        </section>
      )}
    </main>
  );
}
