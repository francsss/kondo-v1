import Link from "next/link";
import { HousingAdminActions } from "@/components/features/admin/HousingAdminActions";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export default async function AdminHousingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminPermission("HOUSING_VIEW");
  const params = await searchParams;
  const status =
    params.status &&
    [
      "DRAFT",
      "PENDING_REVIEW",
      "PUBLISHED",
      "PAUSED",
      "RENTED",
      "EXPIRED",
      "REJECTED",
      "REMOVED",
      "ARCHIVED",
    ].includes(params.status)
      ? (params.status as
          | "DRAFT"
          | "PENDING_REVIEW"
          | "PUBLISHED"
          | "PAUSED"
          | "RENTED"
          | "EXPIRED"
          | "REJECTED"
          | "REMOVED"
          | "ARCHIVED")
      : undefined;
  const [counts, listings] = await Promise.all([
    prisma.housingListing.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.housingListing.findMany({
      where: { status },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        publisherType: true,
        monthlyRentMinor: true,
        currency: true,
        createdAt: true,
        city: { select: { name: true } },
        publisherUser: {
          select: { firstName: true, lastName: true, email: true },
        },
        publisherOrganization: { select: { publicName: true } },
        _count: { select: { media: true, inquiries: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);
  return (
    <section>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          Trust and supply
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Housing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review publication readiness, investigate reports and remove unsafe
          homes from every public projection.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          className="rounded-full border border-border px-3 py-2 text-xs font-bold"
          href="/admin/housing"
        >
          All
        </Link>
        {counts.map((count) => (
          <Link
            className="rounded-full border border-border px-3 py-2 text-xs font-bold"
            href={`/admin/housing?status=${count.status}`}
            key={count.status}
          >
            {count.status.replaceAll("_", " ")} ({count._count._all})
          </Link>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {listings.map((listing) => (
          <Card
            className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center"
            key={listing.id}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-black hover:text-kondo-green"
                  href={`/admin/housing/${listing.id}`}
                >
                  {listing.title}
                </Link>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black">
                  {listing.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {listing.publisherOrganization?.publicName ??
                  `${listing.publisherUser?.firstName ?? ""} ${listing.publisherUser?.lastName ?? ""}`.trim()}{" "}
                · {listing.city.name} · {listing._count.media} media ·{" "}
                {listing._count.inquiries} inquiries
              </p>
            </div>
            <HousingAdminActions
              listingId={listing.id}
              status={listing.status}
            />
          </Card>
        ))}
      </div>
    </section>
  );
}
