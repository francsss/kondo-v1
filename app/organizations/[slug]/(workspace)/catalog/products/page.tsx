import type { Metadata } from "next";
import { OrganizationCatalogKindWorkspace } from "@/components/features/catalog/OrganizationCatalogKindWorkspace";

export const metadata: Metadata = { title: "Organization products" };
export const dynamic = "force-dynamic";

export default function OrganizationProductsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return OrganizationCatalogKindWorkspace({ params, kind: "product" });
}
