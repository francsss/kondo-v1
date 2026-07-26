import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, MapPin, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { StudentOpportunity } from "@/lib/student-opportunities";

export function OpportunityDirectory({
  items,
  query,
  internshipsOnly = false,
}: {
  items: StudentOpportunity[];
  query: string;
  internshipsOnly?: boolean;
}) {
  const needle = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    const isInternship = `${item.title} ${item.category} ${item.tags.join(" ")}`
      .toLowerCase()
      .includes("intern");
    return (
      (!internshipsOnly || isInternship) &&
      (!needle ||
        `${item.title} ${item.summary} ${item.category} ${item.cityName} ${item.tags.join(" ")}`
          .toLowerCase()
          .includes(needle))
    );
  });

  return (
    <>
      <form
        className="mt-7 flex h-12 max-w-2xl items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm"
        role="search"
      >
        <Search className="h-4 w-4 text-kondo-green" />
        <input
          aria-label={
            internshipsOnly ? "Search internships" : "Search opportunities"
          }
          className="w-full bg-transparent text-sm outline-none"
          defaultValue={query}
          name="q"
          placeholder={
            internshipsOnly
              ? "Role, company, city or field"
              : "Competition, event, project, city or field"
          }
        />
      </form>
      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <Card
            className="flex h-full flex-col"
            key={`${item.citySlug}:${item.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              {item.status ? (
                <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                  {item.status}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-kondo-green">
              {item.category}
            </p>
            <h2 className="mt-2 text-lg font-black">{item.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
              {item.summary}
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {item.location ?? item.cityName}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {item.source ? (
                <a
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-black text-primary-foreground"
                  href={item.source.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  Official link <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <Link
                className="inline-flex items-center rounded-full border border-border px-4 py-2 text-xs font-black"
                href={`/explore/${item.citySlug}/jobs`}
              >
                Explore {item.cityName}
              </Link>
            </div>
          </Card>
        ))}
      </section>
      {!visible.length ? (
        <Card className="mt-6 py-16 text-center">
          <p className="font-black">
            No matching opportunity is published yet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a broader search or check back as official City Hubs are
            updated.
          </p>
        </Card>
      ) : null}
    </>
  );
}
