import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Manage Housing" };

export default async function ManageHousingPage() {
  const user = await requireUser();
  const editableMemberships = await prisma.organizationMembership.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "EDITOR", "MANAGER"] },
      organization: {
        lifecycleStatus: "ACTIVE",
        capabilities: { some: { key: "HOUSING", status: "ENABLED" } },
      },
    },
    select: { organizationId: true },
  });
  const listings = await prisma.housingListing.findMany({
    where: {
      OR: [
        { publisherUserId: user.id },
        {
          publisherOrganizationId: {
            in: editableMemberships.map(({ organizationId }) => organizationId),
          },
        },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      monthlyRentMinor: true,
      currency: true,
      updatedAt: true,
      city: { select: { name: true } },
      _count: { select: { media: true, inquiries: true, savedBy: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Publisher workspace
          </p>
          <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
            Manage Housing
          </h1>
        </div>
        <Button asChild>
          <Link href="/housing/create">
            <Plus aria-hidden className="h-4 w-4" /> New listing
          </Link>
        </Button>
      </div>
      {listings.length ? (
        <div className="mt-7 space-y-3">
          {listings.map((listing) => (
            <Link
              className="grid gap-4 rounded-3xl border border-border bg-card p-5 transition hover:border-foreground/20 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center"
              href={`/housing/manage/${listing.id}`}
              key={listing.id}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-black">
                    {listing.title}
                  </h2>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black">
                    {listing.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {listing.city.name} · {listing._count.media} media ·{" "}
                  {listing._count.inquiries} inquiries ·{" "}
                  {listing._count.savedBy} saves
                </p>
              </div>
              <p className="text-sm font-black text-kondo-green">
                {listing.currency} {Math.round(listing.monthlyRentMinor / 100)}
                /month
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="mt-7 py-14 text-center">
          <Building2 className="mx-auto h-9 w-9 text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl font-black">
            No Housing listings yet
          </h2>
        </Card>
      )}
    </main>
  );
}
