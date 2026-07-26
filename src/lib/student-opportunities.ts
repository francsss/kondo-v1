import type { ExploreCity, ExploreEntry } from "@/features/explore/types";
import { listExploreCities } from "@/features/explore/registry";
import { prisma } from "@/lib/prisma";
import { exploreCityPayloadSchema } from "@/lib/validation";

export type StudentOpportunity = ExploreEntry & {
  cityName: string;
  citySlug: string;
};

export async function getStudentOpportunities() {
  const managed = await prisma.cityHub.findMany({
    where: { published: { not: Prisma.DbNull } },
    select: { slug: true, published: true },
  });
  const managedBySlug = new Map(
    managed.map((hub) => {
      const parsed = exploreCityPayloadSchema.safeParse(hub.published);
      return [hub.slug, parsed.success ? (parsed.data as ExploreCity) : null];
    }),
  );
  const staticCities = listExploreCities().filter(
    (city) => !managedBySlug.has(city.slug),
  );
  const cities = [
    ...staticCities,
    ...[...managedBySlug.values()].filter(
      (city): city is ExploreCity => city !== null,
    ),
  ];

  return cities.flatMap((city) => {
    const jobs = city.sections.find((section) => section.slug === "jobs");
    return (jobs?.entries ?? [])
      .filter((entry) => entry.type === "opportunity")
      .map((entry) => ({
        ...entry,
        cityName: city.name,
        citySlug: city.slug,
      }));
  });
}
import { Prisma } from "@prisma/client";
