import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { ListingCard } from "@/components/features/marketplace/ListingCard";
import { MarketplaceFilterBar } from "@/components/features/marketplace/MarketplaceFilterBar";
import { PeerMarketplaceBoard } from "@/components/features/marketplace/PeerMarketplaceBoard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
      <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
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
      <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
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
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <MarketplaceNavigation active="marketplace" />
      <TabPanelTransition index={0}>
        <PageHeader
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/marketplace/selling">
                  <LayoutDashboard className="h-4 w-4" /> Seller dashboard
                </Link>
              </Button>
              <Button asChild>
                <Link href="/marketplace/new">
                  <Plus className="h-4 w-4" /> Sell an item
                </Link>
              </Button>
            </div>
          }
          description="Buy from students nearby, sell what you no longer need, and keep good things in the community. No in-app payments."
          eyebrow="Student to student"
          title="Marketplace"
        />

        <MarketplaceFilterBar
          cities={cities}
          values={{
            q: params.q,
            city: params.city,
            min: params.min,
            max: params.max,
            sort: params.sort,
            category: params.category,
          }}
        />

        <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          <Link
            className={
              !params.category
                ? "grid min-h-24 place-items-center rounded-3xl bg-kondo-ink p-3 text-center text-white dark:bg-emerald-400 dark:text-kondo-ink"
                : "grid min-h-24 place-items-center rounded-3xl border border-slate-200 bg-white p-3 text-center transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/5"
            }
            href={href({ ...hrefInput, category: undefined })}
          >
            <span className="text-2xl">✨</span>
            <span className="mt-2 text-xs font-black">All</span>
          </Link>
          {categories.map((category) => (
            <Link
              className={
                params.category === category.slug
                  ? "grid min-h-24 place-items-center rounded-3xl bg-kondo-ink p-3 text-center text-white dark:bg-emerald-400 dark:text-kondo-ink"
                  : "grid min-h-24 place-items-center rounded-3xl border border-slate-200 bg-white p-3 text-center transition hover:-translate-y-1 hover:border-kondo-green dark:border-white/10 dark:bg-white/5"
              }
              href={href({ ...hrefInput, category: category.slug })}
              key={category.id}
            >
              <span className="text-2xl">{category.icon}</span>
              <span className="mt-2 text-xs font-black">{category.name}</span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">
                {category._count.listings}
              </span>
            </Link>
          ))}
        </section>

        <div className="mt-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-kondo-ink dark:text-white">
              Available nearby
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {total} active listings
            </p>
          </div>
          <div className="hidden items-center gap-1.5 text-xs font-bold text-kondo-green sm:flex">
            <ShieldCheck className="h-4 w-4" /> No deposits or in-app payments
          </div>
        </div>
        <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </section>
        {!listings.length ? (
          <Card className="mt-5 py-16 text-center text-sm text-muted-foreground">
            No active listings match these filters.
          </Card>
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
