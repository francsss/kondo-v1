import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CitySectionView } from "@/components/features/explore/CitySectionView";
import {
  getExploreCity,
  getExploreSection,
  getExploreSectionParams,
} from "@/features/explore/registry";
import { resolvePublishedCity } from "@/lib/city-hub";

type PageProps = {
  params: Promise<{ city: string; section: string }>;
};

export function generateStaticParams() {
  return getExploreSectionParams();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: citySlug, section: sectionSlug } = await params;
  const city =
    (await resolvePublishedCity(citySlug)) ?? getExploreCity(citySlug);
  const section = city ? getExploreSection(city, sectionSlug) : undefined;
  if (!city || !section) return { title: "Explore your city" };
  return {
    title: `${section.title} in ${city.name}`,
    description: section.summary,
  };
}

export default async function ExploreCitySectionPage({ params }: PageProps) {
  const { city: citySlug, section: sectionSlug } = await params;
  const city =
    (await resolvePublishedCity(citySlug)) ?? getExploreCity(citySlug);
  const section = city ? getExploreSection(city, sectionSlug) : undefined;
  if (!city || !section) notFound();

  return <CitySectionView city={city} section={section} />;
}
