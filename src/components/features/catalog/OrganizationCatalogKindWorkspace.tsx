import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Package, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { listOrganizationCatalog } from "@/lib/organization-catalog";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export async function OrganizationCatalogKindWorkspace({
  params,
  kind,
}: {
  params: Promise<{ slug: string }>;
  kind: "product" | "service";
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
  const capability = kind === "product" ? "PRODUCTS" : "STUDENT_SERVICES";
  const enabled = workspace.organization.capabilities.some(
    (item) => item.key === capability && item.status === "ENABLED",
  );
  const createPermission =
    kind === "product"
      ? "ORGANIZATION_CREATE_PRODUCTS"
      : "ORGANIZATION_CREATE_SERVICES";
  const canCreate =
    enabled && hasOrganizationPermission(membership, createPermission);
  const rows = enabled
    ? await listOrganizationCatalog({
        kind,
        userId: user.id,
        organizationId: workspace.organization.id,
      })
    : [];
  const plural = kind === "product" ? "Products" : "Services";
  const Icon = kind === "product" ? Package : Sparkles;
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Professional catalog
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">{plural}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage published {plural.toLowerCase()} from{" "}
            {workspace.organization.publicName}. This catalog remains separate
            from the peer-to-peer Marketplace.
          </p>
        </div>
        {canCreate ? (
          <Button asChild size="sm">
            <Link
              href={`/organizations/${slug}/catalog/${plural.toLowerCase()}/new`}
            >
              <Plus className="h-4 w-4" /> New {kind}
            </Link>
          </Button>
        ) : null}
      </div>

      {!enabled ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-8 text-center">
          <h3 className="font-black">{plural} capability is not enabled</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            An organization owner or administrator can enable this activity in
            Settings. A capability never grants publishing permission by itself.
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
      ) : rows.length ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li
              className="rounded-3xl border border-border bg-card p-5"
              key={row.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-kondo-green">
                    <Icon className="h-3.5 w-3.5" /> {row.category}
                  </p>
                  <h3 className="mt-1 line-clamp-2 font-black">{row.title}</h3>
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
                  href={`/organizations/${slug}/catalog/${plural.toLowerCase()}/${row.id}`}
                >
                  Manage <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
          <Icon className="mx-auto h-7 w-7 text-muted-foreground" />
          <h3 className="mt-3 font-black">No {plural.toLowerCase()} yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a draft when you have a real offering to publish.
          </p>
        </div>
      )}
    </section>
  );
}
