import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ListingForm } from "@/components/features/marketplace/ListingForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { isLegacyHousingMarketplaceCategory } from "@/lib/housing-listings";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Sell an item" };

export default async function NewListingPage() {
  await requireUser();
  const [categories, cities] = await Promise.all([
    prisma.marketplaceCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
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
        <Link href="/marketplace">
          <ChevronLeft className="h-4 w-4" /> Marketplace
        </Link>
      </Button>
      <PageHeader
        description="Add clear photos and accurate details. High-risk payment language is held as a draft for safety review."
        eyebrow="Seller tools"
        title="Sell an item"
      />
      <Card className="mt-7">
        <ListingForm
          categories={categories.filter(
            (category) => !isLegacyHousingMarketplaceCategory(category.slug),
          )}
          cities={cities}
        />
      </Card>
    </div>
  );
}
