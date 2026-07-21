import type { CommunityType } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { CommunityCard } from "@/components/features/community/CommunityCard";
import { CommunityCreateDialog } from "@/components/features/community/CommunityCreateDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCommunityDirectory } from "@/lib/platform-queries";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Communities" };

const filters = [
  { label: "All", value: undefined },
  { label: "My communities", value: "JOINED" },
  { label: "University", value: "UNIVERSITY" },
  { label: "City", value: "CITY" },
  { label: "Country", value: "COUNTRY" },
  { label: "Topics", value: "TOPIC" },
] as const;

function href(input: { type?: string; q?: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.type) params.set("type", input.type);
  if (input.q) params.set("q", input.q);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/communities?${query}` : "/communities";
}

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const normalizedFilter = params.type?.toUpperCase();
  const type = ["UNIVERSITY", "CITY", "COUNTRY", "TOPIC"].includes(
    normalizedFilter ?? "",
  )
    ? (normalizedFilter as CommunityType)
    : undefined;
  const [result, joinedResult, countries, cities, universities] =
    await Promise.all([
      getCommunityDirectory(user.id, {
        page: Number(params.page ?? 1),
        type,
        joined: normalizedFilter === "JOINED",
        query: params.q,
      }),
      getCommunityDirectory(user.id, { joined: true, pageSize: 5 }),
      prisma.country.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.city.findMany({
        where: { isActive: true },
        select: { id: true, name: true, country: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.university.findMany({
        where: { isActive: true, verified: true },
        select: { id: true, name: true, city: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
  const referenceCities = cities.map((city) => ({
    id: city.id,
    name: `${city.name}, ${city.country.name}`,
  }));
  const referenceUniversities = universities.map((university) => ({
    id: university.id,
    name: `${university.name} · ${university.city.name}`,
  }));

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          description="Find the people who understand your campus, your city, your country, and the questions on your mind."
          eyebrow="Belong anywhere"
          title="Your communities"
        />
        <CommunityCreateDialog
          cities={referenceCities}
          countries={countries}
          universities={referenceUniversities}
        />
      </div>

      {joinedResult.communities.length ? (
        <section className="mt-8 overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#238164] p-6 text-white shadow-lift sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-kondo-lime">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Your
                circle
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                You have {joinedResult.total} places to belong.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                Ask the small questions, share useful discoveries, and make the
                next student’s first week easier.
              </p>
            </div>
            <div className="flex -space-x-3">
              {joinedResult.communities.map((community) => (
                <Link
                  aria-label={community.name}
                  className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-kondo-forest bg-white text-xl shadow-lg transition hover:-translate-y-1"
                  href={`/communities/${community.slug}`}
                  key={community.id}
                >
                  {community.icon}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Card className="mt-8">
        <form className="flex flex-col gap-3 sm:flex-row">
          {normalizedFilter ? (
            <input name="type" type="hidden" value={normalizedFilter} />
          ) : null}
          <label className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent pl-11 pr-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
              defaultValue={params.q}
              name="q"
              placeholder="Search communities"
            />
          </label>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      <div className="scrollbar-none mt-6 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => {
          const active = filter.value
            ? normalizedFilter === filter.value
            : !normalizedFilter;
          return (
            <Link
              className={
                active
                  ? "whitespace-nowrap rounded-full bg-kondo-ink px-4 py-2 text-sm font-bold text-white dark:bg-emerald-400 dark:text-kondo-ink"
                  : "whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-muted-foreground hover:border-kondo-green hover:text-kondo-forest dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground"
              }
              href={href({ type: filter.value, q: params.q })}
              key={filter.label}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {result.communities.map((community) => (
          <CommunityCard community={community} key={community.id} />
        ))}
      </section>
      {!result.communities.length ? (
        <Card className="mt-5 py-16 text-center text-sm text-muted-foreground">
          No communities match this view.
        </Card>
      ) : null}

      <div className="mt-7 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} communities
        </p>
        <div className="flex gap-2">
          <Button
            aria-disabled={result.page <= 1}
            asChild
            size="sm"
            variant="secondary"
          >
            <Link
              href={href({
                type: normalizedFilter,
                q: params.q,
                page: Math.max(1, result.page - 1),
              })}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
          </Button>
          <Button
            aria-disabled={result.page >= result.pageCount}
            asChild
            size="sm"
            variant="secondary"
          >
            <Link
              href={href({
                type: normalizedFilter,
                q: params.q,
                page: Math.min(result.pageCount, result.page + 1),
              })}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
