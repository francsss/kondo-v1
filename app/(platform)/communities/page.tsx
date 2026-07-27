import type { CommunityType } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { CommunityCard } from "@/components/features/community/CommunityCard";
import { CommunityCreateDialog } from "@/components/features/community/CommunityCreateDialog";
import { CommunitySectionNav } from "@/components/features/community/CommunitySectionNav";
import { MeetPanel } from "@/components/features/community/MeetPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCommunityDirectory } from "@/lib/platform-queries";
import { getPremiumAccess } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Communities" };

type MainTab = "my" | "discover" | "meet";
type Scope = "managed" | "joined";
type Sort = "recommended" | "popular" | "recent";

function communityHref(input: {
  tab?: MainTab;
  scope?: Scope;
  sort?: Sort;
  type?: string;
  q?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (input.tab && input.tab !== "my") params.set("tab", input.tab);
  if (input.scope && input.scope !== "managed")
    params.set("scope", input.scope);
  if (input.sort && input.sort !== "recommended")
    params.set("sort", input.sort);
  if (input.type) params.set("type", input.type);
  if (input.q) params.set("q", input.q);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/communities?${query}` : "/communities";
}

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    scope?: string;
    sort?: string;
    type?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab: MainTab = ["my", "discover", "meet"].includes(params.tab ?? "")
    ? (params.tab as MainTab)
    : "my";
  const scope: Scope = params.scope === "joined" ? "joined" : "managed";
  const sort: Sort = ["popular", "recent"].includes(params.sort ?? "")
    ? (params.sort as Sort)
    : "recommended";
  const normalizedType = params.type?.toUpperCase();
  const type = ["UNIVERSITY", "CITY", "COUNTRY", "TOPIC"].includes(
    normalizedType ?? "",
  )
    ? (normalizedType as CommunityType)
    : undefined;

  const [
    countries,
    cities,
    universities,
    result,
    joinedSummary,
    meetProfile,
    premiumAccess,
  ] = await Promise.all([
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
      select: {
        id: true,
        name: true,
        cityId: true,
        city: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    tab === "meet"
      ? Promise.resolve(null)
      : getCommunityDirectory(user.id, {
          page: Number(params.page ?? 1),
          type,
          query: params.q,
          membership:
            tab === "my"
              ? scope === "managed"
                ? "MANAGED"
                : "JOINED"
              : undefined,
          sort:
            tab === "discover"
              ? sort === "popular"
                ? "POPULAR"
                : sort === "recent"
                  ? "RECENT"
                  : "RECOMMENDED"
              : undefined,
        }),
    getCommunityDirectory(user.id, { joined: true, pageSize: 5 }),
    tab === "meet"
      ? prisma.meetDiscoveryProfile.findUnique({
          where: { userId: user.id },
        })
      : Promise.resolve(null),
    tab === "meet"
      ? getPremiumAccess(user.id)
      : Promise.resolve({
          active: false,
          status: null,
          planName: null,
          featureKeys: [],
          expiresAt: null,
        }),
  ]);

  const referenceCities = cities.map((city) => ({
    id: city.id,
    name: `${city.name}, ${city.country.name}`,
  }));
  const referenceUniversities = universities.map((university) => ({
    id: university.id,
    name: `${university.name} · ${university.city.name}`,
    cityId: university.cityId,
  }));
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          description="Your circles, new communities to discover, and real conversations with students across Kondo."
          eyebrow="Belong anywhere"
          title="Communities"
        />
        <CommunityCreateDialog
          cities={referenceCities}
          countries={countries}
          universities={referenceUniversities}
        />
      </div>

      <CommunitySectionNav activeTab={tab} userId={user.id} />

      {tab === "meet" ? (
        <section className="mt-8">
          <MeetPanel
            cityOptions={referenceCities}
            cityName={user.city?.name ?? null}
            countryName={user.country?.name ?? null}
            initialGender={user.gender}
            initialCityId={user.cityId}
            initialIntents={user.meetIntents}
            initialLanguages={user.languages}
            initialNearbyEnabled={user.nearbyDiscoveryEnabled}
            initialProfile={meetProfile}
            initialUniversityId={user.universityId}
            premiumAccess={premiumAccess}
            universityOptions={referenceUniversities}
            universityName={
              user.university?.shortName ?? user.university?.name ?? null
            }
          />
        </section>
      ) : null}

      {tab === "my" && joinedSummary.total > 0 ? (
        <section className="mt-8 overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#238164] p-6 text-white shadow-lift sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-kondo-lime">
                <Sparkles className="h-3.5 w-3.5" /> Your circle
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                You have {joinedSummary.total} places to belong.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                Manage the spaces you lead and return to every community you
                have joined.
              </p>
            </div>
            <div className="flex -space-x-3">
              {joinedSummary.communities.map((community) => (
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

      {tab === "my" ? (
        <nav
          aria-label="Your community groups"
          className="subnav-row mt-7 max-w-sm border-b border-border"
        >
          {(["managed", "joined"] as const).map((value) => (
            <Link
              className={
                scope === value
                  ? "relative px-5 py-3 text-center text-sm font-black text-kondo-green after:absolute after:inset-x-6 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green"
                  : "px-5 py-3 text-center text-sm font-bold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              }
              href={communityHref({
                tab,
                scope: value,
                q: params.q,
                type: normalizedType,
              })}
              key={value}
              scroll={false}
            >
              {value === "managed" ? "Managed" : "Joined"}
            </Link>
          ))}
        </nav>
      ) : null}

      {tab === "discover" ? (
        <nav
          aria-label="Community discovery order"
          className="subnav-row mt-7 max-w-lg gap-2"
        >
          {(["recommended", "popular", "recent"] as const).map((value) => (
            <Link
              className={
                sort === value
                  ? "rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
                  : "rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground"
              }
              href={communityHref({
                tab,
                sort: value,
                q: params.q,
                type: normalizedType,
              })}
              key={value}
              scroll={false}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Link>
          ))}
        </nav>
      ) : null}

      {tab !== "meet" ? (
        <>
          <Card className="mt-6">
            <form
              action="/communities#community-results"
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input name="tab" type="hidden" value={tab} />
              {tab === "my" ? (
                <input name="scope" type="hidden" value={scope} />
              ) : (
                <input name="sort" type="hidden" value={sort} />
              )}
              {normalizedType ? (
                <input name="type" type="hidden" value={normalizedType} />
              ) : null}
              <label className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-transparent pl-11 pr-4 text-sm outline-none focus:border-primary"
                  defaultValue={params.q}
                  name="q"
                  placeholder={
                    tab === "discover"
                      ? "Search communities to discover"
                      : "Search your communities"
                  }
                />
              </label>
              <Button type="submit">Search</Button>
            </form>
          </Card>

          <nav
            aria-label="Community types"
            className="subnav-row mt-5 border-b border-border"
          >
            {[
              { label: "All", value: undefined },
              { label: "University", value: "UNIVERSITY" },
              { label: "City", value: "CITY" },
              { label: "Country", value: "COUNTRY" },
              { label: "Topics", value: "TOPIC" },
            ].map((filter) => {
              const active = filter.value
                ? normalizedType === filter.value
                : !normalizedType;
              return (
                <Link
                  className={
                    active
                      ? "relative px-1 py-3 text-center text-xs font-black text-kondo-green after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green sm:px-4 sm:text-sm"
                      : "px-1 py-3 text-center text-xs font-bold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground sm:px-4 sm:text-sm"
                  }
                  href={communityHref({
                    tab,
                    scope,
                    sort,
                    type: filter.value,
                    q: params.q,
                  })}
                  key={filter.label}
                  scroll={false}
                >
                  {filter.label}
                </Link>
              );
            })}
          </nav>

          <section
            className="mt-5 grid scroll-mt-24 gap-5 sm:grid-cols-2 xl:grid-cols-3"
            id="community-results"
          >
            {result?.communities.map((community) => (
              <CommunityCard community={community} key={community.id} />
            ))}
          </section>
          {!result?.communities.length ? (
            <Card className="mt-5 py-16 text-center text-sm text-muted-foreground">
              {tab === "my"
                ? `No ${scope} communities match this view.`
                : "No communities match this discovery view."}
            </Card>
          ) : null}

          {result ? (
            <div className="mt-7 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {result.page} of {result.pageCount} · {result.total}{" "}
                communities
              </p>
              <div className="flex gap-2">
                <Button
                  aria-disabled={result.page <= 1}
                  asChild
                  size="sm"
                  variant="secondary"
                >
                  <Link
                    href={`${communityHref({
                      tab,
                      scope,
                      sort,
                      type: normalizedType,
                      q: params.q,
                      page: Math.max(1, result.page - 1),
                    })}#community-results`}
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
                    href={`${communityHref({
                      tab,
                      scope,
                      sort,
                      type: normalizedType,
                      q: params.q,
                      page: Math.min(result.pageCount, result.page + 1),
                    })}#community-results`}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
