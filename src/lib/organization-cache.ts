import { revalidatePath } from "next/cache";

export function revalidateOrganizationPublicSurfaces(input: {
  slug: string;
  previousSlug?: string | null;
  citySlug?: string | null;
  previousCitySlug?: string | null;
}) {
  try {
    revalidatePath("/organizations");
    revalidatePath(`/organizations/${input.slug}`);
    revalidatePath(`/api/organizations/public/${input.slug}`);
    revalidatePath("/search");
    revalidatePath("/sitemap.xml");
    if (input.previousSlug && input.previousSlug !== input.slug) {
      revalidatePath(`/organizations/${input.previousSlug}`);
      revalidatePath(`/api/organizations/public/${input.previousSlug}`);
    }
    if (input.citySlug) {
      revalidatePath(`/explore/${input.citySlug}`);
    }
    if (input.previousCitySlug && input.previousCitySlug !== input.citySlug) {
      revalidatePath(`/explore/${input.previousCitySlug}`);
    }
  } catch (error) {
    // Domain services are also used by migrations, workers, scripts and
    // integration tests, where Next.js intentionally has no request cache.
    // Revalidation remains active in route/server-action contexts; only the
    // documented missing-store condition is ignored outside those contexts.
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      return;
    }
    throw error;
  }
}
