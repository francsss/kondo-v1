import { revalidatePath } from "next/cache";

function revalidateHousingPath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    // Domain services also run from maintenance scripts and database-backed
    // tests, where Next has no request/static-generation store. The mutation
    // must still complete; request handlers retain normal cache invalidation.
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      return;
    }
    throw error;
  }
}

export function revalidateHousing(input: {
  listingId?: string | null;
  organizationSlug?: string | null;
  citySlug?: string | null;
}) {
  revalidateHousingPath("/housing");
  revalidateHousingPath("/housing/search");
  revalidateHousingPath("/housing/map");
  revalidateHousingPath("/housing/manage");
  revalidateHousingPath("/housing/saved");
  revalidateHousingPath("/discover");
  revalidateHousingPath("/discover/essentials");
  revalidateHousingPath("/search");
  revalidateHousingPath("/sitemap.xml");
  if (input.listingId) {
    revalidateHousingPath(`/housing/listings/${input.listingId}`);
    revalidateHousingPath(`/housing/manage/${input.listingId}`);
  }
  if (input.organizationSlug) {
    revalidateHousingPath(`/organizations/${input.organizationSlug}`);
    revalidateHousingPath(`/organizations/${input.organizationSlug}/housing`);
  }
  if (input.citySlug) {
    revalidateHousingPath(`/explore/${input.citySlug}`);
    revalidateHousingPath(`/discover/cities/${input.citySlug}`);
  }
}
