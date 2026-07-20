import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CityHubCreateForm } from "@/components/features/admin/CityHubCreateForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listExploreCities } from "@/features/explore/registry";
import { listAdminCityHubs, type CityHubStatus } from "@/lib/city-hub";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin City Hubs" };

const STATUS_STYLES: Record<CityHubStatus, string> = {
  PUBLISHED:
    "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  REVIEW:
    "rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  DRAFT:
    "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300",
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(input: { q?: string; status?: string }, page: number) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.status) params.set("status", input.status);
  if (page > 1) params.set("page", String(page));
  return `/admin/city-hubs?${params.toString()}`;
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
  const result = await listAdminCityHubs(user, {
    page: Number(one(params.page) ?? 1),
    query,
    status,
  });
  const linkInput = { q: query, status: statusParam };
  const registryCities = listExploreCities().map((city) => ({
    slug: city.slug,
    name: city.name,
  }));

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Draft, review, and publish the Explore your city hubs. Only administrators can publish."
        eyebrow="Kondo operations"
        title="City hubs"
      />
      <AdminNav currentPath="/admin/city-hubs" role={user.role} />
      <Card className="mt-7">
        <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_200px_auto]">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder="City name or slug"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={statusParam ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">Review</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Filter
          </Button>
        </form>
      </Card>
      <div className="mt-6 space-y-3">
        {result.records.map((hub) => (
          <Link href={`/admin/city-hubs/${hub.id}`} key={hub.id}>
            <Card className="mb-3 grid gap-4 transition hover:border-kondo-green/40 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black text-kondo-ink dark:text-white">
                    {hub.name}
                  </h2>
                  <span className={STATUS_STYLES[hub.status]}>
                    {hub.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">/{hub.slug}</p>
              </div>
              <p className="text-xs text-slate-400">
                {hub.publishedAt
                  ? `Published ${new Date(hub.publishedAt).toLocaleDateString()}`
                  : "Never published"}
              </p>
              <p className="text-xs text-slate-400">
                Updated {new Date(hub.updatedAt).toLocaleDateString()}
              </p>
            </Card>
          </Link>
        ))}
        {!result.records.length ? (
          <Card className="py-16 text-center text-sm text-slate-400">
            No city hubs match these filters.
          </Card>
        ) : null}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Page {result.page} of {result.pageCount} · {result.total}
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={href(linkInput, Math.max(1, result.page - 1))}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link
              href={href(
                linkInput,
                Math.min(result.pageCount, result.page + 1),
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      <CityHubCreateForm registryCities={registryCities} />
    </div>
  );
}
