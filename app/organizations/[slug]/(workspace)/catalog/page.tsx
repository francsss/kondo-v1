import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  MessageCircle,
  Package,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { listOrganizationCatalog } from "@/lib/organization-catalog";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Products & services" };
export const dynamic = "force-dynamic";

export default async function OrganizationCatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const workspace = await getOrganizationWorkspace(user.id, slug).catch(
    () => null,
  );
  if (!workspace) notFound();
  const membership = {
    role: workspace.membership.storedRole,
    status: workspace.membership.status,
  };
  const enabled = new Set(
    workspace.organization.capabilities
      .filter((capability) => capability.status === "ENABLED")
      .map((capability) => capability.key),
  );
  const canProducts =
    enabled.has("PRODUCTS") &&
    hasOrganizationPermission(membership, "ORGANIZATION_CREATE_PRODUCTS");
  const canServices =
    enabled.has("STUDENT_SERVICES") &&
    hasOrganizationPermission(membership, "ORGANIZATION_CREATE_SERVICES");
  const [products, services] = await Promise.all([
    enabled.has("PRODUCTS")
      ? listOrganizationCatalog({
          kind: "product",
          userId: user.id,
          organizationId: workspace.organization.id,
        })
      : [],
    enabled.has("STUDENT_SERVICES")
      ? listOrganizationCatalog({
          kind: "service",
          userId: user.id,
          organizationId: workspace.organization.id,
        })
      : [],
  ]);
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Professional catalog
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">
            Products & services
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Professional resources from {workspace.organization.publicName}.
            This catalog remains separate from the peer-to-peer Marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasOrganizationPermission(
            membership,
            "ORGANIZATION_VIEW_CATALOG_INQUIRIES",
          ) ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/organizations/${slug}/catalog/inquiries`}>
                <MessageCircle className="h-4 w-4" /> Inquiries
              </Link>
            </Button>
          ) : null}
          {canProducts ? (
            <Button asChild size="sm">
              <Link href={`/organizations/${slug}/catalog/products/new`}>
                <Plus className="h-4 w-4" /> Product
              </Link>
            </Button>
          ) : null}
          {canServices ? (
            <Button asChild size="sm">
              <Link href={`/organizations/${slug}/catalog/services/new`}>
                <Plus className="h-4 w-4" /> Service
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {!enabled.has("PRODUCTS") && !enabled.has("STUDENT_SERVICES") ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-8 text-center">
          <h3 className="font-black">Catalog capability is not enabled</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            An organization owner or administrator can enable Products or
            Student services in Settings. A capability never grants publishing
            permission by itself.
          </p>
          {hasOrganizationPermission(
            membership,
            "ORGANIZATION_MANAGE_CAPABILITIES",
          ) ? (
            <Button asChild className="mt-5" variant="secondary">
              <Link href={`/organizations/${slug}/settings`}>
                Configure activity areas
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <CatalogGroup icon={Package} kind="product" rows={products} slug={slug} />
      <CatalogGroup
        icon={Sparkles}
        kind="service"
        rows={services}
        slug={slug}
      />
    </section>
  );
}

function CatalogGroup({
  icon: Icon,
  kind,
  rows,
  slug,
}: {
  icon: typeof Package;
  kind: "product" | "service";
  rows: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    priceLabel: string;
    updatedAt: Date;
    _count: { inquiries: number };
  }>;
  slug: string;
}) {
  if (!rows.length) return null;
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-kondo-green" />
        <h3 className="text-lg font-black capitalize">{kind}s</h3>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <li
            className="rounded-3xl border border-border bg-card p-5"
            key={row.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-kondo-green">
                  {row.category}
                </p>
                <h4 className="mt-1 line-clamp-2 font-black">{row.title}</h4>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-black">
                {row.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-sm font-bold">{row.priceLabel}</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>{row._count.inquiries} inquiries</span>
              <Link
                className="inline-flex items-center gap-1 font-black text-kondo-green"
                href={`/organizations/${slug}/catalog/${kind}s/${row.id}`}
              >
                Manage <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
