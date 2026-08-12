import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { ListingCard } from "@/components/features/marketplace/ListingCard";
import { MarketplaceToolbar } from "@/components/features/marketplace/MarketplaceToolbar";
import { ProductGrid } from "@/components/features/commerce/ProductCard";
import { PeerMarketplaceBoard } from "@/components/features/marketplace/PeerMarketplaceBoard";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabPanelTransition } from "@/components/ui/HorizontalTabs";
import { FoodAndServicesBoard } from "@/components/features/marketplace/FoodAndServicesBoard";
import {
  isRetiredMarketplaceView,
  MARKETPLACE_SECTIONS,
  type MarketplaceSectionKey,
  marketplaceSectionIndex,
  resolveMarketplaceSection,
} from "@/features/marketplace/sections";
import { listPublicCatalog } from "@/lib/organization-catalog";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Marketplace" };

const SECTION_ICONS: Record<MarketplaceSectionKey, typeof LayoutDashboard> = {
  marketplace: LayoutDashboard,
  "food-services": UtensilsCrossed,
  skills: Sparkles,
};

function MarketplaceNavigation({ active }: { active: MarketplaceSectionKey }) {
  const tabs = MARKETPLACE_SECTIONS.map((section) => ({
    value: section.key,
    label: section.label,
    href: section.href,
    icon: SECTION_ICONS[section.key],
  }));
  return (
    <nav
      aria-label="Marketplace sections"
      className="subnav-row mb-7 border-b border-border"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            aria-current={active === tab.value ? "page" : undefined}
            className={
              active === tab.value
                ? "relative inline-flex min-h-14 items-center justify-center gap-2 px-2 text-center text-xs font-black text-kondo-green transition sm:px-5 sm:text-sm after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green"
                : "inline-flex min-h-14 items-center justify-center gap-2 px-2 text-center text-xs font-bold text-muted-foreground transition duration-200 hover:bg-muted/60 hover:text-foreground sm:px-5 sm:text-sm"
            }
            href={tab.href}
            key={tab.value}
            scroll={false}
          >
            <Icon className="hidden h-4 w-4 sm:block" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function href(input: Record<string, string | undefined>, page?: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/marketplace?${query}` : "/marketplace";
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  // Community Exchange left the visible product experience. Its records and
  // services are untouched; the old link resolves to the Marketplace root
  // instead of showing a section that no longer exists.
  if (isRetiredMarketplaceView(params.view)) redirect("/marketplace");
  const view = resolveMarketplaceSection(params.view);

  if (view === "food-services") {
    const [products, services] = await Promise.all([
      listPublicCatalog({
        kind: "product",
        query: params.q,
        cityId: params.cityId,
        limit: 30,
      }),
      listPublicCatalog({
        kind: "service",
        query: params.q,
        cityId: params.cityId,
        limit: 30,
      }),
    ]);
    return (
      <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
        <MarketplaceNavigation active={view} />
        <TabPanelTransition index={marketplaceSectionIndex(view)}>
          <FoodAndServicesBoard products={products} services={services} />
        </TabPanelTransition>
      </div>
    );
  }

  if (view === "skills") {
    const [cities, skillOffers] = await Promise.all([
      prisma.city.findMany({
        where: { isActive: true, country: { code: "CN" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.studentSkillOffer.findMany({
        where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          availability: true,
          createdAt: true,
          city: { select: { name: true } },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              university: { select: { name: true, shortName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
    ]);
    return (
      <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
        <MarketplaceNavigation active={view} />
        <TabPanelTransition index={marketplaceSectionIndex(view)}>
          <PeerMarketplaceBoard
            cities={cities}
            currentUserId={user.id}
            skillOffers={skillOffers.map((offer) => ({
              ...offer,
              createdAt: offer.createdAt.toISOString(),
            }))}
          />
        </TabPanelTransition>
      </div>
    );
  }
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 16;
  const min = Number(params.min);
  const max = Number(params.max);
  const where = {
    status: "ACTIVE" as const,
    expiresAt: { gt: new Date() },
    category: {
      isActive: true,
      ...(params.category ? { slug: params.category } : {}),
    },
    city: params.city ? { slug: params.city } : undefined,
    priceFen: {
      gte: Number.isFinite(min) && min >= 0 ? Math.round(min * 100) : undefined,
      lte: Number.isFinite(max) && max >= 0 ? Math.round(max * 100) : undefined,
    },
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            {
              description: { contains: params.q, mode: "insensitive" as const },
            },
          ],
        }
      : {}),
  };
  const orderBy =
    params.sort === "price-asc"
      ? ({ priceFen: "asc" } as const)
      : params.sort === "price-desc"
        ? ({ priceFen: "desc" } as const)
        : params.sort === "oldest"
          ? ({ publishedAt: "asc" } as const)
          : ({ publishedAt: "desc" } as const);
  const [categories, cities, total, listings] = await Promise.all([
    prisma.marketplaceCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            listings: {
              where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.city.findMany({
      where: {
        isActive: true,
        listings: { some: { status: "ACTIVE" } },
      },
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.marketplaceListing.count({ where }),
    prisma.marketplaceListing.findMany({
      where,
      include: {
        images: {
          where: { mediaId: { not: null } },
          orderBy: { order: "asc" },
          take: 1,
          select: { mediaId: true, altText: true },
        },
        category: { select: { name: true, icon: true } },
        city: { select: { name: true } },
        seller: { select: { firstName: true, lastName: true } },
        favorites: { where: { userId: user.id }, select: { id: true } },
        _count: { select: { favorites: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hrefInput = {
    q: params.q,
    category: params.category,
    city: params.city,
    min: params.min,
    max: params.max,
    sort: params.sort,
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <MarketplaceNavigation active="marketplace" />
      <TabPanelTransition index={0}>
        <PageHeader
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/marketplace/selling">
                  <LayoutDashboard className="h-4 w-4" /> Selling
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/marketplace/new">
                  <Plus className="h-4 w-4" /> Sell an item
                </Link>
              </Button>
            </div>
          }
          title="Marketplace"
        />

        <MarketplaceToolbar
          categories={categories.map((category) => ({
            id: category.id,
            slug: category.slug,
            name: category.name,
            icon: category.icon,
            count: category._count.listings,
          }))}
          cities={cities}
          query={{
            q: params.q,
            category: params.category,
            city: params.city,
            min: params.min,
            max: params.max,
            sort: params.sort,
          }}
          resultCount={total}
        />

        <ProductGrid className="mt-3">
          {listings.map((listing, index) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              priority={index < 4}
            />
          ))}
        </ProductGrid>
        {!listings.length ? (
          <div className="mt-8 text-center">
            <p className="text-sm font-bold text-foreground">
              No items match these filters.
            </p>
            <Link
              className="mt-3 inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-bold text-foreground transition hover:border-kondo-green/40"
              href="/marketplace"
            >
              Clear filters
            </Link>
          </div>
        ) : null}
        <div className="mt-7 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pageCount} · {total} listings
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={href(hrefInput, Math.max(1, page - 1))}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={href(hrefInput, Math.min(pageCount, page + 1))}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </TabPanelTransition>
    </div>
  );
}
