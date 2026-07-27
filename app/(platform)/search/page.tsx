import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpenText,
  Building2,
  CircleHelp,
  Globe2,
  MapPin,
  MessageSquareText,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { CategoryResults } from "@/components/features/search/CategoryResults";
import { ResultCard } from "@/components/features/search/ResultCard";
import { formatPrice } from "@/lib/presentation";
import {
  SEARCH_CATEGORIES,
  searchKondo,
  type SearchCategory,
} from "@/lib/search";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Search" };

const CATEGORY_LABEL: Record<SearchCategory, string> = {
  communities: "Communities",
  listings: "Marketplace",
  guides: "Guides",
  questions: "Questions",
  users: "Students",
  posts: "Posts",
};

function isSearchCategory(value?: string): value is SearchCategory {
  return (SEARCH_CATEGORIES as readonly string[]).includes(value ?? "");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q = "", type } = await searchParams;
  const user = await requireUser();

  if (q.length >= 2 && isSearchCategory(type)) {
    return (
      <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
        <Link
          className="inline-flex items-center gap-1 text-sm font-bold text-kondo-green"
          href={`/search?q=${encodeURIComponent(q)}`}
        >
          ← Back to all results
        </Link>
        <h1 className="mt-3 text-2xl font-black text-kondo-ink dark:text-white">
          {CATEGORY_LABEL[type]} matching “{q}”
        </h1>
        <div className="mt-6">
          <CategoryResults category={type} key={`${type}:${q}`} query={q} />
        </div>
      </div>
    );
  }

  const results = await searchKondo(q, user.id);
  const total = Object.values(results).reduce(
    (count, items) => count + items.length,
    0,
  );
  function viewAllHref(category: SearchCategory) {
    return `/search?q=${encodeURIComponent(q)}&type=${category}`;
  }
  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <form
        className="flex h-16 items-center gap-4 rounded-3xl border border-border bg-card px-5 text-card-foreground shadow-soft"
        role="search"
      >
        <Search className="h-5 w-5 text-kondo-green" />
        <input
          autoFocus
          className="w-full bg-transparent text-lg font-semibold text-kondo-ink outline-none placeholder:font-normal placeholder:text-muted-foreground dark:text-white"
          defaultValue={q}
          name="q"
          placeholder="Search all of Kondo"
        />
        <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-muted-foreground dark:border-white/10 dark:bg-white/5">
          Enter
        </kbd>
      </form>
      {q.length < 2 ? (
        <div className="py-24 text-center">
          <Search className="mx-auto h-9 w-9 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
            One search for your whole student life
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Find people, communities, universities, places, opportunities,
            answers, guides, posts, and marketplace items.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-7 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                Search results
              </p>
              <h1 className="mt-1 text-2xl font-black text-kondo-ink dark:text-white">
                “{q}”
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">{total} results</p>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {results.communities.map((item) => (
              <ResultCard
                href={`/communities/${item.slug}`}
                icon={<Users />}
                key={item.id}
                label="Community"
                title={`${item.icon ?? "✦"} ${item.name}`}
                detail={`${item.memberCount} members`}
                badge={
                  item.isOfficial || item.isVerified ? (
                    <OfficialMark
                      organizationName={item.name}
                      organizationType="COMMUNITY"
                    />
                  ) : undefined
                }
              />
            ))}
            {results.guides.map((item) => (
              <ResultCard
                href={`/guides/${item.slug}`}
                icon={<BookOpenText />}
                key={item.id}
                label="Guide"
                title={item.title}
                detail={`${item.estimatedMinutes} min checklist`}
              />
            ))}
            {results.listings.map((item) => (
              <ResultCard
                href={`/marketplace/${item.slug}`}
                icon={<ShoppingBag />}
                key={item.id}
                label="Marketplace"
                title={item.title}
                detail={`${formatPrice(item.priceFen)} · ${item.cityName}`}
              />
            ))}
            {results.questions.map((item) => (
              <ResultCard
                href={`/help/${item.slug}`}
                icon={<CircleHelp />}
                key={item.id}
                label="Question"
                title={item.title}
                detail={`${item.answerCount} answers`}
              />
            ))}
            {results.posts.map((item) => (
              <ResultCard
                detail={`${item.author.firstName} · ${item.community.name}`}
                href={`/communities/${item.community.slug}?post=${item.id}`}
                icon={<MessageSquareText />}
                key={item.id}
                label="Post"
                title={item.title ?? item.content.slice(0, 80)}
              />
            ))}
            {results.users.map((item) => (
              <Link href={`/profile/${item.username ?? item.id}`} key={item.id}>
                <Card className="flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                  <Avatar
                    firstName={item.firstName}
                    lastName={item.lastName}
                    mediaId={item.avatarMediaId}
                    seed={item.id}
                  />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                      Student
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <h2 className="font-bold text-kondo-ink dark:text-white">
                        {item.firstName} {item.lastName}
                      </h2>
                      {item.officialProfileStatus === "APPROVED" ? (
                        <OfficialMark
                          organizationName={item.officialOrganizationName}
                          organizationType={item.officialOrganizationType}
                          verifiedAt={item.officialVerifiedAt}
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.countryEmoji} {item.affiliation}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
            {results.universities.map((item) => (
              <ResultCard
                badge={
                  <OfficialMark
                    organizationName={item.name}
                    organizationType="UNIVERSITY"
                  />
                }
                detail={[item.shortName, item.cityName]
                  .filter(Boolean)
                  .join(" · ")}
                href={`/communities?tab=discover&q=${encodeURIComponent(item.name)}`}
                icon={<Building2 />}
                key={item.id}
                label="University"
                title={item.name}
              />
            ))}
            {results.countries.map((item) => (
              <ResultCard
                detail={item.code}
                href={`/communities?tab=discover&q=${encodeURIComponent(item.name)}`}
                icon={<Globe2 />}
                key={item.id}
                label="Country"
                title={`${item.emoji ?? "🌍"} ${item.name}`}
              />
            ))}
            {results.cities.map((item) => (
              <ResultCard
                detail={item.province ?? "Explore city guide"}
                href={`/explore/${item.slug}`}
                icon={<MapPin />}
                key={item.id}
                label="City"
                title={item.name}
              />
            ))}
            {results.opportunities.map((item) => (
              <ResultCard
                detail={`${item.provider} · ${item.status.replaceAll("_", " ")}`}
                href={`/student-hub/scholarships/${item.slug}`}
                icon={<Award />}
                key={item.id}
                label="Opportunity"
                title={item.title}
              />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {SEARCH_CATEGORIES.filter(
              (category) => results[category].length === 6,
            ).map((category) => (
              <Link
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-kondo-green transition hover:border-kondo-green dark:border-white/10"
                href={viewAllHref(category)}
                key={category}
              >
                View all {CATEGORY_LABEL[category]}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
