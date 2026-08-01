import { notFound } from "next/navigation";
import { CatalogEditor } from "@/components/features/catalog/CatalogEditor";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { getCatalogResourceForEdit } from "@/lib/organization-catalog";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ slug: string; resourceId: string }>;
}) {
  const user = await requireUser();
  const { slug, resourceId } = await params;
  const workspace = await getOrganizationWorkspace(user.id, slug).catch(
    () => null,
  );
  if (!workspace) notFound();
  const membership = {
    role: workspace.membership.storedRole,
    status: workspace.membership.status,
  };
  const [item, cities] = await Promise.all([
    getCatalogResourceForEdit({
      kind: "service",
      userId: user.id,
      organizationId: workspace.organization.id,
      resourceId,
    }),
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);
  return (
    <CatalogEditor
      canPublish={hasOrganizationPermission(
        membership,
        "ORGANIZATION_PUBLISH_SERVICES",
      )}
      cities={cities}
      initial={{
        id: item.id,
        status: item.status,
        version: item.version,
        coverMediaId: item.media.find((media) => media.kind === "COVER")
          ?.mediaId,
        title: item.title,
        shortDescription: item.shortDescription,
        description: item.description,
        category: item.category,
        cityId: item.cityId ?? "",
        priceType: item.priceType,
        price: item.priceMinor === null ? "" : String(item.priceMinor / 100),
        currency: item.currency,
        availabilityLabel: item.availabilityLabel ?? "",
        locationLabel: item.locationLabel ?? "",
        deliveryMode: "deliveryMode" in item ? (item.deliveryMode ?? "") : "",
        contactMethod: item.contactMethod,
        externalUrl: item.externalUrl ?? "",
      }}
      kind="service"
      organization={{
        id: workspace.organization.id,
        slug,
        name: workspace.organization.publicName,
      }}
    />
  );
}
