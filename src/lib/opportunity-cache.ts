import { revalidatePath } from "next/cache";

function revalidateOpportunityPath(path: string) {
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

/**
 * Public opportunity surfaces are cacheable; application surfaces are not and
 * are never revalidated here because they are always rendered dynamically for
 * one authenticated user.
 */
export function revalidateOpportunity(input: {
  opportunityId?: string | null;
  slug?: string | null;
  organizationSlug?: string | null;
  citySlug?: string | null;
}) {
  revalidateOpportunityPath("/opportunities");
  revalidateOpportunityPath("/opportunities/scholarships");
  revalidateOpportunityPath("/opportunities/internships");
  revalidateOpportunityPath("/opportunities/jobs");
  revalidateOpportunityPath("/opportunities/programs");
  revalidateOpportunityPath("/opportunities/saved");
  revalidateOpportunityPath("/student-hub");
  revalidateOpportunityPath("/search");
  revalidateOpportunityPath("/sitemap.xml");
  if (input.slug) {
    revalidateOpportunityPath(`/opportunities/${input.slug}`);
  }
  if (input.organizationSlug) {
    revalidateOpportunityPath(`/organizations/${input.organizationSlug}`);
    revalidateOpportunityPath(
      `/organizations/${input.organizationSlug}/opportunities`,
    );
  }
  if (input.citySlug) revalidateOpportunityPath(`/explore/${input.citySlug}`);
}
