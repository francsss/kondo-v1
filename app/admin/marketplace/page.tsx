import type { ListingStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { MarketplaceCategoryManager } from "@/components/features/admin/MarketplaceCategoryManager";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listAdminListings,
  listMarketplaceCategories,
} from "@/lib/marketplace";
import { formatPrice, formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin Marketplace" };
const statuses = [
  "DRAFT",
  "ACTIVE",
  "RESERVED",
  "SOLD",
  "ARCHIVED",
  "EXPIRED",
  "REMOVED",
];
function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function href(
  input: { q?: string; status?: string; flagged?: string },
  page: number,
) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.status) params.set("status", input.status);
  if (input.flagged) params.set("flagged", input.flagged);
  if (page > 1) params.set("page", String(page));
  return `/admin/marketplace?${params.toString()}`;
}

export default async function AdminMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("MARKETPLACE_CMS_VIEW");
  const params = await searchParams;
  const rawStatus = one(params.status);
  const status = statuses.includes(rawStatus ?? "")
    ? (rawStatus as ListingStatus)
    : undefined;
  const query = one(params.q)?.trim() || undefined;
  const flagged = one(params.flagged) === "true";
  const [result, categories] = await Promise.all([
    listAdminListings(user, {
      page: Number(one(params.page) ?? 1),
      query,
      status,
      flagged,
    }),
    listMarketplaceCategories(true),
  ]);
  const linkInput = { q: query, status, flagged: flagged ? "true" : undefined };
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review listing lifecycle, expiration, seller context, fraud signals, categories, and report handoff without introducing payments."
        eyebrow="Kondo operations"
        title="Marketplace"
      />
      <AdminNav currentPath="/admin/marketplace" role={user.role} />
      <Card className="mt-7">
        <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_200px_160px_auto]">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder="Listing or seller"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={flagged ? "true" : ""}
            name="flagged"
          >
            <option value="">All risk levels</option>
            <option value="true">Flagged only</option>
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Filter
          </Button>
        </form>
      </Card>
      <div className="mt-6 space-y-3">
        {result.records.map((listing) => (
          <Link href={`/admin/marketplace/${listing.id}`} key={listing.id}>
            <Card className="mb-3 grid gap-4 transition hover:border-kondo-green/40 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black text-kondo-ink dark:text-white">
                    {listing.title}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black dark:bg-white/10">
                    {listing.status}
                  </span>
                  {listing.fraudScore >= 40 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">
                      RISK {listing.fraudScore}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {listing.category.name} · {listing.city.name} ·{" "}
                  {listing.seller.fullName}
                </p>
              </div>
              <p className="font-black text-kondo-green">
                {formatPrice(listing.priceFen)}
              </p>
              <p className="text-xs text-muted-foreground">
                {listing._count.favorites} saved ·{" "}
                {formatRelativeDate(new Date(listing.updatedAt))}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
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
      <MarketplaceCategoryManager categories={categories} />
    </div>
  );
}
