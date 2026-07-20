import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ListingForm } from "@/components/features/marketplace/ListingForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const listing = await prisma.marketplaceListing.findFirst({
    where: {
      slug: (await params).slug,
      sellerId: user.id,
      status: { not: "REMOVED" },
    },
    select: {
      id: true,
      slug: true,
      categoryId: true,
      cityId: true,
      title: true,
      description: true,
      priceFen: true,
      isNegotiable: true,
      _count: { select: { images: true } },
    },
  });
  if (!listing) notFound();
  const [categories, cities] = await Promise.all([
    prisma.marketplaceCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-7 sm:px-6 lg:pb-16 lg:pt-10">
      <Button asChild className="mb-5" size="sm" variant="ghost">
        <Link href="/marketplace/selling">
          <ChevronLeft className="h-4 w-4" /> Seller dashboard
        </Link>
      </Button>
      <PageHeader
        description="Update accurate item details or replace all listing images."
        eyebrow="Seller tools"
        title={`Edit ${listing.title}`}
      />
      <Card className="mt-7">
        <ListingForm
          categories={categories}
          cities={cities}
          listing={{ ...listing, imageCount: listing._count.images }}
        />
      </Card>
    </div>
  );
}
