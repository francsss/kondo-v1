import { notFound } from "next/navigation";
import { CatalogEditor } from "@/components/features/catalog/CatalogEditor";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export default async function NewProductPage({
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
  if (!hasOrganizationPermission(membership, "ORGANIZATION_CREATE_PRODUCTS"))
    notFound();
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return (
    <CatalogEditor
      canPublish={hasOrganizationPermission(
        membership,
        "ORGANIZATION_PUBLISH_PRODUCTS",
      )}
      cities={cities}
      kind="product"
      organization={{
        id: workspace.organization.id,
        slug,
        name: workspace.organization.publicName,
      }}
    />
  );
}
