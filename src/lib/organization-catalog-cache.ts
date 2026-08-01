import { revalidatePath } from "next/cache";
import type { CatalogKind } from "@/lib/organization-catalog-permissions";

export function catalogCacheTags(input: {
  kind: CatalogKind;
  slug: string;
  organizationSlug: string;
  citySlug?: string | null;
}) {
  return [
    `catalog:${input.kind}:${input.slug}`,
    `organization:${input.organizationSlug}:catalog`,
    ...(input.citySlug ? [`city:${input.citySlug}:catalog`] : []),
    "discover:catalog",
  ];
}

export function revalidateCatalogResource(input: {
  kind: CatalogKind;
  slug: string;
  organizationSlug: string;
  citySlug?: string | null;
}) {
  try {
    revalidatePath("/discover");
    revalidatePath("/discover/essentials");
    revalidatePath(
      `/${input.kind === "product" ? "products" : "services"}/${input.slug}`,
    );
    revalidatePath(`/organizations/${input.organizationSlug}`);
    revalidatePath(`/organizations/${input.organizationSlug}/catalog`);
    revalidatePath("/search");
    if (input.citySlug) {
      revalidatePath(`/discover/cities/${input.citySlug}`);
      revalidatePath(`/explore/${input.citySlug}`);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      return;
    }
    throw error;
  }
}
