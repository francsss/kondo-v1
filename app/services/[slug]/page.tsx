import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogDetail } from "@/components/features/catalog/CatalogDetail";
import { getPublicCatalogResource } from "@/lib/organization-catalog";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { getCurrentUser } from "@/lib/server-auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const item = await getPublicCatalogResource("service", (await params).slug);
  return item
    ? { title: item.title, description: item.shortDescription }
    : { title: "Service not found", robots: { index: false } };
}
export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const item = await getPublicCatalogResource("service", (await params).slug);
  if (!item) notFound();
  const user = await getCurrentUser();
  if (user) {
    await captureServerProductEvent({
      distinctId: user.id,
      event: PRODUCT_EVENTS.ORGANIZATION_SERVICE_VIEWED,
      properties: {
        category: item.category,
        organization_id: item.organization.id,
      },
    });
  }
  return <CatalogDetail item={item} />;
}
