import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { CatalogAdminActions } from "@/components/features/admin/CatalogAdminActions";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Organization catalog — Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "OUT_OF_STOCK",
  "UNAVAILABLE",
  "REJECTED",
  "REMOVED",
  "ARCHIVED",
] as const;
const PRODUCT_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "OUT_OF_STOCK",
  "REJECTED",
  "REMOVED",
  "ARCHIVED",
] as const;
const SERVICE_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "UNAVAILABLE",
  "REJECTED",
  "REMOVED",
  "ARCHIVED",
] as const;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("ORGANIZATION_CATALOG_VIEW");
  const params = await searchParams;
  const kind = param(params.kind) === "services" ? "services" : "products";
  const rawStatus = param(params.status);
  const status = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? rawStatus
    : undefined;
  const query = param(params.q)?.trim().slice(0, 120) || undefined;
  const searchWhere = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            {
              organization: {
                publicName: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };
  const productWhere: Prisma.OrganizationProductWhereInput = {
    ...searchWhere,
    ...(PRODUCT_STATUSES.includes(status as (typeof PRODUCT_STATUSES)[number])
      ? { status: status as (typeof PRODUCT_STATUSES)[number] }
      : {}),
  };
  const serviceWhere: Prisma.OrganizationServiceWhereInput = {
    ...searchWhere,
    ...(SERVICE_STATUSES.includes(status as (typeof SERVICE_STATUSES)[number])
      ? { status: status as (typeof SERVICE_STATUSES)[number] }
      : {}),
  };
  const items =
    kind === "products"
      ? await prisma.organizationProduct.findMany({
          where: productWhere,
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            status: true,
            externalUrl: true,
            externalUrlBlockedAt: true,
            createdAt: true,
            organization: { select: { publicName: true, slug: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
        })
      : await prisma.organizationService.findMany({
          where: serviceWhere,
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            status: true,
            externalUrl: true,
            externalUrlBlockedAt: true,
            createdAt: true,
            organization: { select: { publicName: true, slug: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
        });

  return (
    <section className="mx-auto max-w-[1200px]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
        Professional supply
      </p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">
        Organization catalog
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Review real organization products and services. Marketplace remains a
        separate peer-to-peer domain.
      </p>
      <form className="mt-6 grid gap-3 rounded-3xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
        <input
          className="h-11 rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green"
          defaultValue={query}
          name="q"
          placeholder="Search title or organization"
        />
        <select
          className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
          defaultValue={kind}
          name="kind"
        >
          <option value="products">Products</option>
          <option value="services">Services</option>
        </select>
        <select
          className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
          defaultValue={status ?? ""}
          name="status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </form>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <Card
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={item.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="truncate font-black hover:text-kondo-green"
                  href={`/${kind}/${item.slug}`}
                >
                  {item.title}
                </Link>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black">
                  {item.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.organization.publicName} · {item.category} · created{" "}
                {item.createdAt.toLocaleDateString("en-GB")}
              </p>
            </div>
            <CatalogAdminActions
              externalUrlAvailable={Boolean(
                item.externalUrl && !item.externalUrlBlockedAt,
              )}
              kind={kind}
              resourceId={item.id}
              status={item.status}
            />
          </Card>
        ))}
        {!items.length ? (
          <Card className="py-14 text-center text-sm text-muted-foreground">
            No catalog item matches this view.
          </Card>
        ) : null}
      </div>
    </section>
  );
}
