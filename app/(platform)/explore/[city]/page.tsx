import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CityHubView } from "@/components/features/explore/CityHubView";
import {
  getExploreCity,
  getExploreCityParams,
} from "@/features/explore/registry";
import { trackEvent } from "@/lib/analytics";
import { resolvePublishedCity } from "@/lib/city-hub";
import { listPublicOrganizationsForCity } from "@/lib/organization-public-profile";
import { getCityHousingProjection } from "@/lib/housing-projections";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { getContextualStories } from "@/lib/stories";

type PageProps = { params: Promise<{ city: string }> };

export function generateStaticParams() {
  return getExploreCityParams();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const resolved = await resolvePublishedCity(citySlug);
  const city = resolved === undefined ? getExploreCity(citySlug) : resolved;
  if (!city) return { title: "Explore your city" };
  return {
    title: `Explore ${city.name}`,
    description: city.summary,
  };
}

export default async function ExploreCityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const resolved = await resolvePublishedCity(citySlug);
  const city = resolved === undefined ? getExploreCity(citySlug) : resolved;
  if (!city) notFound();

  const user = await requireUser();
  await trackEvent({
    name: "EXPLORE_CITY_VIEWED",
    userId: user.id,
    properties: { city: city.slug },
  });

  const [stories, cityRecord] = await Promise.all([
    getContextualStories(user, {
      citySlug: city.slug,
      limit: 6,
    }),
    prisma.city.findUnique({
      where: { slug: city.slug },
      select: { id: true },
    }),
  ]);
  const [organizations, housing] = cityRecord
    ? await Promise.all([
        listPublicOrganizationsForCity(cityRecord.id, 6),
        getCityHousingProjection(cityRecord.id, 6),
      ])
    : [[], []];

  return (
    <CityHubView
      city={city}
      housing={housing}
      organizations={organizations}
      stories={stories}
    />
  );
}
