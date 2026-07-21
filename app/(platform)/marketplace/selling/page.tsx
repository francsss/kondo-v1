import type { ListingStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Edit3, Plus } from "lucide-react";
import { SellerListingActions } from "@/components/features/marketplace/SellerListingActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";
import { PageHeader } from "@/components/ui/PageHeader";
import { listSellerListings } from "@/lib/marketplace";
import { formatPrice, formatRelativeDate } from "@/lib/presentation";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Seller dashboard" };
const statuses = [
  "DRAFT",
  "ACTIVE",
  "RESERVED",
  "SOLD",
  "ARCHIVED",
  "EXPIRED",
] as const;

function pageHref(status: ListingStatus | undefined, page: number) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/marketplace/selling?${query}` : "/marketplace/selling";
}

export default async function SellerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const status = statuses.includes(params.status as (typeof statuses)[number])
    ? (params.status as ListingStatus)
    : undefined;
  const result = await listSellerListings(user, {
    page: Number(params.page ?? 1),
    status,
  });
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        action={
          <Button asChild>
            <Link href="/marketplace/new">
              <Plus className="h-4 w-4" /> New listing
            </Link>
          </Button>
        }
        description="Manage drafts, availability, reservations, sales, archives, renewals, and safety-review state."
        eyebrow="Seller tools"
        title="Your listings"
      />
      <div className="scrollbar-none mt-7 flex gap-2 overflow-x-auto">
        <Button asChild size="sm" variant={!status ? "primary" : "secondary"}>
          <Link href="/marketplace/selling">All</Link>
        </Button>
        {statuses.map((value) => (
          <Button
            asChild
            key={value}
            size="sm"
            variant={status === value ? "primary" : "secondary"}
          >
            <Link href={`/marketplace/selling?status=${value}`}>{value}</Link>
          </Button>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {result.records.map((listing) => (
          <Card
            className="grid gap-5 md:grid-cols-[130px_minmax(0,1fr)_auto] md:items-center"
            key={listing.id}
          >
            <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/5">
              {listing.image?.mediaId ? (
                <MediaImage
                  alt={listing.image.altText ?? listing.title}
                  className="h-full w-full object-cover"
                  height={300}
                  mediaId={listing.image.mediaId}
                  width={400}
                />
              ) : (
                <span className="text-4xl">📦</span>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-black text-kondo-ink dark:text-white">
                  {listing.title}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/10">
                  {listing.status}
                </span>
                {listing.fraudScore >= 40 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">
                    SAFETY REVIEW
                  </span>
                ) : null}
              </div>
              <p className="mt-2 font-black text-kondo-green">
                {formatPrice(listing.priceFen)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {listing._count.favorites} saved · Updated{" "}
                {formatRelativeDate(new Date(listing.updatedAt))}
                {listing.expiresAt
                  ? ` · Expires ${new Date(listing.expiresAt).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            <div className="space-y-3">
              <Button asChild size="sm" variant="secondary">
                <Link href={`/marketplace/${listing.slug}/edit`}>
                  <Edit3 className="h-4 w-4" /> Edit
                </Link>
              </Button>
              <SellerListingActions
                listingId={listing.id}
                status={listing.status}
              />
            </div>
          </Card>
        ))}
      </div>
      {!result.records.length ? (
        <Card className="mt-6 py-16 text-center text-sm text-muted-foreground">
          No listings in this view.
        </Card>
      ) : null}
      {result.pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {result.page} of {result.pageCount} · {result.total} listings
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={pageHref(status, Math.max(1, result.page - 1))}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link
                href={pageHref(
                  status,
                  Math.min(result.pageCount, result.page + 1),
                )}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
