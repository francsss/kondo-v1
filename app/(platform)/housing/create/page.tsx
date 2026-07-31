import type { Metadata } from "next";
import { HousingCreateForm } from "@/components/features/housing/HousingCreateForm";
import { requireUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Create Housing listing" };

export default async function CreateHousingPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const user = await requireUser();
  const requestedOrganizationId = (await searchParams).organizationId;
  const [countries, cities, universities, memberships] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
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
      take: 1000,
    }),
    prisma.organizationMembership.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN", "EDITOR", "MANAGER"] },
        organization: {
          lifecycleStatus: "ACTIVE",
          capabilities: { some: { key: "HOUSING", status: "ENABLED" } },
        },
      },
      select: {
        organization: { select: { id: true, publicName: true } },
      },
    }),
  ]);
  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
        Housing publisher
      </p>
      <h1 className="mt-2 font-display text-3xl font-black sm:text-4xl">
        Create a trusted listing
      </h1>
      <p className="mb-7 mt-3 max-w-2xl leading-7 text-muted-foreground">
        Clear costs, accurate photos and privacy-safe location information help
        students make safer decisions.
      </p>
      <HousingCreateForm
        initialOrganizationId={
          memberships.some(
            ({ organization }) => organization.id === requestedOrganizationId,
          )
            ? requestedOrganizationId
            : undefined
        }
        references={{
          countries,
          cities,
          universities,
          organizations: memberships.map(({ organization }) => ({
            id: organization.id,
            name: organization.publicName,
          })),
        }}
      />
    </main>
  );
}
