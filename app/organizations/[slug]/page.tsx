import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { OrganizationPublicChrome } from "@/components/organizations/OrganizationPublicChrome";
import { OrganizationPublicPage } from "@/components/organizations/OrganizationPublicPage";
import { getOrganizationPublicProfile } from "@/lib/organization-public-profile";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const result = await getOrganizationPublicProfile(slug);
  if (!result) {
    return {
      title: "Organization not found",
      robots: { index: false, follow: false },
    };
  }
  const organization = result.profile;
  const description =
    organization.shortDescription ||
    organization.tagline ||
    `Discover ${organization.publicName} on Kondo.`;
  return {
    title: organization.publicName,
    description,
    alternates: {
      canonical: `/organizations/${organization.slug}`,
    },
    openGraph: {
      type: "website",
      title: organization.publicName,
      description,
      url: `/organizations/${organization.slug}`,
      images: organization.cover
        ? [{ url: organization.cover.url, alt: organization.cover.altText }]
        : organization.logo
          ? [{ url: organization.logo.url, alt: organization.logo.altText }]
          : ["/og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: organization.publicName,
      description,
      images: organization.cover?.url || organization.logo?.url || "/og.png",
    },
  };
}

export default async function OrganizationPublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const result = await getOrganizationPublicProfile((await params).slug);
  if (!result) notFound();
  if (result.redirectSlug) {
    permanentRedirect(`/organizations/${result.redirectSlug}`);
  }
  const requestedSection = (await searchParams).section;
  const activeSection =
    result.profile.visibleSections.find(
      (section) => section.key === requestedSection,
    )?.key ?? result.profile.visibleSections[0]?.key;
  return (
    <>
      <OrganizationPublicChrome
        backHref="/organizations"
        backLabel="Back"
        organization={{
          name: result.profile.publicName,
          logoUrl: result.profile.logo?.url ?? null,
          verified: result.profile.trust.verification.state === "VERIFIED",
          type: result.profile.organizationType,
        }}
      />
      <OrganizationPublicPage
        activeSection={activeSection}
        organization={result.profile}
      />
    </>
  );
}
