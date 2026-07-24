import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Utensils,
  Users,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CityHubCreateForm } from "@/components/features/admin/CityHubCreateForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listAdminCityHubs,
  type CityHubSort,
  type CityHubStatus,
} from "@/lib/city-hub";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin City Hubs" };

const STATUS_STYLES: Record<CityHubStatus | "NOT_STARTED", string> = {
  PUBLISHED:
    "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  REVIEW:
    "rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  DRAFT:
    "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/10 dark:text-muted-foreground",
  NOT_STARTED:
    "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/10 dark:text-muted-foreground",
};

const SORTS: readonly CityHubSort[] = [
  "students",
  "needs-content",
  "activity",
  "recent",
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(
  input: { q?: string; status?: string; sort?: string },
  page: number,
) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.status) params.set("status", input.status);
  if (input.sort && input.sort !== "students") params.set("sort", input.sort);
  if (page > 1) params.set("page", String(page));
  return `/admin/city-hubs?${params.toString()}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function AdminCityHubsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("CITY_CMS_VIEW");
  const params = await searchParams;
  const query = one(params.q)?.trim() || undefined;
  const statusParam = one(params.status);
  const status = (["DRAFT", "REVIEW", "PUBLISHED"] as const).includes(
    statusParam as CityHubStatus,
  )
    ? (statusParam as CityHubStatus)
    : undefined;
  const sortParam = one(params.sort);
  const sort = SORTS.includes(sortParam as CityHubSort)
    ? (sortParam as CityHubSort)
    : "students";
  const result = await listAdminCityHubs(user, {
    page: Number(one(params.page) ?? 1),
    query,
    status,
    sort,
  });
  const linkInput = { q: query, status: statusParam, sort };

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Cities appear automatically when at least one active member selects them. Prioritise the places where Kondo students already live."
        eyebrow="Kondo operations"
        title="City content"
      />
      <AdminNav currentPath="/admin/city-hubs" role={user.role} />

      <section
        aria-label="City content overview"
        className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Active student cities",
            value: formatNumber(result.summary.activeCities),
            detail: "Generated from member profiles",
          },
          {
            label: "Students represented",
            value: formatNumber(result.summary.students),
            detail: "Active accounts with a city",
          },
          {
            label: "Cities without content",
            value: formatNumber(result.summary.citiesWithoutContent),
            detail: "Best next opportunities",
          },
          {
            label: "Average completion",
            value: `${result.summary.averageCompletion}%`,
            detail: "Across the current selection",
          },
        ].map((item) => (
          <Card className="p-5" key={item.label}>
            <p className="text-xs font-bold text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight text-kondo-ink dark:text-white">
              {item.value}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.detail}
            </p>
          </Card>
        ))}
      </section>

      <Card className="mt-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_190px_220px_auto]">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder="City or province"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm outline-none focus:border-kondo-green dark:border-white/10"
            defaultValue={statusParam ?? ""}
            name="status"
          >
            <option value="">All workflows</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">In review</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm outline-none focus:border-kondo-green dark:border-white/10"
            defaultValue={sort}
            name="sort"
          >
            <option value="students">Most students</option>
            <option value="needs-content">Needs content first</option>
            <option value="activity">Most active</option>
            <option value="recent">Recently added</option>
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Apply
          </Button>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {result.records.map((city) => {
          const workflow = city.status ?? "NOT_STARTED";
          return (
            <Card className="p-5 sm:p-6" key={city.cityId}>
              <div className="grid gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.5fr)_170px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-black text-kondo-ink dark:text-white">
                      {city.name}
                    </h2>
                    <span className={STATUS_STYLES[workflow]}>
                      {workflow === "NOT_STARTED" ? "NOT STARTED" : workflow}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[city.province, city.country].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 text-kondo-green" />
                    {formatNumber(city.activeUserCount)} active in the last 30
                    days
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Metric
                      icon={Users}
                      label="Students"
                      value={city.userCount}
                    />
                    <Metric
                      icon={Building2}
                      label="Companies"
                      value={city.companyCount}
                    />
                    <Metric
                      icon={BriefcaseBusiness}
                      label="Internships"
                      value={city.internshipCount}
                    />
                    <Metric
                      icon={Utensils}
                      label="Restaurants"
                      value={city.restaurantCount}
                    />
                    <Metric
                      icon={CalendarDays}
                      label="Events"
                      value={city.eventCount}
                    />
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold text-muted-foreground">
                        Information completion
                      </span>
                      <span className="font-black text-kondo-ink dark:text-white">
                        {city.completion}%
                      </span>
                    </div>
                    <div
                      aria-label={`${city.completion}% complete`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={city.completion}
                      className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
                      role="progressbar"
                    >
                      <div
                        className="h-full rounded-full bg-kondo-green transition-[width]"
                        style={{ width: `${city.completion}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-stretch lg:items-end">
                  {city.hubId ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/admin/city-hubs/${city.hubId}`}>
                        Manage content
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <CityHubCreateForm
                      cityId={city.cityId}
                      cityName={city.name}
                    />
                  )}
                  <p className="mt-2 text-right text-[11px] text-muted-foreground">
                    {city.updatedAt
                      ? `Updated ${new Date(city.updatedAt).toLocaleDateString()}`
                      : "Ready for its first content"}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
        {!result.records.length ? (
          <Card className="py-16 text-center">
            <Users className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold text-kondo-ink dark:text-white">
              No student city matches these filters.
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              A city will appear here automatically as soon as an active member
              selects it during registration or onboarding.
            </p>
          </Card>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} cities
        </p>
        <div className="flex gap-2">
          {result.page <= 1 ? (
            <Button disabled size="sm" variant="secondary">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href={href(linkInput, result.page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
            </Button>
          )}
          {result.page >= result.pageCount ? (
            <Button disabled size="sm" variant="secondary">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href={href(linkInput, result.page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/5">
      <div className="flex items-start gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[9px] font-bold leading-tight sm:text-[10px]">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-lg font-black text-kondo-ink dark:text-white">
        {formatNumber(value)}
      </p>
    </div>
  );
}
