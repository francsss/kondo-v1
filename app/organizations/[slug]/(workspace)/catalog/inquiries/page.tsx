import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export default async function CatalogInquiriesPage({
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
  await requireOrganizationPermission(
    user.id,
    { id: workspace.organization.id },
    "ORGANIZATION_VIEW_CATALOG_INQUIRIES",
  );
  const [products, services] = await Promise.all([
    prisma.organizationProductInquiry.findMany({
      where: { organizationId: workspace.organization.id },
      select: {
        id: true,
        topic: true,
        status: true,
        createdAt: true,
        conversationId: true,
        product: { select: { title: true } },
        requester: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.organizationServiceInquiry.findMany({
      where: { organizationId: workspace.organization.id },
      select: {
        id: true,
        topic: true,
        status: true,
        createdAt: true,
        conversationId: true,
        service: { select: { title: true } },
        requester: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const rows = [
    ...products.map((row) => ({
      ...row,
      title: row.product.title,
      kind: "Product",
    })),
    ...services.map((row) => ({
      ...row,
      title: row.service.title,
      kind: "Service",
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
        Private workspace
      </p>
      <h2 className="mt-1 text-2xl font-black">Catalog inquiries</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Only authorized organization members can see who asked for help. Saver
        identities are never exposed.
      </p>
      {rows.length ? (
        <ul className="mt-6 grid gap-3">
          {rows.map((row) => (
            <li
              className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
              key={`${row.kind}:${row.id}`}
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-kondo-green">
                  {row.kind} · {row.status}
                </p>
                <h3 className="mt-1 font-black">{row.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.requester.firstName} {row.requester.lastName} ·{" "}
                  {row.topic}
                </p>
              </div>
              {row.conversationId ? (
                <Link
                  className="text-sm font-black text-kondo-green"
                  href={`/messages/${row.conversationId}`}
                >
                  Open conversation →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No catalog inquiries yet.
        </div>
      )}
    </section>
  );
}
