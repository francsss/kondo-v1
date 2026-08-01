import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { revalidateHousing } from "@/lib/housing-cache";
import { revalidateOpportunity } from "@/lib/opportunity-cache";
import { revalidateOrganizationPublicSurfaces } from "@/lib/organization-cache";

describe("public projection invalidation", () => {
  beforeEach(() => mocks.revalidatePath.mockClear());

  it("invalidates organization directory, Discover and the affected City Hub", () => {
    revalidateOrganizationPublicSurfaces({
      slug: "safe-org",
      citySlug: "jiaxing",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizations");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/discover");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/discover/cities/jiaxing",
    );
  });

  it("invalidates Housing projections without exposing a private location", () => {
    revalidateHousing({ listingId: "listing-1", citySlug: "hangzhou" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/discover");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/discover/cities/hangzhou",
    );
    expect(JSON.stringify(mocks.revalidatePath.mock.calls)).not.toContain(
      "privateAddress",
    );
  });

  it("invalidates every Student Hub category and Discover for an opportunity", () => {
    revalidateOpportunity({ slug: "real-opportunity", citySlug: "shanghai" });
    for (const route of [
      "/student-hub/scholarships",
      "/student-hub/internships",
      "/student-hub/jobs",
      "/student-hub/programs",
      "/discover",
      "/discover/cities/shanghai",
    ]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(route);
    }
  });
});
