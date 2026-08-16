import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityEditor } from "@/components/features/opportunities/OpportunityEditor";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Create opportunity",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function NewOrganizationOpportunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const organization = await prisma.organization.findFirst({
    where: {
      slug: (await params).slug,
      memberships: { some: { userId: user.id, status: "ACTIVE" } },
    },
    select: {
      id: true,
      slug: true,
      publicName: true,
      // The activity areas this organization has turned on. Without them the
      // editor offered every opportunity type and the server rejected the
      // ones the organization had not enabled, after the publisher had
      // already written the whole thing.
      capabilities: {
        where: { status: "ENABLED" },
        select: { key: true },
      },
      memberships: {
        where: { userId: user.id, status: "ACTIVE" },
        select: { role: true, status: true },
        take: 1,
      },
    },
  });
  if (!organization) notFound();
  if (
    !organization.memberships[0] ||
    !hasOrganizationPermission(
      organization.memberships[0],
      "ORGANIZATION_CREATE_OPPORTUNITIES",
    )
  ) {
    notFound();
  }
  const [countries, cities, universities] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 250,
    }),
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, countryId: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, cityId: true },
      orderBy: { name: "asc" },
      take: 600,
    }),
  ]);

  return (
    <OpportunityEditor
      cities={cities}
      countries={countries}
      enabledCapabilities={organization.capabilities.map(({ key }) => key)}
      organization={{
        id: organization.id,
        slug: organization.slug,
        name: organization.publicName,
      }}
      universities={universities}
    />
  );
}
