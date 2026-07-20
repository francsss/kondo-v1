import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CityHubView } from "@/components/features/explore/CityHubView";
import {
  getExploreCity,
  getExploreCityParams,
} from "@/features/explore/registry";
import { trackEvent } from "@/lib/analytics";
import { resolvePublishedCity } from "@/lib/city-hub";
import { requireUser } from "@/lib/server-auth";

type PageProps = { params: Promise<{ city: string }> };

export function generateStaticParams() {
  return getExploreCityParams();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city =
    (await resolvePublishedCity(citySlug)) ?? getExploreCity(citySlug);
  if (!city) return { title: "Explore your city" };
  return {
    title: `Explore ${city.name}`,
    description: city.summary,
  };
}

export default async function ExploreCityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city =
    (await resolvePublishedCity(citySlug)) ?? getExploreCity(citySlug);
  if (!city) notFound();

  const user = await requireUser();
  await trackEvent({
    name: "EXPLORE_CITY_VIEWED",
    userId: user.id,
    properties: { city: city.slug },
  });

  return <CityHubView city={city} />;
}
