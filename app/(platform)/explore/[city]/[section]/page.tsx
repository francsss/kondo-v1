import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CitySectionView } from "@/components/features/explore/CitySectionView";
import {
  getExploreCity,
  getExploreSection,
  getExploreSectionParams,
} from "@/features/explore/registry";
import { resolvePublishedCity } from "@/lib/city-hub";
import { requireUser } from "@/lib/server-auth";
import { getContextualStories } from "@/lib/stories";

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
  const resolved = await resolvePublishedCity(citySlug);
  const city = resolved === undefined ? getExploreCity(citySlug) : resolved;
  const section = city ? getExploreSection(city, sectionSlug) : undefined;
  if (!city || !section) return { title: "Explore your city" };
  return {
    title: `${section.title} in ${city.name}`,
    description: section.summary,
  };
}

export default async function ExploreCitySectionPage({ params }: PageProps) {
  const { city: citySlug, section: sectionSlug } = await params;
  const resolved = await resolvePublishedCity(citySlug);
  const city = resolved === undefined ? getExploreCity(citySlug) : resolved;
  const section = city ? getExploreSection(city, sectionSlug) : undefined;
  if (!city || !section) notFound();

  const entityType = {
    companies: "COMPANY",
    jobs: "INTERNSHIP",
    events: "EVENT",
    universities: "UNIVERSITY",
  }[section.slug] as
    "COMPANY" | "INTERNSHIP" | "EVENT" | "UNIVERSITY" | undefined;
  const user = await requireUser();
  const preciseStories = await getContextualStories(user, {
    citySlug: city.slug,
    entityType,
    limit: 6,
  });
  const stories =
    preciseStories.length || !entityType
      ? preciseStories
      : await getContextualStories(user, {
          citySlug: city.slug,
          limit: 6,
        });

  return <CitySectionView city={city} section={section} stories={stories} />;
}
