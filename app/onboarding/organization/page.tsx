import { KondoLogo } from "@/components/KondoLogo";
import { OrganizationOnboardingFlow } from "@/components/onboarding/OrganizationOnboardingFlow";
import {
  findOwnedOrganizationDraft,
  getOrganizationForSetup,
} from "@/lib/organizations";
import { getOrganizationReferenceData } from "@/lib/reference-data";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function OrganizationOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const initialOrganization = query.id
    ? await getOrganizationForSetup(user, query.id)
    : query.new === "1"
      ? null
      : await findOwnedOrganizationDraft(user.id);
  const { countries, cities } = await getOrganizationReferenceData();
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <KondoLogo />
        <OrganizationOnboardingFlow
          cities={cities.map((city) => ({
            id: city.id,
            name: city.name,
            secondary: [city.province, city.country.name]
              .filter(Boolean)
              .join(" · "),
            countryId: city.countryId,
          }))}
          countries={countries.map((country) => ({
            id: country.id,
            name: `${country.emoji ?? ""} ${country.name}`.trim(),
          }))}
          initialOrganization={initialOrganization}
        />
      </div>
    </main>
  );
}
